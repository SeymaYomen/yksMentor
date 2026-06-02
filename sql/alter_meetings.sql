-- Toplantılar tablosuna başlık, açıklama ve durum ekleyelim
ALTER TABLE public.meetings 
ADD COLUMN title text NOT NULL DEFAULT 'Görüşme',
ADD COLUMN description text,
ADD COLUMN status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled'));

-- RLS politikalarını güncelleyelim (Eğer daha önce yoksa)
alter table public.meetings enable row level security;
drop policy if exists "Teachers can manage meetings" on public.meetings;
drop policy if exists "Students can view meetings" on public.meetings;

create policy "Teachers can manage meetings"
  on public.meetings for all using (auth.uid() = teacher_id);

create policy "Students can view meetings"
  on public.meetings for select using (auth.uid() = student_id);
