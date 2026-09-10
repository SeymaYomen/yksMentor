-- Additive daily study behavior. No assessment writes or legacy backfill.
begin;

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  study_date date not null,
  subject_id uuid not null references public.exam_subjects(id) on delete restrict,
  topic_id uuid not null references public.exam_topics(id) on delete restrict,
  activity_type text not null check (activity_type in ('question_practice', 'topic_review', 'video_resource', 'note_taking')),
  duration_minutes integer not null check (duration_minutes > 0),
  question_count integer check (question_count >= 0),
  correct_count integer check (correct_count >= 0),
  wrong_count integer check (wrong_count >= 0),
  blank_count integer check (blank_count >= 0),
  source text check (length(source) <= 250),
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_question_activity_check check (
    activity_type = 'question_practice' or
    (question_count is null and correct_count is null and wrong_count is null and blank_count is null)
  ),
  constraint study_sessions_question_total_check check (
    question_count is null or
    coalesce(correct_count, 0)::bigint + coalesce(wrong_count, 0)::bigint + coalesce(blank_count, 0)::bigint <= question_count
  )
);
create index study_sessions_student_date_idx on public.study_sessions(student_id, study_date desc);

create function public.validate_study_session()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or new.subject_id is distinct from old.subject_id or new.topic_id is distinct from old.topic_id then
    if not exists (
      select 1 from public.exam_topics topic
      join public.exam_subjects subject on subject.id = topic.subject_id
      where topic.id = new.topic_id and topic.subject_id = new.subject_id
        and topic.is_active and subject.is_active
    ) then
      raise exception 'Invalid study subject/topic' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_study_session() from public, anon, authenticated;
create trigger trg_validate_study_session before insert or update on public.study_sessions
for each row execute function public.validate_study_session();

alter table public.study_sessions enable row level security;
revoke all on table public.study_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.study_sessions to authenticated;

create policy "Students read own study sessions" on public.study_sessions
for select to authenticated using (public.current_profile_role() = 'student' and auth.uid() = student_id);
create policy "Students create own study sessions" on public.study_sessions
for insert to authenticated with check (public.current_profile_role() = 'student' and auth.uid() = student_id);
create policy "Students update own study sessions" on public.study_sessions
for update to authenticated
using (public.current_profile_role() = 'student' and auth.uid() = student_id)
with check (public.current_profile_role() = 'student' and auth.uid() = student_id);
create policy "Students delete own study sessions" on public.study_sessions
for delete to authenticated using (public.current_profile_role() = 'student' and auth.uid() = student_id);
create policy "Teachers read linked study sessions" on public.study_sessions
for select to authenticated
using (public.current_profile_role() = 'teacher' and public.is_teacher_of(auth.uid(), student_id));

commit;
