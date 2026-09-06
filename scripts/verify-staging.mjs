import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

function required(name) { const value = process.env[name]; if (!value) throw new Error('Missing ' + name); return value }
const ref = required('STAGING_PROJECT_REF')
assert.equal(required('CONFIRM_STAGING_PROJECT_REF'), ref, 'Staging target must be explicitly confirmed')
const url = required('STAGING_SUPABASE_URL')
assert.equal(new URL(url).origin, 'https://' + ref + '.supabase.co', 'URL must match confirmed staging project')
const key = required('STAGING_SUPABASE_ANON_KEY')
const jwt = { teacherA: required('STAGING_TEACHER_A_JWT'), teacherB: required('STAGING_TEACHER_B_JWT'), student: required('STAGING_STUDENT_A_JWT') }
const clients = Object.fromEntries(Object.entries(jwt).map(([role, token]) => [role, createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } })]))
const ids = {}
for (const [role, client] of Object.entries(clients)) {
  const result = await client.auth.getUser(jwt[role]); assert.ok(!result.error && result.data.user, role + ' valid session required')
  ids[role] = result.data.user.id
  const profile = await client.from('profiles').select('id,role,mentor_id').eq('id', ids[role]).single()
  assert.ok(!profile.error, role + ' profile required')
  assert.equal(profile.data.role, role === 'student' ? 'student' : 'teacher')
  if (role === 'student') assert.equal(profile.data.mentor_id, ids.teacherA)
}
assert.notEqual(ids.teacherA, ids.teacherB)
const fixtures = {
  tasks: required('STAGING_TASK_ID'), performance: required('STAGING_PERFORMANCE_ID'),
  meetings: required('STAGING_MEETING_ID'), student_goals: required('STAGING_GOAL_ID'),
  meeting_action_items: required('STAGING_ACTION_ITEM_ID'), exam_topic_performance: required('STAGING_TOPIC_PERFORMANCE_ID'),
}
for (const [table, id] of Object.entries(fixtures)) {
  for (const role of ['teacherA', 'student', 'teacherB']) {
    const result = await clients[role].from(table).select('id,student_id').eq('id', id)
    assert.ok(!result.error, table + ': query must succeed under RLS')
    assert.equal(result.data.length, role === 'teacherB' ? 0 : 1, table + ': visibility for ' + role)
    if (result.data.length) assert.equal(result.data[0].student_id, ids.student)
  }
}
for (const [table, patch] of Object.entries({ tasks: { teacher_id: ids.teacherB }, meetings: { teacher_id: ids.teacherB }, student_goals: { created_by: ids.teacherB }, exam_topic_performance: { student_id: ids.teacherB } })) {
  const result = await clients.student.from(table).update(patch).eq('id', fixtures[table]).select('id')
  assert.ok(result.error || result.data.length === 0, table + ': unauthorized update must fail')
}
for (const patch of [{ role: 'teacher' }, { mentor_id: ids.teacherB }]) {
  const result = await clients.student.from('profiles').update(patch).eq('id', ids.student).select('id')
  assert.ok(result.error || result.data.length === 0, 'Profile authorization update must fail')
}
for (const role of Object.keys(clients)) {
  assert.ok((await clients[role].from('ai_mentor_usage').select('id').limit(1)).error, 'Usage table must be inaccessible')
  assert.ok((await clients[role].rpc('claim_ai_mentor_request', { p_teacher_id: ids.teacherA, p_provider: 'openai', p_model: 'staging-verification' })).error, 'Claim RPC must be inaccessible')
  assert.ok((await clients[role].rpc('complete_ai_mentor_request', { p_usage_id: -1, p_request_status: 'failed', p_model: 'staging-verification' })).error, 'Complete RPC must be inaccessible')
}
const endpoint = url + '/functions/v1/mentor-ai-insight'
const options = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://staging.example.test' } })
assert.equal(options.status, 200)
async function post(token, body) {
  return fetch(endpoint, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
}
assert.equal((await post(null, { studentId: ids.student })).status, 401)
assert.equal((await post(jwt.teacherA, { studentId: 'invalid' })).status, 400)
for (const role of ['student', 'teacherB']) {
  const result = await post(jwt[role], { studentId: ids.student })
  assert.equal(result.status, 403); assert.equal((await result.json()).code, 'FORBIDDEN')
}
if (process.env.RUN_RATE_LIMIT === 'yes') {
  assert.notEqual(process.env.RUN_OPENAI, 'yes', 'Run concurrency and paid AI smoke separately')
  const service = createClient(url, required('STAGING_SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const results = await Promise.all(Array.from({ length: 4 }, () => service.rpc('claim_ai_mentor_request', { p_teacher_id: ids.teacherA, p_provider: 'openai', p_model: 'staging-concurrency', p_minute_limit: 3, p_daily_limit: 30 })))
  assert.ok(results.every(result => !result.error), 'Claim RPC requests must succeed')
  const claims = results.map(result => result.data[0])
  for (const claim of claims.filter(claim => claim.allowed)) {
    const result = await service.rpc('complete_ai_mentor_request', { p_usage_id: claim.usage_id, p_request_status: 'failed', p_model: 'staging-concurrency', p_error_code: 'INTERNAL_ERROR' })
    assert.ok(!result.error && result.data === true, 'Completion must succeed')
  }
  assert.equal(claims.filter(claim => claim.allowed).length, 3, 'Use a dedicated mentor with empty quota')
  assert.equal(new Set(claims.filter(claim => claim.allowed).map(claim => claim.usage_id)).size, 3)
  console.log('Concurrency: 3 accepted, 1 rate limited; unique usage IDs.')
}
if (process.env.RUN_OPENAI === 'yes') {
  const response = await post(jwt.teacherA, { studentId: ids.student })
  assert.equal(response.status, 200, 'Correct mentor AI smoke failed')
  // Use the actual client runtime response validator, without adding a TS runtime dependency.
  const ts = (await import('typescript')).default
  const { readFileSync } = await import('node:fs')
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync('src/lib/aiMentorOutput.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  new Function('module', 'exports', compiled.outputText)(module, module.exports)
  module.exports.parseAIMentorInsightResponse(await response.json())
  console.log('One real AI response passed runtime validation.')
}
console.log('Staging RLS and negative Edge smoke passed. Optional quota/AI checks run only when explicitly enabled.')
