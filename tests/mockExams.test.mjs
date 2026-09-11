import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function moduleAt(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('exports', 'module', output)(mod.exports, mod)
  return mod.exports
}
const { examNet, examTotal, validateMockExam, mergeAssessmentHistory, examHistory, latestExamSummary, previousExamDelta } = moduleAt('../src/lib/mockExams.ts')
const { calculateGoalProgress } = moduleAt('../src/lib/goalProgress.ts')
const catalog = { subjects: [{ id: 't', exam_type: 'TYT' }, { id: 'a', exam_type: 'AYT' }], topics: [{ id: 'topic', subject_id: 't' }] }
const result = (correct = 10, wrong = 4) => ({ subject_id: 't', correct_count: correct, wrong_count: wrong, blank_count: 2 })
const exam = (overrides = {}) => ({ id: 'e', student_id: 's', exam_type: 'TYT', exam_date: '2026-09-10', created_at: '2026-09-10T12:00:00Z', updated_at: '', name: null, difficulty: null, branch_subject_id: null, subject_results: [result()], topic_errors: [], ...overrides })
const legacy = [{ id: 'l', student_id: 's', date: '2026-09-11', created_at: null, daily_hours: 2, tyt_net: 80, ayt_net: 40 }]

test('net calculation preserves quarter points, negative net and zero vs no-data', () => {
  assert.equal(examNet(10, 3), 9.25)
  assert.equal(examNet(0, 4), -1)
  assert.equal(examTotal([result(1, 4)]), 0)
  assert.equal(examTotal([]), null)
  assert.deepEqual(latestExamSummary([]), { latest: null, delta: null })
  assert.equal(latestExamSummary(examHistory(mergeAssessmentHistory([], [exam({ subject_results: [result(1, 4)] })]), 'TYT')).latest.net, 0)
})
test('new assessment is authoritative per student and type, legacy preserved without double-count', () => {
  const rows = mergeAssessmentHistory(legacy, [exam()])
  assert.equal(examHistory(rows, 'TYT').length, 1)
  assert.equal(examHistory(rows, 'TYT')[0].net, 9)
  assert.equal(examHistory(rows, 'AYT')[0].net, 40)
  assert.equal(rows.reduce((sum, row) => sum + (row.daily_hours ?? 0), 0), 2)
  assert.equal(legacy[0].tyt_net, 80)
  assert.equal(examHistory(mergeAssessmentHistory(legacy, []), 'TYT')[0].net, 80)
  assert.equal(examHistory(mergeAssessmentHistory(legacy, [exam({ student_id: 'other' })]).filter(r => r.student_id === 's'), 'TYT')[0].net, 80)
})
test('latest TYT/AYT and trends order by exam date with stable ties', () => {
  const first = exam({ id: 'first', exam_date: '2026-09-01', subject_results: [result(5, 0)] })
  const last = exam({ id: 'last', subject_results: [result(20, 0)] })
  const ayt = exam({ id: 'ayt', exam_type: 'AYT', subject_results: [{ ...result(30, 0), subject_id: 'a' }] })
  const rows = mergeAssessmentHistory([], [last, ayt, first])
  const history = examHistory(rows, 'TYT')
  assert.deepEqual(history.map(r => r.net), [5, 20])
  assert.equal(latestExamSummary(history).delta, 15)
  assert.equal(latestExamSummary(examHistory(rows, 'AYT')).latest.net, 30)
  assert.equal(previousExamDelta(last, [last, first, exam({ id: 'other', student_id: 'other' })]), 15)
})
test('branch exams have exactly one matching subject and do not replace full exams', () => {
  const branch = exam({ exam_type: 'BRANCH', branch_subject_id: 't' })
  assert.doesNotThrow(() => validateMockExam(branch, catalog))
  assert.throws(() => validateMockExam({ ...branch, branch_subject_id: 'a' }, catalog))
  assert.throws(() => validateMockExam({ ...branch, subject_results: [result(), { ...result(), subject_id: 'a' }] }, catalog))
  assert.equal(examHistory(mergeAssessmentHistory(legacy, [branch]), 'TYT')[0].net, 80)
  assert.equal(previousExamDelta(branch, [branch, exam({ id: 'full' })]), null)
})
test('optional topic errors record only observed errors, cannot exceed subject counts', () => {
  assert.deepEqual(validateMockExam(exam(), catalog).topic_errors, [])
  const tag = { subject_id: 't', topic_id: 'topic', wrong_count: 2, blank_count: 1 }
  assert.deepEqual(validateMockExam(exam({ topic_errors: [tag] }), catalog).topic_errors, [tag])
  for (const change of [{ wrong_count: 5 }, { blank_count: 3 }, { wrong_count: 0, blank_count: 0 }, { topic_id: 'missing' }, { subject_id: 'a' }]) {
    assert.throws(() => validateMockExam(exam({ topic_errors: [{ ...tag, ...change }] }), catalog))
  }
  assert.throws(() => validateMockExam(exam({ topic_errors: [tag, tag] }), catalog))
  const data = readFileSync(new URL('../src/lib/mockExamData.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(data, /exam_topic_performance|calculateCompetency|strong/)
})
test('validation rejects invalid counts, dates, duplicated and mismatched subjects', () => {
  for (const count of [-1, 0.5, NaN, Infinity]) assert.throws(() => validateMockExam(exam({ subject_results: [result(count)] }), catalog))
  assert.throws(() => validateMockExam(exam({ exam_date: '2026-02-30' }), catalog))
  assert.throws(() => validateMockExam(exam({ subject_results: [result(), result()] }), catalog))
  assert.throws(() => validateMockExam(exam({ exam_type: 'AYT' }), catalog))
})
test('existing goal engine accepts authoritative zero TYT and fallback AYT', () => {
  const progress = calculateGoalProgress({ goal: { id: 'g', student_id: 's', goal_type: 'net', is_active: true, target_tyt_net: 50, target_ayt_net: 60 },
    performance: mergeAssessmentHistory(legacy, [exam({ subject_results: [result(1, 4)] })]), now: new Date('2026-09-11T12:00:00Z') })
  assert.equal(progress.metrics.tyt.current, 0)
  assert.equal(progress.metrics.tyt.remaining, 50)
  assert.equal(progress.metrics.ayt.current, 40)
})

const sql = readFileSync(new URL('../sql/migrations/202609110002_mock_exams.sql', import.meta.url), 'utf8')
for (const table of ['mock_exams', 'mock_exam_subject_results', 'mock_exam_topic_errors']) {
  test(`RLS contract: ${table} linked teacher read, unlinked deny, teacher write deny`, () => {
    assert.ok(sql.includes(`alter table public.${table} enable row level security`))
    const policies = [...sql.matchAll(new RegExp(`create policy (\\w+) on public\\.${table} for (all|select) to authenticated\\s+([\\s\\S]*?);`, 'g'))]
    assert.equal(policies.length, 2)
    const read = policies.find(p => p[1] === 'linked_teacher_read')
    assert.equal(read[2], 'select')
    assert.match(read[3], /current_profile_role\(\) = 'teacher' and/)
    assert.match(read[3], /is_teacher_of\(auth.uid\(\),/)
    const write = policies.find(p => p[1] === 'student_crud')
    assert.equal(write[2], 'all')
    assert.match(write[3], /with check/)
    assert.equal((write[3].match(/current_profile_role\(\) = 'student'/g) ?? []).length, 2)
    assert.doesNotMatch(write[3], /teacher/)
  })
}
test('atomic invoker RPC and database integrity contract', () => {
  assert.match(sql, /security invoker/)
  assert.match(sql, /is distinct from 'student'/)
  assert.match(sql, /unique \(exam_id, subject_id\)/)
  assert.match(sql, /unique \(exam_id, subject_id, topic_id\)/)
  assert.match(sql, /net numeric generated always/)
  assert.match(sql, /deferrable initially deferred/g)
  assert.doesNotMatch(sql, /drop table|truncate|delete from public.performance|exam_topic_performance/i)
})
