import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../sql/migrations/202609020001_topic_competency_map.sql', import.meta.url),
  'utf8',
).toLowerCase()

test('akademik katalog ve topic performance tabloları additive oluşturulur', () => {
  assert.match(migration, /create table if not exists public\.exam_subjects/)
  assert.match(migration, /create table if not exists public\.exam_topics/)
  assert.match(migration, /create table if not exists public\.exam_topic_performance/)
  assert.doesNotMatch(migration, /drop table/)
  assert.doesNotMatch(migration, /alter table public\.performance[\s\S]*drop column/)
})

test('eski toplam performans kayıtları konu satırı olmadan geçerli kalır', () => {
  assert.match(migration, /performance_id uuid not null/)
  assert.doesNotMatch(migration, /alter table public\.performance[\s\S]*add column[\s\S]*not null/)
})

test('öğrenci ve mentor topic performance okumaları RLS ile izole edilir', () => {
  assert.match(migration, /current_profile_role\(\) = 'student'[\s\S]*auth\.uid\(\) = student_id/)
  assert.match(migration, /current_profile_role\(\) = 'teacher'[\s\S]*is_teacher_of\(auth\.uid\(\), student_id\)/)
  assert.match(migration, /alter table public\.exam_topic_performance enable row level security/)
})

test('client doğrudan topic performance yazamaz ve RPC student_id kabul etmez', () => {
  assert.match(migration, /revoke all on table public\.exam_topic_performance from public, anon, authenticated/)
  const signature = migration.match(/create or replace function public\.record_student_performance\(([\s\S]*?)\)\s*returns/)?.[1] ?? ''
  assert.doesNotMatch(signature, /student_id|teacher_id/)
  assert.match(migration, /values \(auth\.uid\(\), p_daily_hours, p_tyt_net, p_ayt_net\)/)
  assert.match(migration, /insert into public\.exam_topic_performance[\s\S]*auth\.uid\(\), v_performance_id/)
})

test('topic performance satırı performance sahibiyle veritabanında eşleşir', () => {
  assert.match(migration, /foreign key \(performance_id, student_id\)[\s\S]*references public\.performance\(id, student_id\)/)
})

test('task akademik bağlantıları nullable ve eski serbest görevlerle uyumludur', () => {
  assert.match(migration, /add column if not exists exam_type text/)
  assert.match(migration, /add column if not exists subject_id uuid/)
  assert.match(migration, /add column if not exists topic_id uuid/)
  assert.doesNotMatch(migration, /add column if not exists (?:exam_type|subject_id|topic_id)[^,;]*not null/)
  assert.match(migration, /trigger trg_validate_task_academic_link[\s\S]*before insert or update of exam_type, subject_id, topic_id/)
})

test('pasif konu geçmişi silinmez ve yeni girişlerde aktif katalog zorunludur', () => {
  assert.match(migration, /topic_id uuid not null references public\.exam_topics\(id\) on delete restrict/)
  assert.match(migration, /where topic\.id is null or not topic\.is_active or not subject\.is_active/)
})

test('akademik görev RPCsi mentor-öğrenci bağlantısını doğrular ve teacher_id türetir', () => {
  assert.match(migration, /assign_academic_task[\s\S]*is_teacher_of\(auth\.uid\(\), p_student_id\)/)
  assert.match(migration, /p_student_id, auth\.uid\(\), btrim\(p_title\)/)
  assert.doesNotMatch(migration.match(/assign_academic_task\(([\s\S]*?)\)\s*returns/)?.[1] ?? '', /p_teacher_id/)
})
