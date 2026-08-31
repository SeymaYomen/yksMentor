import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../sql/migrations/202608310002_meeting_briefing_followup.sql', import.meta.url),
  'utf8',
).toLowerCase()

test('meeting action item tablosunda RLS ve salt-okunur client grantları zorunludur', () => {
  assert.match(migration, /alter table public\.meeting_action_items enable row level security/)
  assert.match(migration, /revoke insert, update, delete on table public\.meeting_action_items from authenticated/)
  assert.match(migration, /grant select on table public\.meeting_action_items to authenticated/)
})

test('mentor policy auth kullanıcısını sahiplik ve öğrenci bağlantısıyla doğrular', () => {
  assert.match(migration, /auth\.uid\(\) = teacher_id/)
  assert.match(migration, /public\.is_teacher_of\(auth\.uid\(\), student_id\)/)
  assert.match(migration, /meeting\.teacher_id = auth\.uid\(\)/)
  assert.match(migration, /meeting\.student_id = meeting_action_items\.student_id/)
})

test('öğrenci yalnızca kendi action item kayıtlarını okuyabilir', () => {
  assert.match(migration, /public\.current_profile_role\(\) = 'student'[\s\S]*auth\.uid\(\) = student_id/)
})

test('RPC imzaları güvenlik alanı olarak teacher_id veya student_id kabul etmez', () => {
  const signatures = [...migration.matchAll(/create or replace function public\.(?:save_meeting_outcome_summary|create_meeting_action_item|update_meeting_action_item_status)\(([\s\S]*?)\)\s*returns/g)]
  assert.equal(signatures.length, 3)
  signatures.forEach(([, parameters]) => {
    assert.doesNotMatch(parameters, /p_teacher_id|p_student_id/)
  })
})

test('RPC yazımları kimliği toplantı kaydı ve auth.uid üzerinden türetir', () => {
  assert.match(migration, /v_meeting\.teacher_id <> auth\.uid\(\)/)
  assert.match(migration, /not public\.is_teacher_of\(auth\.uid\(\), v_meeting\.student_id\)/)
  assert.match(migration, /v_meeting\.id, v_meeting\.student_id, auth\.uid\(\)/)
  assert.match(migration, /v_meeting\.status <> 'completed'/)
})
