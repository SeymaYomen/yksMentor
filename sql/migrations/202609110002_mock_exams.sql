-- Structured assessments only; legacy performance and competency remain untouched.
begin;
create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_type text not null check (exam_type in ('TYT','AYT','BRANCH')),
  exam_date date not null,
  name text check (length(name) <= 200),
  difficulty text check (difficulty in ('easy','medium','hard')),
  branch_subject_id uuid references public.exam_subjects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((exam_type = 'BRANCH') = (branch_subject_id is not null))
);
create table public.mock_exam_subject_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.mock_exams(id) on delete cascade,
  subject_id uuid not null references public.exam_subjects(id),
  correct_count integer not null check (correct_count >= 0),
  wrong_count integer not null check (wrong_count >= 0),
  blank_count integer not null check (blank_count >= 0),
  net numeric generated always as (correct_count::numeric - wrong_count::numeric / 4) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, subject_id)
);
create table public.mock_exam_topic_errors (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null,
  subject_id uuid not null,
  topic_id uuid not null references public.exam_topics(id),
  wrong_count integer not null check (wrong_count >= 0),
  blank_count integer not null check (blank_count >= 0),
  created_at timestamptz not null default now(),
  check (wrong_count::bigint + blank_count::bigint > 0),
  foreign key (exam_id, subject_id) references public.mock_exam_subject_results(exam_id, subject_id) on delete cascade,
  unique (exam_id, subject_id, topic_id)
);
create index mock_exams_student_date_idx on public.mock_exams(student_id, exam_type, exam_date desc);
create index mock_exam_subject_catalog_idx on public.mock_exam_subject_results(subject_id);
create index mock_exam_topic_catalog_idx on public.mock_exam_topic_errors(topic_id);

alter table public.mock_exams enable row level security;
alter table public.mock_exam_subject_results enable row level security;
alter table public.mock_exam_topic_errors enable row level security;
revoke all on public.mock_exams, public.mock_exam_subject_results, public.mock_exam_topic_errors from public, anon, authenticated;
grant select, insert, update, delete on public.mock_exams, public.mock_exam_subject_results, public.mock_exam_topic_errors to authenticated;
create policy student_crud on public.mock_exams for all to authenticated
  using (public.current_profile_role() = 'student' and student_id = auth.uid())
  with check (public.current_profile_role() = 'student' and student_id = auth.uid());
create policy linked_teacher_read on public.mock_exams for select to authenticated
  using (public.current_profile_role() = 'teacher' and public.is_teacher_of(auth.uid(), student_id));
create policy student_crud on public.mock_exam_subject_results for all to authenticated
  using (public.current_profile_role() = 'student' and exists (select 1 from public.mock_exams e where e.id = exam_id and e.student_id = auth.uid()))
  with check (public.current_profile_role() = 'student' and exists (select 1 from public.mock_exams e where e.id = exam_id and e.student_id = auth.uid()));
create policy linked_teacher_read on public.mock_exam_subject_results for select to authenticated
  using (public.current_profile_role() = 'teacher' and exists (select 1 from public.mock_exams e where e.id = exam_id and public.is_teacher_of(auth.uid(), e.student_id)));
create policy student_crud on public.mock_exam_topic_errors for all to authenticated
  using (public.current_profile_role() = 'student' and exists (select 1 from public.mock_exams e where e.id = exam_id and e.student_id = auth.uid()))
  with check (public.current_profile_role() = 'student' and exists (select 1 from public.mock_exams e where e.id = exam_id and e.student_id = auth.uid()));
create policy linked_teacher_read on public.mock_exam_topic_errors for select to authenticated
  using (public.current_profile_role() = 'teacher' and exists (select 1 from public.mock_exams e where e.id = exam_id and public.is_teacher_of(auth.uid(), e.student_id)));

-- Lock the parent for all child mutations to serialize concurrent validation.
create function public.lock_mock_exam() returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and new.exam_id <> old.exam_id then raise exception 'Cannot move exam rows'; end if;
  perform 1 from public.mock_exams where id = case when tg_op = 'DELETE' then old.exam_id else new.exam_id end for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
create trigger lock_subject_exam before insert or update or delete on public.mock_exam_subject_results for each row execute function public.lock_mock_exam();
create trigger lock_topic_exam before insert or update or delete on public.mock_exam_topic_errors for each row execute function public.lock_mock_exam();

