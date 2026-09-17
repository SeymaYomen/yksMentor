import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './loadTs.mjs'

const exams = loadTs('src/lib/mockExams.ts')
const study = loadTs('src/lib/studySessions.ts')
const { calculateStudentStatus } = loadTs('src/lib/studentStatus.ts')
const { calculateGoalProgress, validateGoalInput } = loadTs('src/lib/goalProgress.ts')
const { calculateCompetencyMap } = loadTs('src/lib/competencyMap.ts')
const { calculateMentorAlerts } = loadTs('src/lib/mentorAlerts.ts')
const { buildMeetingBriefing } = loadTs('src/lib/meetingBriefing.ts')
const { buildAIMentorContext, createAIMentorContextFingerprint } = loadTs('src/lib/aiMentorContext.ts')
const now = new Date('2026-09-12T12:00:00Z')
const catalog = { subjects: [{ id: 'math', name: 'Matematik', exam_type: 'TYT', is_active: true, sort_order: 1 },
  { id: 'turkish', name: 'Türkçe', exam_type: 'TYT', is_active: true, sort_order: 2 }],
  topics: [{ id: 'topic', subject_id: 'math', name: 'Problemler', is_active: true, sort_order: 1 }] }
const result = (correct = 30, wrong = 0, blank = 0) => ({ subject_id: 'math', correct_count: correct, wrong_count: wrong, blank_count: blank })
const exam = (overrides = {}) => ({ id: 'exam1', student_id: 's', exam_type: 'TYT', exam_date: '2026-09-11',
  name: null, difficulty: null, branch_subject_id: null, created_at: '2026-09-11T12:00:00Z', updated_at: '',
  subject_results: [result()], topic_errors: [], ...overrides })
const legacy = (overrides = {}) => ({ id: 'legacy', student_id: 's', date: '2026-09-10', created_at: null,
  tyt_net: 80, ayt_net: 0, daily_hours: 4, ...overrides })
const goal = { student_id: 's', is_active: true, target_tyt_net: 50, target_ayt_net: 50,
  target_rank: 10000, target_score: null, target_date: null }
function derived(performance, topics = []) {
  const status = calculateStudentStatus({ performance, tasks: [], meetings: [], now })
  const progress = calculateGoalProgress({ goal, performance, studentStatus: status, now })
  const competency = calculateCompetencyMap(topics)
  const alerts = calculateMentorAlerts({ studentId: 's', studentStatus: status, goalProgress: progress,
    competencySummary: competency, performance, tasks: [], meetings: [], actionItems: [], now })
  const briefing = buildMeetingBriefing({ targetMeeting: { id: 'm', status: 'scheduled' }, studentStatus: status,
    goalProgress: progress, performance, tasks: [], meetings: [], actionItems: [], now })
  return { status, progress, competency, alerts, briefing }
}
const canonical = (rows, old = []) => exams.mergeAssessmentHistory(old, rows, catalog)

test('every canonical TYT/AYT subject enforces exact, below and above limits in domain and UI validation', () => {
  for (const [exam_type, subjects] of Object.entries(exams.EXAM_QUESTION_LIMITS)) {
    for (const [name, limit] of Object.entries(subjects)) {
      const subject = { id: 'subject', name, exam_type }
      const localCatalog = { subjects: [subject], topics: [] }
      for (const [correct, wrong, blank, valid] of [[limit - 2, 1, 1, true], [limit - 2, 0, 1, true], [limit, 1, 0, false], [-1, 0, 0, false], [0, 0.5, 0, false], [0, 0, -1, false]]) {
        const row = { subject_id: subject.id, correct_count: correct, wrong_count: wrong, blank_count: blank }
        const check = () => exams.validateMockExam(exam({ exam_type, subject_results: [row] }), localCatalog)
        assert.equal(exams.subjectResultError(row, localCatalog) === null, valid, `${exam_type}/${name}`)
        if (valid) assert.doesNotThrow(check)
        else assert.throws(check)
      }
    }
  }
})

