-- Safe baseline for fresh installs; existing tables/data are preserved.
-- Existing schema drift still requires operator review before applying.
begin;
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('teacher','student')),
  mentor_id uuid references public.profiles(id) on delete set null,
  join_code text unique,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status boolean default false,
  due_date date,
  created_at timestamptz default now()
);
create index if not exists tasks_student_id_idx on public.tasks(student_id);

-- Performance tablosu
create table if not exists public.performance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  daily_hours numeric default 0,
  tyt_net numeric default 0,
  ayt_net numeric default 0,
  date date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists performance_student_id_idx on public.performance(student_id);

-- Meetings tablosu
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  meeting_url text,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists meetings_teacher_id_idx on public.meetings(teacher_id);
create index if not exists meetings_student_id_idx on public.meetings(student_id);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.performance enable row level security;
alter table public.meetings enable row level security;
commit;