create function public.check_mock_exam() returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_id uuid; e public.mock_exams;
begin
  if tg_table_name = 'mock_exams' then v_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else v_id := case when tg_op = 'DELETE' then old.exam_id else new.exam_id end; end if;
  select * into e from public.mock_exams where id = v_id;
  if not found then return null; end if;
  if not exists (select 1 from public.mock_exam_subject_results where exam_id = v_id) then raise exception 'At least one subject required'; end if;
  if exists (select 1 from public.mock_exam_subject_results r join public.exam_subjects s on s.id = r.subject_id
    where r.exam_id = v_id and ((e.exam_type = 'BRANCH' and r.subject_id <> e.branch_subject_id) or (e.exam_type <> 'BRANCH' and s.exam_type <> e.exam_type))) then
    raise exception 'Exam subject mismatch'; end if;
  if exists (select 1 from public.mock_exam_topic_errors t join public.exam_topics c on c.id = t.topic_id where t.exam_id = v_id and c.subject_id <> t.subject_id) then
    raise exception 'Topic subject mismatch'; end if;
  if exists (select 1 from public.mock_exam_subject_results r where r.exam_id = v_id and
    (r.wrong_count < (select coalesce(sum(t.wrong_count),0) from public.mock_exam_topic_errors t where t.exam_id = v_id and t.subject_id = r.subject_id)
    or r.blank_count < (select coalesce(sum(t.blank_count),0) from public.mock_exam_topic_errors t where t.exam_id = v_id and t.subject_id = r.subject_id))) then
    raise exception 'Topic errors exceed subject errors'; end if;
  return null;
end; $$;
create constraint trigger check_exam after insert or update or delete on public.mock_exams deferrable initially deferred for each row execute function public.check_mock_exam();
create constraint trigger check_subject_exam after insert or update or delete on public.mock_exam_subject_results deferrable initially deferred for each row execute function public.check_mock_exam();
create constraint trigger check_topic_exam after insert or update or delete on public.mock_exam_topic_errors deferrable initially deferred for each row execute function public.check_mock_exam();

create function public.save_mock_exam(p_exam_id uuid, p_exam_type text, p_exam_date date, p_name text, p_difficulty text,
  p_branch_subject_id uuid, p_subject_results jsonb, p_topic_errors jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  if public.current_profile_role() is distinct from 'student' or auth.uid() is null then raise exception 'Student access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_subject_results) is distinct from 'array' or jsonb_array_length(p_subject_results) = 0
    or jsonb_typeof(p_topic_errors) is distinct from 'array' then raise exception 'Invalid result arrays'; end if;
  if p_exam_id is null then
    insert into public.mock_exams(student_id, exam_type, exam_date, name, difficulty, branch_subject_id)
      values(auth.uid(), p_exam_type, p_exam_date, nullif(trim(p_name),''), p_difficulty, p_branch_subject_id) returning id into v_id;
  else
    update public.mock_exams set exam_type = p_exam_type, exam_date = p_exam_date, name = nullif(trim(p_name),''),
      difficulty = p_difficulty, branch_subject_id = p_branch_subject_id, updated_at = now()
      where id = p_exam_id and student_id = auth.uid() returning id into v_id;
    if v_id is null then raise exception 'Exam access denied' using errcode = '42501'; end if;
    delete from public.mock_exam_subject_results where exam_id = v_id;
  end if;
  insert into public.mock_exam_subject_results(exam_id, subject_id, correct_count, wrong_count, blank_count)
    select v_id, subject_id, correct_count, wrong_count, blank_count from jsonb_to_recordset(p_subject_results)
      as r(subject_id uuid, correct_count integer, wrong_count integer, blank_count integer);
  insert into public.mock_exam_topic_errors(exam_id, subject_id, topic_id, wrong_count, blank_count)
    select v_id, subject_id, topic_id, wrong_count, blank_count from jsonb_to_recordset(p_topic_errors)
      as r(subject_id uuid, topic_id uuid, wrong_count integer, blank_count integer);
  return v_id;
end; $$;
revoke all on function public.lock_mock_exam(), public.check_mock_exam() from public, anon, authenticated;
revoke all on function public.save_mock_exam(uuid,text,date,text,text,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_mock_exam(uuid,text,date,text,text,uuid,jsonb,jsonb) to authenticated;
commit;
