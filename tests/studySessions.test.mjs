import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
function load(path, dependencies = {}) {
  const compiled = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  new Function('exports', 'module', 'require', compiled.outputText)(module.exports, module, name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  })
  return module.exports
}
const model = load('../src/lib/studySessions.ts')
function loadService(supabase) {
  const assessment = load('../src/lib/mockExamData.ts', {
    './supabase': { supabase }, './mockExams': load('../src/lib/mockExams.ts'),
  })
  return load('../src/lib/studySessionData.ts', { './supabase': { supabase }, './studySessions': model, './mockExamData': assessment })
}
const { dailyStudyTotals, mergeStudyHours, prepareStudySession, recentStudyTopics, localStudyDate } = model
const session = (overrides = {}) => ({ id: 's1', student_id: 'alice', study_date: '2026-09-11', subject_id: 'math', topic_id: 'problems',
  activity_type: 'question_practice', duration_minutes: 55, question_count: 70, correct_count: 60, wrong_count: 8, blank_count: 2,
  source: null, note: null, created_at: '2026-09-11T10:00:00Z', updated_at: '2026-09-11T10:00:00Z', ...overrides })
const legacy = (overrides = {}) => ({ id: 'p1', student_id: 'alice', date: '2026-09-11', created_at: '2026-09-11T08:00:00Z', daily_hours: 4, tyt_net: 80, ayt_net: 50, ...overrides })

test('same student and date: multiple sessions sum their minutes', () => {
  assert.deepEqual(dailyStudyTotals([session(), session({ duration_minutes: 40 }), session({ duration_minutes: 35 })]),
    [{ student_id: 'alice', study_date: '2026-09-11', duration_minutes: 130 }])
})
test('dates and students have independent daily totals', () => {
  const totals = dailyStudyTotals([session(), session({ study_date: '2026-09-10', duration_minutes: 30 }), session({ student_id: 'bob', duration_minutes: 10 })])
  assert.equal(totals.length, 3)
  assert.deepEqual(totals.map(row => row.duration_minutes), [55, 30, 10])
})
test('session total replaces legacy hours without double counting', () => {
  const rows = mergeStudyHours([legacy()], [session(), session({ duration_minutes: 35 })])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].daily_hours, 1.5)
  assert.equal(rows[0].tyt_net, 80)
  assert.equal(rows[0].ayt_net, 50)
})
test('without sessions legacy rows remain unchanged', () => {
  const rows = [legacy()]
  assert.deepEqual(mergeStudyHours(rows, []), rows)
})
test('multiple legacy net observations retain their values but get only one session total', () => {
  const original = [legacy(), legacy({ id: 'p2', tyt_net: 85 })]
  const rows = mergeStudyHours(original, [session({ duration_minutes: 120 })])
  assert.equal(rows.reduce((sum, row) => sum + (row.daily_hours ?? 0), 0), 2)
  assert.deepEqual(rows.map(row => row.tyt_net), [80, 85])
  assert.equal(original[0].daily_hours, 4)
})
test('session-only days have null nets, never invented zero scores', () => {
  const rows = mergeStudyHours([], [session({ duration_minutes: 30 })])
  assert.equal(rows[0].daily_hours, 0.5)
  assert.equal(rows[0].tyt_net, null)
  assert.equal(rows[0].ayt_net, null)
})
test('mixed legacy and session days only override the matching student/date', () => {
  const rows = mergeStudyHours([legacy(), legacy({ id: 'p2', date: '2026-09-10' }), legacy({ id: 'p3', student_id: 'bob' })], [session({ duration_minutes: 60 })])
  assert.equal(rows.find(row => row.id === 'p1').daily_hours, 1)
  assert.equal(rows.find(row => row.id === 'p2').daily_hours, 4)
  assert.equal(rows.find(row => row.id === 'p3').daily_hours, 4)
})
test('legacy timestamp fallback matches session dates', () => {
  assert.equal(mergeStudyHours([legacy({ date: null })], [session({ duration_minutes: 60 })])[0].daily_hours, 1)
})
test('question practice preserves optional count fields and trims free text', () => {
  const result = prepareStudySession(session({ source: '  Kitap  ', note: '  ' }))
  assert.deepEqual([result.question_count, result.correct_count, result.wrong_count, result.blank_count], [70, 60, 8, 2])
  assert.equal(result.source, 'Kitap')
  assert.equal(result.note, null)
  assert.doesNotThrow(() => prepareStudySession(session({ question_count: null, correct_count: null, wrong_count: null, blank_count: null })))
})
test('all non-question activities clear question fields', () => {
  for (const activity_type of ['topic_review', 'video_resource', 'note_taking']) {
    const result = prepareStudySession(session({ activity_type }))
    assert.deepEqual([result.question_count, result.correct_count, result.wrong_count, result.blank_count], [null, null, null, null])
  }
})
test('invalid duration and counts are rejected before persistence', () => {
  for (const duration_minutes of [0, -1, 0.5, NaN, Infinity, 2147483648]) assert.throws(() => prepareStudySession(session({ duration_minutes })))
  for (const key of ['question_count', 'correct_count', 'wrong_count', 'blank_count']) {
    for (const value of [-1, 0.5, NaN, Infinity, 2147483648]) assert.throws(() => prepareStudySession(session({ [key]: value })))
  }
  assert.throws(() => prepareStudySession(session({ question_count: 69 })))
  assert.doesNotThrow(() => prepareStudySession(session({ question_count: null })))
})
test('invalid catalog selection, date, activity and text length are rejected', () => {
  for (const override of [{ topic_id: '' }, { subject_id: '' }, { activity_type: 'unknown' }, { activity_type: 'toString' },
    { study_date: '2026-02-30' }, { study_date: '' }, { source: 'x'.repeat(251) }, { note: 'x'.repeat(1001) }]) {
    assert.throws(() => prepareStudySession(session(override)))
  }
})
test('quick entry keeps at most three distinct recent subject/topic pairs', () => {
  const rows = recentStudyTopics([session(), session({ topic_id: 'older', study_date: '2026-09-01' }),
    session({ topic_id: 'third', created_at: '2026-09-11T09:00:00Z' }), session({ topic_id: 'second', created_at: '2026-09-11T11:00:00Z' }), session()])
  assert.deepEqual(rows.map(row => row.topic_id), ['second', 'problems', 'third'])
})
test('study date follows local calendar rather than UTC truncation', () => {
  assert.equal(localStudyDate(new Date(2026, 8, 11, 0, 5)), '2026-09-11')
})