test('goal current, gap, percentage and trend remain independent for zero, one, two and completed assessments', () => {
  const { netProgressPercent } = loadTs('src/lib/goalPresentation.ts')
  for (const [values, current, remaining, percent, trend] of [
    [[], null, null, null, false], [[0], 0, 30, 0, false], [[15], 15, 15, 50, false],
    [[15, 24], 24, 6, 80, true], [[30], 30, 0, 100, false], [[35], 35, 0, 100, false],
  ]) {
    const progress = calculateGoalProgress({ goal: { ...goal, target_tyt_net: 30, target_ayt_net: null },
      performance: values.map((tyt_net, i) => ({ tyt_net, date: `2026-09-${10 + i}` })), now })
    const metric = progress.metrics.tyt
    assert.equal(metric.current, current)
    assert.equal(metric.remaining, remaining)
    assert.equal(netProgressPercent(metric), percent)
    assert.equal(metric.hasTrendData, trend)
    if (current !== null && current < 30 && !trend) assert.match(progress.label, /Güncel net mevcut/)
  }
})

test('briefing retains assessments older than its activity period and labels latest-pair delta accurately', () => {
  const rows = canonical([exam({ id: 'old', exam_date: '2026-07-01', subject_results: [result(10)] }),
    exam({ exam_date: '2026-07-02', subject_results: [result(20)] })], [legacy()])
  const data = derived(rows)
  assert.equal(data.briefing.performance.tyt.current, 20)
  assert.equal(data.briefing.performance.tyt.delta, 10)
  assert.equal(exams.examHistory(rows, 'TYT').length, 2)
  const Panel = loadTs('src/components/meetings/MeetingBriefingPanel.tsx').default
  const html = renderToStaticMarkup(React.createElement(Panel, { briefing: data.briefing, loading: false, error: null }))
  assert.match(html, /Son iki deneme:/)
  assert.match(html, /Güncel net mevcut/)
})

test('mounted assessment summary reloads after performance updates and ignores stale responses after refresh/unmount', async () => {
  const pending = [], writes = [], effects = []
  const events = new EventTarget()
  const previousWindow = globalThis.window
  globalThis.window = events
  const Summary = loadTs('src/components/student/MockExamSummary.tsx', {
    react: { ...React, useState: initial => [initial, value => writes.push(value)], useEffect: effect => effects.push(effect) },
    '../../lib/mockExamData': { loadAssessmentData: ids => { assert.deepEqual(ids, ['s']); return new Promise(resolve => pending.push(resolve)) } },
  }).default
  let cleanup
  try {
    Summary({ studentId: 's' })
    cleanup = effects[0]()
    events.dispatchEvent(new Event('performance_updated'))
    assert.equal(pending.length, 2)
    pending[1]({ performance: ['new'] })
    await new Promise(resolve => setImmediate(resolve))
    pending[0]({ performance: ['old'] })
    await new Promise(resolve => setImmediate(resolve))
    assert.ok(writes.some(value => Array.isArray(value) && value[0] === 'new'))
    assert.ok(!writes.some(value => Array.isArray(value) && value[0] === 'old'))
    events.dispatchEvent(new Event('performance_updated'))
    cleanup()
    const count = writes.length
    pending[2]({ performance: ['unmounted'] })
    await new Promise(resolve => setImmediate(resolve))
    events.dispatchEvent(new Event('performance_updated'))
    assert.equal(pending.length, 3)
    assert.equal(writes.length, count)
  } finally { cleanup?.(); globalThis.window = previousWindow }
})

test('subject limits reject over-total, fractions and negative counts, while exact limits and real zero pass', () => {
  for (const row of [result(40, 1), result(39, 0, 2), result(-1), result(0.5)]) {
    assert.throws(() => exams.validateMockExam(exam({ subject_results: [row] }), catalog))
  }
  assert.doesNotThrow(() => exams.validateMockExam(exam({ subject_results: [result(40)] }), catalog))
  assert.equal(exams.examTotal([result(1, 4)]), 0)
  assert.equal(exams.examTotal([]), null)
})

