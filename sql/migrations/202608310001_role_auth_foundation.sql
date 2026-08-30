-- YKS Mentor - Phase 0 role/auth foundation
-- IMPORTANT: Review the live schema and policies before applying this migration.
-- This migration is intentionally non-destructive: it does not drop application tables
-- and it does not change the role of any existing profile.

begin;

create extension if not exists pgcrypto;

-- Preserve compatibility with installations where these additive columns have not yet
-- been created by the older ad-hoc SQL files.
alter table public.tasks
  add column if not exists teacher_id uuid references public.profiles(id) on delete set null,
  add column if not exists description text;

alter table public.meetings
  add column if not exists title text not null default 'Görüşme',
  add column if not exists description text,
  add column if not exists status text not null default 'scheduled';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.meetings'::regclass
      and conname = 'meetings_status_check'
  ) then
    alter table public.meetings
      add constraint meetings_status_check
      check (status in ('scheduled', 'completed', 'cancelled'));
  end if;
end;
$$;

-- Teacher registration invitations are completely separate from profiles.join_code,
-- which remains the student-to-mentor pairing code.
create table if not exists public.teacher_registration_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  constraint teacher_registration_invites_expiry_check check (expires_at > created_at),
  constraint teacher_registration_invites_usage_check check (
    (used_at is null and used_by is null) or
    (used_at is not null and used_by is not null)
  )
);

alter table public.teacher_registration_invites enable row level security;
revoke all on table public.teacher_registration_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.teacher_registration_invites to service_role;

-- Security helper functions run as the migration owner so policies can inspect profile
-- relationships without recursive RLS evaluation.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_mentor_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select p.mentor_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'student'
  limit 1;
$$;

create or replace function public.is_teacher_of(p_teacher_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select exists (
    select 1
    from public.profiles teacher
    join public.profiles student on student.mentor_id = teacher.id
    where teacher.id = p_teacher_id
      and teacher.role = 'teacher'
      and student.id = p_student_id
      and student.role = 'student'
  );
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.current_mentor_id() from public;
revoke all on function public.is_teacher_of(uuid, uuid) from public;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_mentor_id() to authenticated;
grant execute on function public.is_teacher_of(uuid, uuid) to authenticated;

-- New public sign-ups always start as students. Client metadata is retained only for
-- the display name and can never grant the teacher role.
create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  insert into public.profiles (id, username, role, created_at)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)),
    'student',
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists auth_user_insert on auth.users;
create trigger auth_user_insert
after insert on auth.users
for each row execute function public.handle_auth_user();

-- Defense in depth: even if a broad table grant is accidentally restored later,
-- ordinary anon/authenticated requests cannot mutate authorization fields directly.
create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.role is distinct from old.role or
    new.mentor_id is distinct from old.mentor_id or
    new.join_code is distinct from old.join_code
  ) then
    raise exception 'Rol ve eşleşme alanları doğrudan değiştirilemez.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_authorization_fields on public.profiles;
create trigger protect_profile_authorization_fields
before update of role, mentor_id, join_code on public.profiles
for each row execute function public.protect_profile_authorization_fields();