test('create service persists only study sessions, never assessment evidence', async () => {
  const writes = []
  const supabase = { from(table) {
    assert.equal(table, 'study_sessions')
    return { insert(payload) { writes.push(payload); return { select() { return { single: async () => ({ data: payload, error: null }) } } } } }
  } }
  const service = loadService(supabase)
  await service.createStudySession(session())
  await service.createStudySession(session({ activity_type: 'topic_review' }))
  assert.equal(writes[0].correct_count, 60)
  assert.equal(writes[1].correct_count, null)
  await assert.rejects(service.createStudySession(session({ duration_minutes: 0 })))
  assert.equal(writes.length, 2)
})
test('daily practice is isolated from competency loaders and UI assessment writes', () => {
  const academic = read('../src/lib/academicData.ts')
  assert.match(academic, /from\('exam_topic_performance'\)/)
  assert.doesNotMatch(academic, /study_sessions/)
  const ui = read('../src/components/student/PerformanceForm.tsx')
  assert.doesNotMatch(ui, /record_student_performance|topic_performance_updated|TopicPerformanceFields|tyt_net|ayt_net/)
  assert.match(ui, /form\.activity === 'question_practice'/)
  assert.match(ui, /if \(submitting\.current\) return/)
  const open = ui.slice(ui.indexOf('function openForm'), ui.indexOf('async function submit'))
  assert.match(open, /\.\.\.emptyForm, subject, topic/)
})