test('invalid create/edit is blocked before RPC and never overwrites the existing record', async () => {
  let calls = 0
  const { saveMockExam } = loadTs('src/lib/mockExamData.ts', { './supabase': { supabase: { rpc() { calls++; return { data: 'ok', error: null } } } } })
  await assert.rejects(saveMockExam(exam({ subject_results: [result(41)] }), catalog, 'existing'))
  assert.equal(calls, 0)
  await saveMockExam(exam({ subject_results: [result(0, 0, 0)] }), catalog)
  assert.equal(calls, 1)
})

test('one mock is the latest result across status, goal and briefing, with no trend', () => {
  const data = derived(canonical([exam()], [legacy()]))
  assert.equal(data.status.metrics.tyt.current, 30)
  assert.equal(data.status.metrics.tyt.delta, null)
  assert.equal(data.progress.metrics.tyt.current, 30)
  assert.equal(data.progress.metrics.tyt.remaining, 20)
  assert.equal(data.briefing.performance.tyt.current, 30)
  assert.equal(data.briefing.performance.tyt.delta, null)
  assert.equal(data.briefing.performance.tyt.hasData, true)
  assert.equal(data.progress.metrics.ayt.current, null)
})

test('two mocks yield the same latest delta in teacher status and briefing, preserving quarter nets', () => {
  const data = derived(canonical([exam({ id: 'old', exam_date: '2026-09-09', subject_results: [result(20, 1)] }), exam()]))
  assert.equal(data.status.metrics.tyt.delta, 10.25)
  assert.equal(data.briefing.performance.tyt.delta, 10.25)
  assert.equal(data.progress.metrics.tyt.change30Days, 10.25)
})

test('fallback is per type, zeros without legacy event provenance are absent, invalid legacy values are ignored', () => {
  const rows = canonical([exam()], [legacy({ ayt_net: 45 })])
  assert.equal(exams.examHistory(rows, 'TYT').length, 1)
  assert.equal(exams.latestExamSummary(exams.examHistory(rows, 'AYT')).latest.net, 45)
  assert.equal(exams.examHistory(canonical([], [legacy({ tyt_net: 121, ayt_net: 81 })]), 'TYT').length, 0)
  assert.equal(exams.examHistory(canonical([], [legacy()]), 'AYT').length, 0)
})

test('invalid old mock stays out of canonical metrics and does not resurrect same-type legacy', () => {
  const rows = canonical([exam({ subject_results: [result(400)] })], [legacy()])
  assert.equal(exams.examHistory(rows, 'TYT').length, 0)
})

test('real zero and absent AYT render correctly in goal, teacher summary and briefing', () => {
  const data = derived(canonical([exam({ subject_results: [result(1, 4)] })]))
  const GoalCard = loadTs('src/components/goals/GoalProgressCard.tsx').default
  const Summary = loadTs('src/components/teacher/MentorSummary.tsx').default
  const Briefing = loadTs('src/components/meetings/MeetingBriefingPanel.tsx').default
  const card = renderToStaticMarkup(React.createElement(GoalCard, { studentId: 's', progress: data.progress }))
  assert.match(card, /0,00 \/ 50/)
  assert.match(card, /Henüz AYT denemesi yok/)
  const summary = renderToStaticMarkup(React.createElement(Summary, { displayName: 'Ada', status: data.status,
    goalProgress: data.progress, competencyMap: data.competency, alerts: data.alerts }))
  assert.match(summary, /0,00/)
  assert.match(summary, /Trend için bir deneme daha gerekli/)
  const briefing = renderToStaticMarkup(React.createElement(Briefing, { briefing: data.briefing, loading: false, error: null }))
  assert.match(briefing, /Trend için bir deneme daha gerekli/)
  assert.match(briefing, /Henüz AYT denemesi yok/)
})

