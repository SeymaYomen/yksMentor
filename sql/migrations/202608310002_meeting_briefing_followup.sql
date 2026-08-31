-- YKS Mentor - meeting briefing and structured follow-up foundation
-- Additive and non-destructive: existing meeting rows and columns are preserved.

begin;

alter table public.meetings
  add column if not exists outcome_summary text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.meetings'::regclass
      and conname = 'meetings_outcome_summary_length_check'
  ) then
    alter table public.meetings
      add constraint meetings_outcome_summary_length_check
      check (outcome_summary is null or length(outcome_summary) <= 3000);
  end if;
end;
$$;

create table if not exists public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  item_text text not null,
  kind text not null default 'action',
  status text not null default 'open',
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint meeting_action_items_text_check check (length(btrim(item_text)) between 1 and 1000),
  constraint meeting_action_items_kind_check check (kind in ('action', 'followup')),
  constraint meeting_action_items_status_check check (status in ('open', 'completed', 'cancelled')),
  constraint meeting_action_items_completed_at_check check (
    (status = 'completed' and completed_at is not null) or
    (status <> 'completed' and completed_at is null)
  )
);

create index if not exists meeting_action_items_meeting_id_idx
  on public.meeting_action_items(meeting_id);
create index if not exists meeting_action_items_student_status_idx
  on public.meeting_action_items(student_id, status);
create index if not exists meeting_action_items_teacher_id_idx
  on public.meeting_action_items(teacher_id);

alter table public.meeting_action_items enable row level security;

drop policy if exists "Teachers can view linked meeting action items" on public.meeting_action_items;
drop policy if exists "Students can view own meeting action items" on public.meeting_action_items;

create policy "Teachers can view linked meeting action items"
  on public.meeting_action_items for select
  using (
    public.current_profile_role() = 'teacher'
    and auth.uid() = teacher_id
    and public.is_teacher_of(auth.uid(), student_id)
    and exists (
      select 1
      from public.meetings meeting
      where meeting.id = meeting_action_items.meeting_id
        and meeting.teacher_id = auth.uid()
        and meeting.student_id = meeting_action_items.student_id
    )
  );

create policy "Students can view own meeting action items"
  on public.meeting_action_items for select
  using (
    public.current_profile_role() = 'student'
    and auth.uid() = student_id
  );

revoke all on table public.meeting_action_items from public, anon;
revoke insert, update, delete on table public.meeting_action_items from authenticated;
grant select on table public.meeting_action_items to authenticated;

-- Only the verified teacher of the meeting's currently linked student may save
-- the structured outcome. The client never supplies teacher_id or student_id.
create or replace function public.save_meeting_outcome_summary(
  p_meeting_id uuid,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_meeting public.meetings%rowtype;
begin
  select meeting.*
  into v_meeting
  from public.meetings meeting
  where meeting.id = p_meeting_id
  for update;

  if not found or v_meeting.teacher_id <> auth.uid() or
     not public.is_teacher_of(auth.uid(), v_meeting.student_id) then
    raise exception 'Bu görüşmenin sonucunu kaydetme yetkiniz yok.';
  end if;

  if v_meeting.status <> 'completed' then
    raise exception 'Görüşme sonucu yalnızca tamamlanan görüşmelere eklenebilir.';
  end if;

  update public.meetings
  set outcome_summary = nullif(btrim(p_summary), '')
  where id = p_meeting_id;
end;
$$;

create or replace function public.create_meeting_action_item(
  p_meeting_id uuid,
  p_text text,
  p_kind text default 'action',
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_meeting public.meetings%rowtype;
  v_item_id uuid;
begin
  if nullif(btrim(p_text), '') is null then
    raise exception 'Karar veya takip maddesi boş bırakılamaz.';
  end if;

  if p_kind not in ('action', 'followup') then
    raise exception 'Geçersiz takip maddesi türü.';
  end if;

  select meeting.*
  into v_meeting
  from public.meetings meeting
  where meeting.id = p_meeting_id
  for update;

  if not found or v_meeting.teacher_id <> auth.uid() or
     not public.is_teacher_of(auth.uid(), v_meeting.student_id) then
    raise exception 'Bu görüşmeye takip maddesi ekleme yetkiniz yok.';
  end if;

  if v_meeting.status <> 'completed' then
    raise exception 'Takip maddesi yalnızca tamamlanan görüşmelere eklenebilir.';
  end if;

  insert into public.meeting_action_items (
    meeting_id, student_id, teacher_id, item_text, kind, status, due_date
  ) values (
    v_meeting.id, v_meeting.student_id, auth.uid(), btrim(p_text), p_kind, 'open', p_due_date
  )
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.update_meeting_action_item_status(
  p_item_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_item public.meeting_action_items%rowtype;
  v_meeting public.meetings%rowtype;
begin
  if p_status not in ('open', 'completed', 'cancelled') then
    raise exception 'Geçersiz takip maddesi durumu.';
  end if;

  select item.*
  into v_item
  from public.meeting_action_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Takip maddesi bulunamadı.';
  end if;

  select meeting.*
  into v_meeting
  from public.meetings meeting
  where meeting.id = v_item.meeting_id;

  if not found or v_item.teacher_id <> auth.uid() or
     v_meeting.teacher_id <> auth.uid() or
     v_meeting.student_id <> v_item.student_id or
     not public.is_teacher_of(auth.uid(), v_item.student_id) then
    raise exception 'Bu takip maddesini değiştirme yetkiniz yok.';
  end if;

  update public.meeting_action_items
  set status = p_status,
      completed_at = case when p_status = 'completed' then now() else null end
  where id = p_item_id;
end;
$$;

revoke all on function public.save_meeting_outcome_summary(uuid, text) from public, anon;
revoke all on function public.create_meeting_action_item(uuid, text, text, date) from public, anon;
revoke all on function public.update_meeting_action_item_status(uuid, text) from public, anon;

grant execute on function public.save_meeting_outcome_summary(uuid, text) to authenticated;
grant execute on function public.create_meeting_action_item(uuid, text, text, date) to authenticated;
grant execute on function public.update_meeting_action_item_status(uuid, text) to authenticated;

commit;

-- Rollback guidance (manual, only after deploying the previous application):
-- 1. Revoke and drop the three RPCs above.
-- 2. Preserve/export meeting_action_items if audit history is required, then drop it.
-- 3. Drop meetings.outcome_summary only after confirming no meeting outcome must be retained.