test('shared loader paginates sessions and combines legacy totals without truncation', async () => {
  const ranges = []
  const source = { mock_exams: [], performance: [legacy()], study_sessions: Array.from({ length: 1001 }, (_, i) => session({ id: String(i), duration_minutes: 1 })) }
  const supabase = { from(table) {
    return { select() { return this }, in(column, ids) { assert.equal(column, 'student_id'); assert.deepEqual(ids, ['alice']); return this },
      order() { return this }, range(from, to) { ranges.push([table, from, to]); return Promise.resolve({ data: source[table].slice(from, to + 1), error: null }) } }
  } }
  const service = loadService(supabase)
  const rows = await service.loadStudyPerformance(['alice'])
  assert.equal(rows[0].daily_hours, 1001 / 60)
  assert.equal(rows[0].tyt_net, 80)
  assert.equal(ranges.filter(([table]) => table === 'study_sessions').length, 3)
  assert.deepEqual(await service.loadStudyPerformance([]), [])
})
test('loader propagates session read errors rather than showing misleading legacy totals', async () => {
  const supabase = { from(table) {
    return { select() { return this }, in() { return this }, order() { return this },
      range() { return Promise.resolve(table === 'study_sessions' ? { data: null, error: new Error('unavailable') } : { data: table === 'mock_exams' ? [] : [legacy()], error: null }) } }
  } }
  const service = loadService(supabase)
  await assert.rejects(service.loadStudyPerformance(['alice']), /unavailable/)
})

// Static migration contract tests, consistent with the repo's security tests.
// Live PostgreSQL RLS execution is reserved for the explicitly deferred staging run.
const sql = read('../sql/migrations/202609110001_study_sessions.sql').toLowerCase()
const policies = [...sql.matchAll(/create policy "([^"]+)" on public\.study_sessions\s+for (select|insert|update|delete) to authenticated\s+([\s\S]*?);/g)]
test('RLS student policies constrain every read/write to student role and own id', () => {
  const student = policies.filter(policy => policy[1].startsWith('students'))
  assert.deepEqual(student.map(policy => policy[2]).sort(), ['delete', 'insert', 'select', 'update'])
  for (const policy of student) assert.match(policy[3], /current_profile_role\(\) = 'student' and auth\.uid\(\) = student_id/)
  const update = student.find(policy => policy[2] === 'update')[3]
  assert.match(update, /using \(public\.current_profile_role\(\) = 'student' and auth\.uid\(\) = student_id\)/)
  assert.match(update, /with check \(public\.current_profile_role\(\) = 'student' and auth\.uid\(\) = student_id\)/)
})
test('RLS linked teacher has select policy only', () => {
  const teacher = policies.filter(policy => policy[1].startsWith('teachers'))
  assert.equal(teacher.length, 1)
  assert.equal(teacher[0][2], 'select')
  assert.match(teacher[0][3], /current_profile_role\(\) = 'teacher' and public\.is_teacher_of\(auth\.uid\(\), student_id\)/)
})
test('RLS unlinked teacher has no alternative permissive policy or anonymous grant', () => {
  assert.equal(policies.length, 5)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public\.study_sessions from public, anon, authenticated/)
  assert.doesNotMatch(sql, /using\s*\(true\)|grant[^;]+to (?:anon|public)\b/)
  const foundation = read('../sql/migrations/202608310001_role_auth_foundation.sql')
  const helper = foundation.slice(foundation.indexOf('create or replace function public.is_teacher_of'), foundation.indexOf('revoke all on function public.current_profile_role'))
  assert.match(helper, /student\.mentor_id = teacher\.id/)
  assert.match(helper, /teacher\.id = p_teacher_id/)
  assert.match(helper, /student\.id = p_student_id/)
})
test('migration preserves legacy data and validates topic ownership and counts', () => {
  assert.doesNotMatch(sql, /drop\s+(table|column)|(?:insert into|update|delete from|alter table) public\.(?:performance|exam_topic_performance)/)
  assert.match(sql, /topic\.id = new\.topic_id and topic\.subject_id = new\.subject_id/)
  assert.match(sql, /topic\.is_active and subject\.is_active/)
  assert.match(sql, /duration_minutes > 0/)
  for (const field of ['question_count', 'correct_count', 'wrong_count', 'blank_count']) assert.match(sql, new RegExp(`${field} integer check \\(${field} >= 0\\)`))
  assert.match(sql, /coalesce\(correct_count, 0\)::bigint[\s\S]*<= question_count/)
  assert.match(sql, /question_count is null and correct_count is null and wrong_count is null and blank_count is null/)
  assert.match(sql, /study_sessions\(student_id, study_date desc\)/)
  assert.doesNotMatch(sql, /unique\s*\(student_id, study_date\)/)
})
