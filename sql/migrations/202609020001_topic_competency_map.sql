-- YKS Mentor - academic subject/topic catalog and topic competency foundation
-- Additive and non-destructive. Existing performance and free-form task rows remain valid.

begin;

create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_type text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_subjects_exam_type_check check (exam_type in ('TYT', 'AYT')),
  constraint exam_subjects_name_check check (length(btrim(name)) between 1 and 100),
  constraint exam_subjects_sort_order_check check (sort_order >= 0),
  constraint exam_subjects_exam_name_key unique (exam_type, name)
);

create table if not exists public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.exam_subjects(id) on delete restrict,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_topics_name_check check (length(btrim(name)) between 1 and 150),
  constraint exam_topics_sort_order_check check (sort_order >= 0),
  constraint exam_topics_subject_name_key unique (subject_id, name)
);

-- Initial centrally managed catalog. It is intentionally data, not component code,
-- and can be expanded or inactivated without changing historical measurements.
insert into public.exam_subjects (exam_type, name, sort_order)
values
  ('TYT', 'Türkçe', 10),
  ('TYT', 'Matematik', 20),
  ('TYT', 'Fizik', 30),
  ('TYT', 'Kimya', 40),
  ('TYT', 'Biyoloji', 50),
  ('TYT', 'Tarih', 60),
  ('TYT', 'Coğrafya', 70),
  ('TYT', 'Felsefe', 80),
  ('TYT', 'Din Kültürü', 90),
  ('AYT', 'Matematik', 10),
  ('AYT', 'Fizik', 20),
  ('AYT', 'Kimya', 30),
  ('AYT', 'Biyoloji', 40),
  ('AYT', 'Türk Dili ve Edebiyatı', 50),
  ('AYT', 'Tarih', 60),
  ('AYT', 'Coğrafya', 70),
  ('AYT', 'Felsefe Grubu', 80)
on conflict (exam_type, name) do nothing;