-- Service-only invite creation. The plaintext code must be generated with at least
-- 128 bits of entropy and is never stored; only its SHA-256 digest is persisted.
create or replace function public.create_teacher_registration_invite(
  p_code text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_code text := upper(btrim(p_code));
  v_hash text;
  v_id uuid;
begin
  if length(v_code) < 24 then
    raise exception 'Öğretmen davet kodu en az 24 karakterlik yüksek entropili bir değer olmalıdır.';
  end if;
  if p_expires_at <= now() then
    raise exception 'Davet bitiş tarihi gelecekte olmalıdır.';
  end if;

  v_hash := encode(digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex');

  insert into public.teacher_registration_invites (code_hash, expires_at, created_by)
  values (v_hash, p_expires_at, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_teacher_registration_invite(text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_teacher_registration_invite(text, timestamptz) to service_role;

-- Authenticated users may redeem a valid invite. FOR UPDATE serializes competing
-- redemptions; the profile role change and invite consumption are one transaction.
create or replace function public.redeem_teacher_registration_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_code text := upper(btrim(p_code));
  v_hash text;
  v_invite public.teacher_registration_invites%rowtype;
  v_current_role text;
  v_join_code text;
begin
  if auth.uid() is null then
    raise exception 'Öğretmen davetini kullanmak için giriş yapmalısınız.';
  end if;
  if v_code = '' then
    raise exception 'Öğretmen davet kodu boş bırakılamaz.';
  end if;

  v_hash := encode(digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex');

  select i.*
  into v_invite
  from public.teacher_registration_invites i
  where i.code_hash = v_hash
  for update;

  if not found then
    raise exception 'Öğretmen davet kodu geçersiz.';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Öğretmen davet kodu iptal edilmiş.';
  end if;
  if v_invite.used_at is not null then
    raise exception 'Öğretmen davet kodu daha önce kullanılmış.';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'Öğretmen davet kodunun süresi dolmuş.';
  end if;

  select p.role
  into v_current_role
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if not found then
    raise exception 'Kullanıcı profili bulunamadı.';
  end if;
  if v_current_role = 'teacher' then
    raise exception 'Bu hesap zaten öğretmen rolüne sahip.';
  end if;
  if v_current_role <> 'student' then
    raise exception 'Geçersiz kullanıcı rolü.';
  end if;

  loop
    v_join_code := lower(encode(gen_random_bytes(6), 'hex'));
    exit when not exists (
      select 1 from public.profiles p where p.join_code = v_join_code
    );
  end loop;

  update public.profiles
  set role = 'teacher',
      mentor_id = null,
      join_code = v_join_code
  where id = auth.uid();

  update public.teacher_registration_invites
  set used_at = now(),
      used_by = auth.uid()
  where id = v_invite.id;

  return 'teacher';
end;
$$;

revoke all on function public.redeem_teacher_registration_invite(text) from public, anon;
grant execute on function public.redeem_teacher_registration_invite(text) to authenticated;

-- Student-to-mentor pairing remains a separate code system and only students may use it.
create or replace function public.join_teacher_by_code(p_code text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_teacher_id uuid;
  v_role text;
  v_current_mentor uuid;
begin
  if auth.uid() is null then
    raise exception 'Mentora katılmak için giriş yapmalısınız.';
  end if;

  select p.role, p.mentor_id
  into v_role, v_current_mentor
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if v_role <> 'student' then
    raise exception 'Mentor katılım kodunu yalnızca öğrenciler kullanabilir.';
  end if;

  select p.id
  into v_teacher_id
  from public.profiles p
  where p.join_code = btrim(p_code)
    and p.role = 'teacher'
  limit 1;

  if v_teacher_id is null then
    raise exception 'Mentor katılım kodu geçersiz.';
  end if;
  if v_current_mentor is not null and v_current_mentor <> v_teacher_id then
    raise exception 'Hesabınız zaten başka bir mentora bağlı.';
  end if;

  update public.profiles
  set mentor_id = v_teacher_id
  where id = auth.uid();
end;
$$;

create or replace function public.get_teacher_info_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_teacher record;
begin
  if public.current_profile_role() <> 'student' then
    raise exception 'Mentor aramasını yalnızca öğrenciler kullanabilir.';
  end if;

  select p.id, p.username
  into v_teacher
  from public.profiles p
  where p.join_code = btrim(p_code)
    and p.role = 'teacher'
  limit 1;

  if not found then return null; end if;
  return json_build_object('id', v_teacher.id, 'username', v_teacher.username);
end;
$$;

create or replace function public.refresh_join_code()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_new_code text;
begin
  if public.current_profile_role() <> 'teacher' then
    raise exception 'Katılım kodunu yalnızca doğrulanmış öğretmen yenileyebilir.';
  end if;

  loop
    v_new_code := lower(encode(gen_random_bytes(6), 'hex'));
    exit when not exists (select 1 from public.profiles p where p.join_code = v_new_code);
  end loop;

  update public.profiles
  set join_code = v_new_code
  where id = auth.uid()
    and role = 'teacher';

  return v_new_code;
end;
$$;

revoke all on function public.join_teacher_by_code(text) from public, anon;
revoke all on function public.get_teacher_info_by_code(text) from public, anon;
revoke all on function public.refresh_join_code() from public, anon;
grant execute on function public.join_teacher_by_code(text) to authenticated;
grant execute on function public.get_teacher_info_by_code(text) to authenticated;
grant execute on function public.refresh_join_code() to authenticated;

-- Teacher-only task assignment derives teacher_id from auth.uid().
create or replace function public.assign_task(
  p_student_id uuid,
  p_title text,
  p_due_date date default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_task_id uuid;
begin
  if not public.is_teacher_of(auth.uid(), p_student_id) then
    raise exception 'Yalnızca size bağlı bir öğrenciye görev atayabilirsiniz.';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Görev başlığı boş bırakılamaz.';
  end if;

  insert into public.tasks (student_id, teacher_id, title, due_date, description)
  values (p_student_id, auth.uid(), btrim(p_title), p_due_date, nullif(btrim(p_description), ''))
  returning id into v_task_id;

  return v_task_id;
end;
$$;

-- Meeting creation and status changes are server-authorized RPCs.
create or replace function public.schedule_meeting(
  p_student_id uuid,
  p_title text,
  p_description text default null,
  p_meeting_url text default null,
  p_scheduled_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_meeting_id uuid;
begin
  if not public.is_teacher_of(auth.uid(), p_student_id) then
    raise exception 'Yalnızca size bağlı bir öğrenci için görüşme planlayabilirsiniz.';
  end if;
  if nullif(btrim(p_title), '') is null or p_scheduled_at is null then
    raise exception 'Görüşme başlığı ve tarihi zorunludur.';
  end if;

  insert into public.meetings (
    teacher_id, student_id, title, description, meeting_url, scheduled_at, status
  ) values (
    auth.uid(), p_student_id, btrim(p_title), nullif(btrim(p_description), ''),
    nullif(btrim(p_meeting_url), ''), p_scheduled_at, 'scheduled'
  )
  returning id into v_meeting_id;

  return v_meeting_id;
end;
$$;

create or replace function public.update_meeting_status(p_meeting_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_meeting public.meetings%rowtype;
begin
  if p_status not in ('scheduled', 'completed', 'cancelled') then
    raise exception 'Geçersiz görüşme durumu.';
  end if;

  select m.*
  into v_meeting
  from public.meetings m
  where m.id = p_meeting_id
  for update;

  if not found or v_meeting.teacher_id <> auth.uid() or
     not public.is_teacher_of(auth.uid(), v_meeting.student_id) then
    raise exception 'Bu görüşmeyi değiştirme yetkiniz yok.';
  end if;

  update public.meetings set status = p_status where id = p_meeting_id;
end;
$$;

revoke all on function public.assign_task(uuid, text, date, text) from public, anon;
revoke all on function public.schedule_meeting(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.update_meeting_status(uuid, text) from public, anon;
grant execute on function public.assign_task(uuid, text, date, text) to authenticated;
grant execute on function public.schedule_meeting(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.update_meeting_status(uuid, text) to authenticated;

-- PROFILES: own profile, linked students for teachers, and own mentor for students.
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Teachers can view their students" on public.profiles;
drop policy if exists "Students can view own mentor" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Teachers can view their students"
  on public.profiles for select
  using (
    public.current_profile_role() = 'teacher'
    and public.is_teacher_of(auth.uid(), id)
  );

create policy "Students can view own mentor"
  on public.profiles for select
  using (
    public.current_profile_role() = 'student'
    and id = public.current_mentor_id()
    and role = 'teacher'
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (username) on table public.profiles to authenticated;

-- TASKS: students see their own rows and can update only the status column;
-- verified teachers see/assign only for linked students.
alter table public.tasks enable row level security;
drop policy if exists "Students can view own tasks" on public.tasks;
drop policy if exists "Students can update own tasks" on public.tasks;
drop policy if exists "Students can update own task status" on public.tasks;
drop policy if exists "Teachers can insert tasks for students" on public.tasks;
drop policy if exists "Teachers can view tasks of their students" on public.tasks;

create policy "Students can view own tasks"
  on public.tasks for select
  using (public.current_profile_role() = 'student' and auth.uid() = student_id);

create policy "Students can update own task status"
  on public.tasks for update
  using (public.current_profile_role() = 'student' and auth.uid() = student_id)
  with check (public.current_profile_role() = 'student' and auth.uid() = student_id);

create policy "Teachers can view tasks of their students"
  on public.tasks for select
  using (
    public.current_profile_role() = 'teacher'
    and public.is_teacher_of(auth.uid(), student_id)
  );

revoke all on table public.tasks from anon;
revoke insert, update, delete on table public.tasks from authenticated;
grant select on table public.tasks to authenticated;
grant update (status) on table public.tasks to authenticated;

-- PERFORMANCE: student owns inserts/selects; linked teacher has read-only access.
alter table public.performance enable row level security;
drop policy if exists "Students can insert own performance" on public.performance;
drop policy if exists "Students can view own performance" on public.performance;
drop policy if exists "Teachers can view student performance" on public.performance;

create policy "Students can insert own performance"
  on public.performance for insert
  with check (public.current_profile_role() = 'student' and auth.uid() = student_id);

create policy "Students can view own performance"
  on public.performance for select
  using (public.current_profile_role() = 'student' and auth.uid() = student_id);

create policy "Teachers can view student performance"
  on public.performance for select
  using (
    public.current_profile_role() = 'teacher'
    and public.is_teacher_of(auth.uid(), student_id)
  );

revoke all on table public.performance from anon;
revoke update, delete on table public.performance from authenticated;
grant select, insert on table public.performance to authenticated;

-- MEETINGS: direct writes are revoked; RPCs derive teacher_id and validate linkage.
alter table public.meetings enable row level security;
drop policy if exists "Teachers can manage meetings" on public.meetings;
drop policy if exists "Students can view meetings" on public.meetings;
drop policy if exists "Students can view own meetings" on public.meetings;
drop policy if exists "Teachers can view linked meetings" on public.meetings;

create policy "Students can view own meetings"
  on public.meetings for select
  using (public.current_profile_role() = 'student' and auth.uid() = student_id);

create policy "Teachers can view linked meetings"
  on public.meetings for select
  using (
    public.current_profile_role() = 'teacher'
    and auth.uid() = teacher_id
    and public.is_teacher_of(auth.uid(), student_id)
  );

revoke all on table public.meetings from anon;
revoke insert, update, delete on table public.meetings from authenticated;
grant select on table public.meetings to authenticated;

commit;

-- Rollback strategy (do not execute without a pre-migration schema/policy backup):
-- 1. Deploy the previous application revision.
-- 2. Restore the previous grants, RLS policies and function definitions from the
--    reviewed pre-migration dump in one transaction.
-- 3. Revoke the new RPCs before dropping them.
-- 4. Retain teacher_registration_invites as an audit archive; do not demote users who
--    legitimately redeemed an invite and do not drop additive columns automatically.
