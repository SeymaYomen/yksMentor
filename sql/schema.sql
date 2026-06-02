-- Supabase / PostgreSQL schema for YKS Mentor MVP
-- Run this in Supabase SQL editor

create extension if not exists "pgcrypto";

-- Çakışan tabloları temizle (Bağımlılıklarıyla birlikte siler)
drop table if exists public.meetings cascade;
drop table if exists public.performance cascade;
drop table if exists public.tasks cascade;
drop table if exists public.profiles cascade;

-- Profiles tablosunu doğru bir şekilde yeniden oluştur
-- Supabase Auth kullanıldığı için password_hash kaldırıldı
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('teacher','student')),
  mentor_id uuid references public.profiles(id) on delete set null,
  join_code text unique,
  created_at timestamptz default now()
);

-- Öğretmenler için otomatik join_code oluşturma trigger'ı
create or replace function public.generate_join_code() returns trigger as $$
begin
  if new.role = 'teacher' and coalesce(new.join_code, '') = '' then
    new.join_code := substring(md5(gen_random_uuid()::text) from 1 for 8);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_join_code before insert on public.profiles
for each row execute function public.generate_join_code();

-- Tasks tablosu
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status boolean default false,
  due_date date,
  created_at timestamptz default now()
);
create index on public.tasks(student_id);

-- Performance tablosu
create table public.performance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  daily_hours numeric default 0,
  tyt_net numeric default 0,
  ayt_net numeric default 0,
  date date not null default current_date,
  created_at timestamptz default now()
);
create index on public.performance(student_id);

-- Meetings tablosu
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  meeting_url text,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);
create index on public.meetings(teacher_id);
create index on public.meetings(student_id);
