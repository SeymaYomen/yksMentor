-- =============================================
-- RLS POLITIKALARI - Tüm tablolar için güvenlik
-- Supabase SQL Editor'da çalıştırın
-- =============================================

-- PROFILES tablosu
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Teachers can view their students" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Öğretmenler kendi öğrencilerini görebilsin
create policy "Teachers can view their students"
  on public.profiles for select using (
    auth.uid() = mentor_id
  );

-- TASKS tablosu
alter table public.tasks enable row level security;
drop policy if exists "Students can view own tasks" on public.tasks;
drop policy if exists "Students can update own tasks" on public.tasks;
drop policy if exists "Teachers can insert tasks for students" on public.tasks;
drop policy if exists "Teachers can view tasks of their students" on public.tasks;

-- Öğrenci kendi görevlerini görebilir
create policy "Students can view own tasks"
  on public.tasks for select using (auth.uid() = student_id);

-- Öğrenci görevini tamamlandı işaretleyebilir
create policy "Students can update own tasks"
  on public.tasks for update using (auth.uid() = student_id);

-- Öğretmen öğrencisine görev atayabilir
create policy "Teachers can insert tasks for students"
  on public.tasks for insert with check (
    exists (
      select 1 from public.profiles
      where id = tasks.student_id
        and mentor_id = auth.uid()
    )
  );

-- Öğretmen kendi öğrencilerinin görevlerini görebilir
create policy "Teachers can view tasks of their students"
  on public.tasks for select using (
    exists (
      select 1 from public.profiles
      where id = tasks.student_id
        and mentor_id = auth.uid()
    )
  );

-- PERFORMANCE tablosu
alter table public.performance enable row level security;
drop policy if exists "Students can insert own performance" on public.performance;
drop policy if exists "Students can view own performance" on public.performance;
drop policy if exists "Teachers can view student performance" on public.performance;

-- Öğrenci kendi performans verisini ekleyebilir
create policy "Students can insert own performance"
  on public.performance for insert with check (auth.uid() = student_id);

-- Öğrenci kendi performans verisini görebilir
create policy "Students can view own performance"
  on public.performance for select using (auth.uid() = student_id);

-- Öğretmen kendi öğrencisinin performansını görebilir
create policy "Teachers can view student performance"
  on public.performance for select using (
    exists (
      select 1 from public.profiles
      where id = performance.student_id
        and mentor_id = auth.uid()
    )
  );