test('one 30-minute session supersedes legacy study, remains visible in briefing and produces no decline alarm', () => {
  const rows = study.mergeStudyHours(canonical([], [legacy()]), [{ student_id: 's', study_date: '2026-09-11', duration_minutes: 30 }])
  const data = derived(rows)
  assert.equal(data.briefing.performance.weeklyStudyHours.current, 0.5)
  assert.equal(data.briefing.performance.weeklyStudyHours.delta, null)
  assert.equal(data.status.metrics.studyHours.trend, 'insufficient')
  assert.equal(data.alerts.alerts.some(alert => alert.type === 'STUDY_DROP'), false)
})

test('four distinct study days across comparable windows permit a real decline alarm', () => {
  const sessions = ['2026-09-01', '2026-09-03', '2026-09-09', '2026-09-11'].map((study_date, i) =>
    ({ student_id: 's', study_date, duration_minutes: i < 2 ? 240 : 30 }))
  const data = derived(study.mergeStudyHours([], sessions))
  assert.equal(data.status.metrics.weeklyStudy.previousDays, 2)
  assert.equal(data.status.metrics.weeklyStudy.currentDays, 2)
  assert.equal(data.alerts.alerts.find(alert => alert.type === 'STUDY_DROP').severity, 'high')
  const sameDay = sessions.map(row => ({ ...row, study_date: '2026-09-11' }))
  assert.equal(derived(study.mergeStudyHours([], sameDay)).alerts.alerts.some(alert => alert.type === 'STUDY_DROP'), false)
})

const tagged = overrides => exam({ subject_results: [result(10, 1)], topic_errors: [{ subject_id: 'math', topic_id: 'topic', wrong_count: 1, blank_count: 0 }], ...overrides })
test('single topic error is neutral; two distinct exams allow attention, duplicate event and practice do not', () => {
  const one = exams.mockTopicSignals([tagged()], catalog)
  assert.equal(calculateCompetencyMap(one).weak.length, 0)
  assert.equal(calculateCompetencyMap([...one, ...one]).weak.length, 0)
  const practice = { ...one[0], evidenceKind: 'practice_topic', correctCount: 100, wrongCount: 0 }
  assert.equal(calculateCompetencyMap([practice]).hasReliableData, false)
  assert.equal(calculateCompetencyMap([...one, practice]).weak.length, 0)
  const two = exams.mockTopicSignals([tagged(), tagged({ id: 'exam2' })], catalog)
  assert.equal(calculateCompetencyMap(two).weak.length, 1)
  assert.equal(calculateCompetencyMap(two).weak[0].score, null)
  assert.deepEqual(exams.mockTopicSignals([exam()], catalog), [])
})

test('canonical university/program are independent optional dimensions; random names cannot save', () => {
  for (const input of [{ universityName: 'asdf üniversitesi' }, { programName: 'xyz mühendisliği' }])
    assert.ok(validateGoalInput({ goalType: 'university_program', ...input }).length)
  for (const input of [{ universityName: 'Ankara Üniversitesi' }, { programName: 'Bilgisayar Mühendisliği' }, { targetTytNet: 0 }])
    assert.deepEqual(validateGoalInput({ goalType: 'net', ...input }), [])
  assert.ok(validateGoalInput({ goalType: 'net' }).length)
})

test('weekly AI snapshot is deterministic and carries authoritative latest, study, gaps and limited evidence', async () => {
  const data = derived(study.mergeStudyHours(canonical([tagged()]), [{ student_id: 's', study_date: '2026-09-11', duration_minutes: 30 }]), exams.mockTopicSignals([tagged()], catalog))
  const input = { displayName: 'Ada', studentStatus: data.status, goalProgress: data.progress, competencyMap: data.competency, mentorAlerts: data.alerts }
  const first = buildAIMentorContext(input)
  assert.equal(first.weeklySnapshot.study.current, 0.5)
  assert.equal(first.weeklySnapshot.study.comparable, false)
  assert.equal(first.weeklySnapshot.latestTYT, 9.75)
  assert.equal(first.weeklySnapshot.latestAYT, null)
  assert.equal(first.weeklySnapshot.tytGoalGap, 40.25)
  assert.equal(first.weeklySnapshot.limitedTopicEvidence.length, 1)
  assert.equal(first.recentChanges.tytChange, null)
  assert.equal(await createAIMentorContextFingerprint(first), await createAIMentorContextFingerprint(buildAIMentorContext(input)))
})

