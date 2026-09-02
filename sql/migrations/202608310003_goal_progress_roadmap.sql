-- YKS Mentor - structured student goal and progress foundation
-- Additive and non-destructive. weekly_goals remains the weekly question/subject tracker.

begin;

create table if not exists public.student_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  goal_type text not null,
  score_type text,
  university_name text,
  program_name text,
  target_rank integer,
  target_score numeric,
  target_tyt_net numeric,
  target_ayt_net numeric,
  target_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint student_goals_goal_type_check check (
    goal_type in ('university_program', 'rank', 'score', 'net')
  ),
  constraint student_goals_score_type_check check (
    score_type is null or score_type in ('sayisal', 'esit_agirlik', 'sozel', 'dil', 'tyt')
  ),
  constraint student_goals_rank_check check (target_rank is null or target_rank > 0),
  constraint student_goals_score_check check (
    target_score is null or (
      target_score >= 0 and target_score::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  constraint student_goals_tyt_net_check check (target_tyt_net is null or target_tyt_net between 0 and 120),
  constraint student_goals_ayt_net_check check (target_ayt_net is null or target_ayt_net between 0 and 80),
  constraint student_goals_university_length_check check (
    university_name is null or length(university_name) between 1 and 200
  ),
  constraint student_goals_program_length_check check (
    program_name is null or length(program_name) between 1 and 200
  ),
  constraint student_goals_archive_check check (
    (is_active and archived_at is null) or (not is_active and archived_at is not null)
  ),
  constraint student_goals_content_check check (
    university_name is not null or program_name is not null or target_rank is not null or
    target_score is not null or target_tyt_net is not null or target_ayt_net is not null
  )
);

create unique index if not exists student_goals_one_active_per_student_idx
  on public.student_goals(student_id)
  where is_active;
create index if not exists student_goals_student_created_idx
  on public.student_goals(student_id, created_at desc);
create index if not exists student_goals_created_by_idx
  on public.student_goals(created_by);

alter table public.student_goals enable row level security;

drop policy if exists "Students can view own goals" on public.student_goals;
drop policy if exists "Teachers can view linked student goals" on public.student_goals;

create policy "Students can view own goals"
  on public.student_goals for select
  using (
    public.current_profile_role() = 'student'
    and auth.uid() = student_id
  );

create policy "Teachers can view linked student goals"
  on public.student_goals for select
  using (
    public.current_profile_role() = 'teacher'
    and public.is_teacher_of(auth.uid(), student_id)
  );

revoke all on table public.student_goals from public, anon;
revoke insert, update, delete on table public.student_goals from authenticated;
grant select on table public.student_goals to authenticated;

-- Replacing a goal archives the previous active row instead of deleting it.
-- p_student_id is authorization-checked; created_by is always derived server-side.
create or replace function public.save_student_goal(
  p_student_id uuid,
  p_goal_type text,
  p_score_type text default null,
  p_university_name text default null,
  p_program_name text default null,
  p_target_rank integer default null,
  p_target_score numeric default null,
  p_target_tyt_net numeric default null,
  p_target_ayt_net numeric default null,
  p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_caller_role text;
  v_goal_id uuid;
  v_university_name text := nullif(btrim(p_university_name), '');
  v_program_name text := nullif(btrim(p_program_name), '');
begin
  v_caller_role := public.current_profile_role();

  if v_caller_role = 'student' then
    if p_student_id <> auth.uid() then
      raise exception 'Yalnızca kendi hedefinizi değiştirebilirsiniz.';
    end if;
  elsif v_caller_role = 'teacher' then
    if not public.is_teacher_of(auth.uid(), p_student_id) then
      raise exception 'Yalnızca size bağlı bir öğrencinin hedefini değiştirebilirsiniz.';
    end if;
  else
    raise exception 'Hedef değiştirme yetkiniz yok.';
  end if;

  -- Serialize concurrent replacements and verify the target is a student.
  perform 1
  from public.profiles profile
  where profile.id = p_student_id
    and profile.role = 'student'
  for update;

  if not found then
    raise exception 'Öğrenci profili bulunamadı.';
  end if;

  if p_goal_type not in ('university_program', 'rank', 'score', 'net') then
    raise exception 'Geçersiz hedef türü.';
  end if;

  if p_score_type is not null and p_score_type not in ('sayisal', 'esit_agirlik', 'sozel', 'dil', 'tyt') then
    raise exception 'Geçersiz puan türü.';
  end if;

  if p_target_rank is not null and p_target_rank <= 0 then
    raise exception 'Hedef sıralama sıfırdan büyük olmalıdır.';
  end if;
  if p_target_score is not null and (
    p_target_score < 0 or p_target_score::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Hedef puan negatif olamaz.';
  end if;
  if p_target_tyt_net is not null and (p_target_tyt_net < 0 or p_target_tyt_net > 120) then
    raise exception 'TYT hedefi 0 ile 120 arasında olmalıdır.';
  end if;
  if p_target_ayt_net is not null and (p_target_ayt_net < 0 or p_target_ayt_net > 80) then
    raise exception 'AYT hedefi 0 ile 80 arasında olmalıdır.';
  end if;

  if p_goal_type = 'university_program' and (v_university_name is null or v_program_name is null) then
    raise exception 'Üniversite programı hedefinde üniversite ve bölüm zorunludur.';
  elsif p_goal_type = 'rank' and p_target_rank is null then
    raise exception 'Sıralama hedefinde hedef sıralama zorunludur.';
  elsif p_goal_type = 'score' and p_target_score is null then
    raise exception 'Puan hedefinde hedef puan zorunludur.';
  elsif p_goal_type = 'net' and p_target_tyt_net is null and p_target_ayt_net is null then
    raise exception 'Net hedefinde TYT veya AYT hedeflerinden en az biri zorunludur.';
  end if;

  if v_university_name is null and v_program_name is null and p_target_rank is null and
     p_target_score is null and p_target_tyt_net is null and p_target_ayt_net is null then
    raise exception 'En az bir yapılandırılmış hedef alanı gereklidir.';
  end if;

  update public.student_goals
  set is_active = false,
      archived_at = now(),
      updated_at = now()
  where student_id = p_student_id
    and is_active;

  insert into public.student_goals (
    student_id, created_by, goal_type, score_type, university_name, program_name,
    target_rank, target_score, target_tyt_net, target_ayt_net, target_date
  ) values (
    p_student_id, auth.uid(), p_goal_type, p_score_type, v_university_name, v_program_name,
    p_target_rank, p_target_score, p_target_tyt_net, p_target_ayt_net, p_target_date
  )
  returning id into v_goal_id;

  return v_goal_id;
end;
$$;

revoke all on function public.save_student_goal(
  uuid, text, text, text, text, integer, numeric, numeric, numeric, date
) from public, anon, authenticated;
grant execute on function public.save_student_goal(
  uuid, text, text, text, text, integer, numeric, numeric, numeric, date
) to authenticated;

commit;

-- Rollback guidance (manual, only after deploying the previous application):
-- 1. Revoke and drop save_student_goal.
-- 2. Export student_goals if history must be retained, then drop the table.
-- 3. weekly_goals is independent and must not be changed by this rollback.
