-- 1. Haftalık Soru ve Konu Takip Tablosu (weekly_goals)
CREATE TABLE IF NOT EXISTS public.weekly_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL, -- Örn: 'TYT Matematik', 'AYT Fizik'
  target_questions INTEGER DEFAULT 0,
  solved_questions INTEGER DEFAULT 0,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Güvenlik (RLS) Politikaları: Öğrenciler sadece kendi hedeflerini görebilir ve güncelleyebilir
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Öğrenciler kendi hedeflerini görebilir" ON public.weekly_goals;
CREATE POLICY "Öğrenciler kendi hedeflerini görebilir" 
ON public.weekly_goals FOR SELECT 
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Öğrenciler kendi hedeflerini güncelleyebilir" ON public.weekly_goals;
CREATE POLICY "Öğrenciler kendi hedeflerini güncelleyebilir" 
ON public.weekly_goals FOR UPDATE 
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Öğretmenler öğrencilerinin hedeflerini görebilir" ON public.weekly_goals;
CREATE POLICY "Öğretmenler öğrencilerinin hedeflerini görebilir" 
ON public.weekly_goals FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = weekly_goals.student_id
      AND profiles.mentor_id = auth.uid()
  )
);

-- 2. Görevler / Ödevler Tablosu (tasks) - schema.sql'deki tabloyu genişletip güncelleyelim
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description TEXT;

-- Realtime yayını için yayın (publication) ayarları
-- Not: Supabase üzerinde replication yayını aktifleştirmek için bu SQL kodları SQL Editor'de çalıştırılmalıdır.