insert into public.exam_topics (subject_id, name, sort_order)
select subject.id, seed.topic_name, seed.sort_order
from (values
  ('TYT', 'Türkçe', 'Sözcükte Anlam', 10),
  ('TYT', 'Türkçe', 'Cümlede Anlam', 20),
  ('TYT', 'Türkçe', 'Paragraf', 30),
  ('TYT', 'Türkçe', 'Dil Bilgisi', 40),
  ('TYT', 'Türkçe', 'Yazım Kuralları', 50),
  ('TYT', 'Türkçe', 'Noktalama İşaretleri', 60),
  ('TYT', 'Matematik', 'Temel Kavramlar', 10),
  ('TYT', 'Matematik', 'Sayı Basamakları', 20),
  ('TYT', 'Matematik', 'Bölme ve Bölünebilme', 30),
  ('TYT', 'Matematik', 'Üslü Sayılar', 40),
  ('TYT', 'Matematik', 'Köklü Sayılar', 50),
  ('TYT', 'Matematik', 'Denklemler ve Eşitsizlikler', 60),
  ('TYT', 'Matematik', 'Problemler', 70),
  ('TYT', 'Matematik', 'Kümeler ve Mantık', 80),
  ('TYT', 'Matematik', 'Veri ve Olasılık', 90),
  ('TYT', 'Matematik', 'Geometri', 100),
  ('TYT', 'Fizik', 'Madde ve Özellikleri', 10),
  ('TYT', 'Fizik', 'Hareket ve Kuvvet', 20),
  ('TYT', 'Fizik', 'İş, Güç ve Enerji', 30),
  ('TYT', 'Fizik', 'Isı ve Sıcaklık', 40),
  ('TYT', 'Fizik', 'Elektrik', 50),
  ('TYT', 'Fizik', 'Optik', 60),
  ('TYT', 'Kimya', 'Kimya Bilimi', 10),
  ('TYT', 'Kimya', 'Atom ve Periyodik Sistem', 20),
  ('TYT', 'Kimya', 'Kimyasal Türler Arası Etkileşimler', 30),
  ('TYT', 'Kimya', 'Maddenin Halleri', 40),
  ('TYT', 'Kimya', 'Karışımlar', 50),
  ('TYT', 'Kimya', 'Asit, Baz ve Tuz', 60),
  ('TYT', 'Biyoloji', 'Canlıların Ortak Özellikleri', 10),
  ('TYT', 'Biyoloji', 'Hücre', 20),
  ('TYT', 'Biyoloji', 'Canlıların Sınıflandırılması', 30),
  ('TYT', 'Biyoloji', 'Hücre Bölünmeleri', 40),
  ('TYT', 'Biyoloji', 'Kalıtım', 50),
  ('TYT', 'Biyoloji', 'Ekoloji', 60),
  ('TYT', 'Tarih', 'Tarih Bilimine Giriş', 10),
  ('TYT', 'Tarih', 'İlk ve Orta Çağlarda Türk Dünyası', 20),
  ('TYT', 'Tarih', 'İslam Medeniyetinin Doğuşu', 30),
  ('TYT', 'Tarih', 'Türklerin İslamiyet’i Kabulü', 40),
  ('TYT', 'Tarih', 'Osmanlı Tarihi', 50),
  ('TYT', 'Tarih', 'Millî Mücadele', 60),
  ('TYT', 'Coğrafya', 'Doğa ve İnsan', 10),
  ('TYT', 'Coğrafya', 'Harita Bilgisi', 20),
  ('TYT', 'Coğrafya', 'İklim Bilgisi', 30),
  ('TYT', 'Coğrafya', 'Yer Şekilleri', 40),
  ('TYT', 'Coğrafya', 'Nüfus ve Yerleşme', 50),
  ('TYT', 'Coğrafya', 'Ekonomik Faaliyetler', 60),
  ('TYT', 'Felsefe', 'Felsefenin Konusu', 10),
  ('TYT', 'Felsefe', 'Bilgi Felsefesi', 20),
  ('TYT', 'Felsefe', 'Ahlak Felsefesi', 30),
  ('TYT', 'Felsefe', 'Din Felsefesi', 40),
  ('TYT', 'Din Kültürü', 'Bilgi ve İnanç', 10),
  ('TYT', 'Din Kültürü', 'Din ve İslam', 20),
  ('TYT', 'Din Kültürü', 'Ahlak ve Değerler', 30),
  ('TYT', 'Din Kültürü', 'Din, Kültür ve Medeniyet', 40),
  ('AYT', 'Matematik', 'Fonksiyonlar', 10),
  ('AYT', 'Matematik', 'Polinomlar', 20),
  ('AYT', 'Matematik', 'İkinci Dereceden Denklemler', 30),
  ('AYT', 'Matematik', 'Trigonometri', 40),
  ('AYT', 'Matematik', 'Logaritma', 50),
  ('AYT', 'Matematik', 'Diziler', 60),
  ('AYT', 'Matematik', 'Limit ve Süreklilik', 70),
  ('AYT', 'Matematik', 'Türev', 80),
  ('AYT', 'Matematik', 'İntegral', 90),
  ('AYT', 'Matematik', 'Analitik Geometri', 100),
  ('AYT', 'Fizik', 'Kuvvet ve Hareket', 10),
  ('AYT', 'Fizik', 'Enerji ve Momentum', 20),
  ('AYT', 'Fizik', 'Elektrik ve Manyetizma', 30),
  ('AYT', 'Fizik', 'Çembersel Hareket', 40),
  ('AYT', 'Fizik', 'Basit Harmonik Hareket', 50),
  ('AYT', 'Fizik', 'Dalga Mekaniği', 60),
  ('AYT', 'Fizik', 'Modern Fizik', 70),
  ('AYT', 'Kimya', 'Modern Atom Teorisi', 10),
  ('AYT', 'Kimya', 'Gazlar', 20),
  ('AYT', 'Kimya', 'Sıvı Çözeltiler', 30),
  ('AYT', 'Kimya', 'Kimyasal Tepkimelerde Enerji', 40),
  ('AYT', 'Kimya', 'Kimyasal Denge', 50),
  ('AYT', 'Kimya', 'Asit-Baz Dengesi', 60),
  ('AYT', 'Kimya', 'Elektrokimya', 70),
  ('AYT', 'Kimya', 'Organik Kimya', 80),
  ('AYT', 'Biyoloji', 'Sinir Sistemi', 10),
  ('AYT', 'Biyoloji', 'Endokrin Sistem', 20),
  ('AYT', 'Biyoloji', 'Duyu Organları', 30),
  ('AYT', 'Biyoloji', 'Destek ve Hareket Sistemi', 40),
  ('AYT', 'Biyoloji', 'Dolaşım ve Bağışıklık', 50),
  ('AYT', 'Biyoloji', 'Solunum ve Boşaltım', 60),
  ('AYT', 'Biyoloji', 'Üreme ve Gelişme', 70),
  ('AYT', 'Biyoloji', 'Genden Proteine', 80),
  ('AYT', 'Biyoloji', 'Bitki Biyolojisi', 90),
  ('AYT', 'Biyoloji', 'Ekoloji', 100),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Şiir Bilgisi', 10),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Edebî Sanatlar', 20),
  ('AYT', 'Türk Dili ve Edebiyatı', 'İslamiyet Öncesi Türk Edebiyatı', 30),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Halk Edebiyatı', 40),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Divan Edebiyatı', 50),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Tanzimat Edebiyatı', 60),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Servetifünun ve Fecriati', 70),
  ('AYT', 'Türk Dili ve Edebiyatı', 'Cumhuriyet Dönemi Türk Edebiyatı', 80),
  ('AYT', 'Tarih', 'Türklerde Devlet Teşkilatı', 10),
  ('AYT', 'Tarih', 'Osmanlı Devleti’nde Değişim', 20),
  ('AYT', 'Tarih', 'Avrupa ve Osmanlı', 30),
  ('AYT', 'Tarih', 'XX. Yüzyıl Başlarında Osmanlı', 40),
  ('AYT', 'Tarih', 'Millî Mücadele', 50),
  ('AYT', 'Tarih', 'Atatürkçülük ve Türk İnkılabı', 60),
  ('AYT', 'Tarih', 'İki Savaş Arasındaki Dönem', 70),
  ('AYT', 'Tarih', 'Soğuk Savaş Sonrası Dünya', 80),
  ('AYT', 'Coğrafya', 'Ekosistemler', 10),
  ('AYT', 'Coğrafya', 'Nüfus Politikaları', 20),
  ('AYT', 'Coğrafya', 'Türkiye’de Ekonomik Faaliyetler', 30),
  ('AYT', 'Coğrafya', 'Küresel Ticaret', 40),
  ('AYT', 'Coğrafya', 'Jeopolitik Konum', 50),
  ('AYT', 'Coğrafya', 'Çevre Sorunları', 60),
  ('AYT', 'Felsefe Grubu', 'Psikoloji', 10),
  ('AYT', 'Felsefe Grubu', 'Sosyoloji', 20),
  ('AYT', 'Felsefe Grubu', 'Mantık', 30),
  ('AYT', 'Felsefe Grubu', 'Felsefe', 40)
) as seed(exam_type, subject_name, topic_name, sort_order)
join public.exam_subjects subject
  on subject.exam_type = seed.exam_type and subject.name = seed.subject_name