function dbFor(source) {
  return { from(table) {
    let filters = [], range = null
    return { select() { return this }, order() { return this }, eq(key, value) { filters.push(row => row[key] === value); return this },
      in(key, values) { filters.push(row => values.includes(row[key])); return this }, range(a, b) { range = [a, b]; return this },
      then(resolve) { let rows = (source[table] ?? []).filter(row => filters.every(filter => filter(row))); if (range) rows = rows.slice(range[0], range[1] + 1); return Promise.resolve({ data: rows, error: null }).then(resolve) } }
  } }
}
test('assessment loader sees saved and deleted rows on reload, isolates students and propagates query errors', async () => {
  const source = { performance: [legacy({ ayt_net: 25 })], mock_exams: [], mock_exam_subject_results: [],
    mock_exam_topic_errors: [], exam_subjects: catalog.subjects, exam_topics: catalog.topics }
  const db = dbFor(source)
  const { loadAssessmentData } = loadTs('src/lib/mockExamData.ts', { './supabase': { supabase: db, isSupabaseConfigured: true } })
  assert.equal(exams.examHistory((await loadAssessmentData(['s'])).performance, 'TYT')[0].net, 80)
  source.mock_exams.push(exam(), exam({ id: 'other', student_id: 'other' }))
  source.mock_exam_subject_results.push({ ...result(), id: 'r', exam_id: 'exam1' })
  const saved = await loadAssessmentData(['s'])
  assert.equal(saved.exams.length, 1)
  assert.equal(exams.examHistory(saved.performance, 'TYT')[0].net, 30)
  assert.equal(derived(saved.performance).briefing.performance.tyt.current, 30)
  assert.equal(exams.examHistory(saved.performance, 'AYT')[0].net, 25)
  source.mock_exams = []
  assert.equal(exams.examHistory((await loadAssessmentData(['s'])).performance, 'TYT')[0].net, 80)
  const broken = loadTs('src/lib/mockExamData.ts', { './supabase': { supabase: { from() {
    return { select() { return this }, in() { return this }, order() { return this }, range() { return Promise.resolve({ data: null, error: new Error('read failed') }) } }
  } }, isSupabaseConfigured: true } })
  await assert.rejects(broken.loadAssessmentData(['s']), /read failed/)
})
test('teacher summary loader and Edge loader consume the same canonical mock/session sources', async () => {
  const parent = exam()
  const source = { profiles: [{ id: 's', username: 'Ada', created_at: null, mentor_id: 'teacher' }], performance: [legacy()],
    mock_exams: [parent], mock_exam_subject_results: [{ ...result(), id: 'r', exam_id: parent.id }], mock_exam_topic_errors: [],
    study_sessions: [{ id: 'session', student_id: 's', study_date: '2026-09-11', duration_minutes: 30 }], student_goals: [goal],
    exam_subjects: catalog.subjects, exam_topics: catalog.topics }
  const db = dbFor(source)
  const overrides = { '../lib/supabase': { supabase: db, isSupabaseConfigured: true }, './supabase': { supabase: db, isSupabaseConfigured: true } }
  const { loadMentorStudentSummaries } = loadTs('src/hooks/useMentorStudentSummaries.ts', overrides)
  const summaries = await loadMentorStudentSummaries('teacher')
  assert.equal(summaries[0].status.metrics.tyt.current, 30)
  assert.equal(summaries[0].goalProgress.metrics.tyt.current, 30)
  const { loadMentorProgressData } = loadTs('supabase/functions/_shared/mentorProgressData.ts')
  const edge = await loadMentorProgressData(db, 's')
  assert.equal(exams.latestExamSummary(exams.examHistory(edge.performance, 'TYT')).latest.net, 30)
  assert.equal(edge.performance.reduce((sum, row) => sum + (row.daily_hours ?? 0), 0), 0.5)
})

