import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../sql/migrations/202608310003_goal_progress_roadmap.sql', import.meta.url),
  'utf8',
).toLowerCase()

test('student_goals RLS ve tek aktif hedef kuralıyla oluşturulur', () => {
  assert.match(migration, /alter table public\.student_goals enable row level security/)
  assert.match(migration, /unique index[\s\S]*on public\.student_goals\(student_id\)[\s\S]*where is_active/)
  assert.match(migration, /created_by uuid references public\.profiles\(id\)/)
  assert.doesNotMatch(migration, /alter table public\.weekly_goals/)
  assert.match(migration, /student_goals_archive_check[\s\S]*is_active and archived_at is null[\s\S]*not is_active and archived_at is not null/)
})

test('öğrenci yalnız kendi hedefini, mentor yalnız bağlı öğrencinin hedefini okuyabilir', () => {
  assert.match(migration, /public\.current_profile_role\(\) = 'student'[\s\S]*auth\.uid\(\) = student_id/)
  assert.match(migration, /public\.current_profile_role\(\) = 'teacher'[\s\S]*public\.is_teacher_of\(auth\.uid\(\), student_id\)/)
})

test('authenticated client doğrudan hedef yazamaz', () => {
  assert.match(migration, /revoke insert, update, delete on table public\.student_goals from authenticated/)
  assert.match(migration, /grant select on table public\.student_goals to authenticated/)
})

test('RPC student_id girdisini role ve bağlantıya göre doğrular, yazanı auth kimliğinden türetir', () => {
  assert.match(migration, /p_student_id <> auth\.uid\(\)/)
  assert.match(migration, /public\.is_teacher_of\(auth\.uid\(\), p_student_id\)/)
  assert.match(migration, /p_student_id, auth\.uid\(\), p_goal_type/)
  assert.doesNotMatch(migration.match(/create or replace function public\.save_student_goal\(([\s\S]*?)\)\s*returns/)?.[1] ?? '', /p_teacher_id/)
  assert.doesNotMatch(migration.match(/create or replace function public\.save_student_goal\(([\s\S]*?)\)\s*returns/)?.[1] ?? '', /p_created_by/)
})

test('hedef değişikliği eski aktif kaydı silmeden arşivler', () => {
  assert.match(migration, /update public\.student_goals[\s\S]*set is_active = false[\s\S]*archived_at = now\(\)/)
  assert.doesNotMatch(migration, /delete from public\.student_goals/)
})

test('eşzamanlı hedef değişiklikleri öğrenci profil kilidiyle serileştirilir', () => {
  assert.match(migration, /from public\.profiles profile[\s\S]*where profile\.id = p_student_id[\s\S]*for update/)
})

test('student ve mentor izolasyonu auth.uid ile RLS ve RPC katmanlarında zorunludur', () => {
  assert.match(migration, /current_profile_role\(\) = 'student'[\s\S]*auth\.uid\(\) = student_id/)
  assert.match(migration, /current_profile_role\(\) = 'teacher'[\s\S]*is_teacher_of\(auth\.uid\(\), student_id\)/)
  assert.match(migration, /if p_student_id <> auth\.uid\(\)/)
  assert.match(migration, /if not public\.is_teacher_of\(auth\.uid\(\), p_student_id\)/)
})