on conflict (subject_id, name) do nothing;

create unique index if not exists performance_id_student_unique_idx
  on public.performance(id, student_id);

create table if not exists public.exam_topic_performance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  performance_id uuid not null,
  topic_id uuid not null references public.exam_topics(id) on delete restrict,
  correct_count integer,
  wrong_count integer,
  blank_count integer,
  observed_at date not null default current_date,
  created_at timestamptz not null default now(),
  constraint exam_topic_performance_counts_present_check check (
    correct_count is not null or wrong_count is not null or blank_count is not null
  ),
  constraint exam_topic_performance_correct_check check (correct_count is null or correct_count >= 0),
  constraint exam_topic_performance_wrong_check check (wrong_count is null or wrong_count >= 0),
  constraint exam_topic_performance_blank_check check (blank_count is null or blank_count >= 0),
  constraint exam_topic_performance_questions_check check (
    coalesce(correct_count, 0) + coalesce(wrong_count, 0) + coalesce(blank_count, 0) > 0
  ),
  constraint exam_topic_performance_record_topic_key unique (performance_id, topic_id),
  constraint exam_topic_performance_owner_fkey foreign key (performance_id, student_id)
    references public.performance(id, student_id) on delete cascade
);

create index if not exists exam_topic_performance_student_created_idx
  on public.exam_topic_performance(student_id, created_at desc);