test('teacher list supports 25 students, Turkish search and independent attention/meeting filters', () => {
  const { filterMentorStudents } = loadTs('src/lib/teacherOverview.ts')
  const data = derived([])
  const students = Array.from({ length: 25 }, (_, i) => ({ id: String(i), username: i === 0 ? 'İpek' : `Öğrenci ${i}`, status: data.status, alerts: data.alerts }))
  students[1] = { ...students[1], alerts: { ...data.alerts, alerts: [{ type: 'DATA_GAP' }] } }
  students[2] = { ...students[2], alerts: { ...data.alerts, alerts: [{ type: 'FOLLOWUP_OVERDUE' }] } }
  students[3] = { ...students[3], status: { ...data.status, metrics: { ...data.status.metrics, nextMeetingAt: '2026-09-13T12:00:00Z' } } }
  assert.equal(filterMentorStudents(students, '', 'all', now).length, 25)
  assert.equal(filterMentorStudents(students, 'ipek', 'all', now)[0].id, '0')
  assert.deepEqual(filterMentorStudents(students, '', 'attention', now).map(row => row.id), ['2'])
  assert.deepEqual(filterMentorStudents(students, '', 'meeting', now).map(row => row.id), ['3'])
})

const read = path => readFileSync(path, 'utf8')
test('private note migration revokes shared legacy column access and permits only linked teacher RPC/RLS', () => {
  const sql = read('sql/migrations/202609120001_meeting_private_notes.sql')
  assert.match(sql, /revoke select on public.meetings from public, anon, authenticated/)
  assert.match(sql, /revoke select \(outcome_summary\)/)
  assert.match(sql, /meeting_private_notes enable row level security/)
  assert.match(sql, /teacher_id = auth.uid\(\)/)
  assert.match(sql, /current_profile_role\(\) is distinct from 'teacher'/)
  assert.match(sql, /not public.is_teacher_of\(auth.uid\(\), m.student_id\)/)
  assert.doesNotMatch(sql, /update public.meetings|delete from public.meetings|grant select \(outcome_summary\)/i)
  assert.equal((sql.match(/create policy/g) ?? []).length, 1)
  const followup = read('sql/migrations/202608310002_meeting_briefing_followup.sql')
  assert.match(followup, /Students can view own meeting action items[\s\S]*auth.uid\(\) = student_id/)
})

test('student meeting outcome renders shared followup and never private text', () => {
  const Panel = loadTs('src/components/meetings/MeetingOutcomePanel.tsx').default
  const props = { meeting: { id: 'm', private_note: 'PRIVATE_SENTINEL' }, items: [{ id: 'item', item_text: 'Paylaşılan takip', status: 'open', kind: 'followup' }],
    isTeacher: false, onSaveSummary() {}, onCreateItem() {}, onUpdateItemStatus() {} }
  const student = renderToStaticMarkup(React.createElement(Panel, props))
  assert.doesNotMatch(student, /PRIVATE_SENTINEL/)
  assert.match(student, /Paylaşılan takip/)
  assert.match(renderToStaticMarkup(React.createElement(Panel, { ...props, isTeacher: true })), /PRIVATE_SENTINEL/)
})

test('signup confirmation has a persistent success screen and normalized resend errors; saves guard duplicate clicks', () => {
  const signup = read('src/pages/Auth/Register.tsx')
  assert.match(signup, /if \(confirmation\) return/)
  assert.match(signup, /Hesabın oluşturuldu/)
  assert.match(signup, /Devam etmek için e-posta adresini doğrula/)
  assert.match(signup, /auth.resend\(\{ type: 'signup'/)
  assert.doesNotMatch(signup, /result.error.message/)
  for (const file of ['src/pages/Student/MockExams.tsx', 'src/components/student/PerformanceForm.tsx'])
    assert.match(read(file), /if \(submitting.current\) return/)
})