create index if not exists exam_topic_performance_topic_idx
  on public.exam_topic_performance(topic_id);

alter table public.tasks
  add column if not exists exam_type text,
  add column if not exists subject_id uuid references public.exam_subjects(id) on delete set null,
  add column if not exists topic_id uuid references public.exam_topics(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_exam_type_check'
  ) then
    alter table public.tasks
      add constraint tasks_exam_type_check
      check (exam_type is null or exam_type in ('TYT', 'AYT'));
  end if;
end;
$$;

create or replace function public.validate_task_academic_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_subject_id uuid;
  v_exam_type text;
begin
  if new.topic_id is not null then
    select topic.subject_id, subject.exam_type
    into v_subject_id, v_exam_type
    from public.exam_topics topic
    join public.exam_subjects subject on subject.id = topic.subject_id
    where topic.id = new.topic_id;

    if not found then raise exception 'Geçersiz konu.'; end if;
    if new.subject_id is not null and new.subject_id <> v_subject_id then
      raise exception 'Konu seçilen derse ait değil.';
    end if;
    new.subject_id := v_subject_id;
    if new.exam_type is not null and new.exam_type <> v_exam_type then
      raise exception 'Konu seçilen sınav türüne ait değil.';
    end if;
    new.exam_type := v_exam_type;
  elsif new.subject_id is not null then
    select subject.exam_type into v_exam_type
    from public.exam_subjects subject
    where subject.id = new.subject_id;

    if not found then raise exception 'Geçersiz ders.'; end if;
    if new.exam_type is not null and new.exam_type <> v_exam_type then
      raise exception 'Ders seçilen sınav türüne ait değil.';
    end if;
    new.exam_type := v_exam_type;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_task_academic_link on public.tasks;
create trigger trg_validate_task_academic_link
before insert or update of exam_type, subject_id, topic_id on public.tasks
for each row execute function public.validate_task_academic_link();

revoke all on function public.validate_task_academic_link() from public, anon, authenticated;

alter table public.exam_subjects enable row level security;
alter table public.exam_topics enable row level security;
alter table public.exam_topic_performance enable row level security;

drop policy if exists "Authenticated users can view exam subjects" on public.exam_subjects;
drop policy if exists "Authenticated users can view exam topics" on public.exam_topics;
drop policy if exists "Students can view own topic performance" on public.exam_topic_performance;
drop policy if exists "Teachers can view linked topic performance" on public.exam_topic_performance;

create policy "Authenticated users can view exam subjects"
  on public.exam_subjects for select to authenticated
  using (true);

create policy "Authenticated users can view exam topics"
  on public.exam_topics for select to authenticated
  using (true);

create policy "Students can view own topic performance"
  on public.exam_topic_performance for select to authenticated
  using (
    public.current_profile_role() = 'student'
    and auth.uid() = student_id
  );

create policy "Teachers can view linked topic performance"
  on public.exam_topic_performance for select to authenticated
  using (
    public.current_profile_role() = 'teacher'
    and public.is_teacher_of(auth.uid(), student_id)
  );

revoke all on table public.exam_subjects from public, anon, authenticated;
revoke all on table public.exam_topics from public, anon, authenticated;
revoke all on table public.exam_topic_performance from public, anon, authenticated;
grant select on table public.exam_subjects to authenticated;
grant select on table public.exam_topics to authenticated;
grant select on table public.exam_topic_performance to authenticated;

-- Records the existing aggregate performance row and optional topic evidence in one transaction.
-- student_id is always auth.uid(); clients cannot choose an identity field.
create or replace function public.record_student_performance(
  p_daily_hours numeric,
  p_tyt_net numeric,
  p_ayt_net numeric,
  p_topic_entries jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_performance_id uuid;
  v_entries jsonb := coalesce(p_topic_entries, '[]'::jsonb);
begin
  if public.current_profile_role() <> 'student' then
    raise exception 'Yalnızca öğrenciler performans kaydı oluşturabilir.';
  end if;
  if p_daily_hours is null or p_daily_hours::text in ('NaN', 'Infinity', '-Infinity')
     or p_daily_hours < 0 or p_daily_hours > 24 then
    raise exception 'Çalışma saati 0 ile 24 arasında olmalıdır.';
  end if;
  if p_tyt_net is null or p_tyt_net::text in ('NaN', 'Infinity', '-Infinity')
     or p_tyt_net < 0 or p_tyt_net > 120 then
    raise exception 'TYT neti 0 ile 120 arasında olmalıdır.';
  end if;
  if p_ayt_net is null or p_ayt_net::text in ('NaN', 'Infinity', '-Infinity')
     or p_ayt_net < 0 or p_ayt_net > 80 then
    raise exception 'AYT neti 0 ile 80 arasında olmalıdır.';
  end if;
  if jsonb_typeof(v_entries) <> 'array' or jsonb_array_length(v_entries) > 50 then
    raise exception 'Konu performansı geçerli bir liste olmalıdır.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_entries) as entry(
      topic_id uuid, correct_count integer, wrong_count integer, blank_count integer
    )
    where entry.topic_id is null
      or entry.correct_count < 0
      or entry.wrong_count < 0
      or entry.blank_count < 0
      or coalesce(entry.correct_count, 0) + coalesce(entry.wrong_count, 0) + coalesce(entry.blank_count, 0) <= 0
  ) then
    raise exception 'Konu sayıları negatif olamaz ve toplam soru sayısı sıfırdan büyük olmalıdır.';
  end if;

  if (
    select count(*) <> count(distinct entry.topic_id)
    from jsonb_to_recordset(v_entries) as entry(topic_id uuid)
  ) then
    raise exception 'Aynı konu bir performans kaydında yalnızca bir kez bulunabilir.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_entries) as entry(topic_id uuid)
    left join public.exam_topics topic on topic.id = entry.topic_id
    left join public.exam_subjects subject on subject.id = topic.subject_id
    where topic.id is null or not topic.is_active or not subject.is_active
  ) then
    raise exception 'Geçersiz veya pasif ders/konu seçimi.';
  end if;

  insert into public.performance (student_id, daily_hours, tyt_net, ayt_net)
  values (auth.uid(), p_daily_hours, p_tyt_net, p_ayt_net)
  returning id into v_performance_id;

  insert into public.exam_topic_performance (
    student_id, performance_id, topic_id, correct_count, wrong_count, blank_count, observed_at
  )
  select
    auth.uid(), v_performance_id, entry.topic_id,
    entry.correct_count, entry.wrong_count, entry.blank_count, current_date
  from jsonb_to_recordset(v_entries) as entry(
    topic_id uuid, correct_count integer, wrong_count integer, blank_count integer
  );

  return v_performance_id;
end;
$$;

-- Academic task assignment keeps every catalog field optional so legacy free-form
-- tasks and future structured tasks can coexist.
create or replace function public.assign_academic_task(
  p_student_id uuid,
  p_title text,
  p_due_date date default null,
  p_description text default null,
  p_exam_type text default null,
  p_subject_id uuid default null,
  p_topic_id uuid default null
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

  insert into public.tasks (
    student_id, teacher_id, title, due_date, description, exam_type, subject_id, topic_id
  ) values (
    p_student_id, auth.uid(), btrim(p_title), p_due_date, nullif(btrim(p_description), ''),
    p_exam_type, p_subject_id, p_topic_id
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

revoke all on function public.record_student_performance(numeric, numeric, numeric, jsonb)
  from public, anon, authenticated;
revoke all on function public.assign_academic_task(uuid, text, date, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_student_performance(numeric, numeric, numeric, jsonb)
  to authenticated;
grant execute on function public.assign_academic_task(uuid, text, date, text, text, uuid, uuid)
  to authenticated;

commit;

-- Rollback guidance (manual, after deploying the previous application revision):
-- 1. Revoke and drop the two new RPCs and the task validation trigger/function.
-- 2. Drop the three nullable task columns; existing free-form task rows are unaffected.
-- 3. Export topic performance if it must be retained, then drop topic performance,
--    topics and subjects in that dependency order.
