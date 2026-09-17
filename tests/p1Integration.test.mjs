import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { readFileSync } from 'node:fs'
import { loadTs } from './loadTs.mjs'

const { calculateStudentStatus, weeklyStudyComparison } = loadTs('src/lib/studentStatus.ts')
const { calculateGoalProgress } = loadTs('src/lib/goalProgress.ts')
const { calculateCompetencyMap } = loadTs('src/lib/competencyMap.ts')
const { calculateMentorAlerts } = loadTs('src/lib/mentorAlerts.ts')
const now = new Date('2026-09-12T12:00:00Z')
const study = (date, daily_hours) => ({ date, daily_hours })
function alertsFor(performance) {
  const status = calculateStudentStatus({ performance, tasks: [], meetings: [], now })
  const alerts = calculateMentorAlerts({ studentId: 's', studentStatus: status, performance, tasks: [], meetings: [], actionItems: [],
    goalProgress: calculateGoalProgress({ goal: null, performance, now }), competencySummary: calculateCompetencyMap([]), now })
  return { status, alerts }
}

test('study absence, explicit zero and a single-day decline remain distinct without RED', () => {
  const empty = alertsFor([])
  assert.equal(empty.status.metrics.weeklyStudy.current, null)
  const zero = alertsFor([study('2026-09-11', 0)])
  assert.equal(zero.status.metrics.weeklyStudy.current, 0)
  for (const performance of [[], [study('2026-09-11', 0)], [study('2026-09-01', 4), study('2026-09-03', 4), study('2026-09-11', 0)]]) {
    const { status, alerts } = alertsFor(performance)
    assert.equal(status.metrics.studyTrend, 'insufficient')
    assert.notEqual(status.level, 'red')
    assert.equal(alerts.alerts.filter(alert => alert.type === 'STUDY_DROP').length, 0)
  }
})

test('weekly study decline and recovery use recorded-day averages and produce one study warning', () => {
  const past = [study('2026-09-01', 4), study('2026-09-03', 4), study('2026-09-04', 4)]
  const decline = alertsFor([...past, study('2026-09-10', 0), study('2026-09-11', 0)])
  assert.equal(decline.status.metrics.studyTrend, 'down')
  assert.equal(decline.status.level, 'yellow')
  assert.equal(decline.alerts.alerts.filter(alert => alert.type === 'STUDY_DROP').length, 1)
  assert.equal(decline.status.warnings.filter(warning => warning.includes('çalışma süresi')).length, 1)
  assert.equal(new Set(decline.alerts.alerts.map(alert => alert.type)).size, decline.alerts.alerts.length)
  const sameAverage = alertsFor([...past, study('2026-09-10', 4), study('2026-09-11', 4)])
  assert.equal(sameAverage.status.metrics.studyTrend, 'stable')
  assert.equal(sameAverage.alerts.alerts.some(alert => alert.type === 'STUDY_DROP'), false)
  const recovery = alertsFor([study('2026-09-01', 0), study('2026-09-03', 0), study('2026-09-10', 4), study('2026-09-11', 4)])
  assert.equal(recovery.status.metrics.studyTrend, 'up')
  assert.equal(recovery.status.level, 'green')
  assert.equal(recovery.alerts.alerts.some(alert => alert.type === 'STUDY_DROP'), false)
})

test('timestamp-only study records use Istanbul calendar boundaries and invalid dates are not observations', () => {
  const comparison = weeklyStudyComparison([
    { created_at: '2026-09-05T22:00:00Z', daily_hours: 2 },
    { date: '2026-09-06', daily_hours: 1 },
    { date: '2026-09-99', daily_hours: 8 },
    { date: '2026-09-11-invalid', daily_hours: 8 },
  ], now)
  assert.equal(comparison.previous, null)
  assert.equal(comparison.current, 3)
  assert.equal(comparison.currentDays, 1)
  assert.equal(comparison.comparable, false)
})

function database(source, failures = {}) {
  const calls = []
  return { calls, from(table) {
    const filters = []
    const call = { table }
    let range
    return { select(columns) { call.columns = columns; return this },
      eq(key, value) { filters.push(row => row[key] === value); return this },
      in(key, values) { filters.push(row => values.includes(row[key])); return this },
      order() { return this }, range(start, end) { range = [start, end]; return this },
      then(resolve) {
        calls.push(call)
        let data = (source[table] ?? []).filter(row => filters.every(filter => filter(row)))
        if (range) data = data.slice(range[0], range[1] + 1)
        return Promise.resolve({ data, error: failures[table] ?? null }).then(resolve)
      },
    }
  } }
}
const catalog = { subjects: [{ id: 'math', exam_type: 'TYT', name: 'Matematik', is_active: true }], topics: [] }
function dashboardSource(count) {
  return { profiles: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, mentor_id: 'teacher', username: `Student ${i}`, created_at: null })),
    mock_exams: Array.from({ length: count }, (_, i) => ({ id: `e${i}`, student_id: `s${i}`, exam_type: 'TYT', exam_date: '2026-09-11',
      created_at: '2026-09-11T12:00:00Z', name: null, difficulty: null, branch_subject_id: null })),
    mock_exam_subject_results: Array.from({ length: count }, (_, i) => ({ id: `r${i}`, exam_id: `e${i}`, subject_id: 'math', correct_count: 20, wrong_count: 0, blank_count: 0 })),
    exam_subjects: catalog.subjects, exam_topics: [] }
}
function summaryLoader(db) {
  return loadTs('src/hooks/useMentorStudentSummaries.ts', {
    './supabase': { supabase: db, isSupabaseConfigured: true }, '../lib/supabase': { supabase: db, isSupabaseConfigured: true },
  }).loadMentorStudentSummaries
}

test('teacher summary query count stays constant from 1 to 25 students', async () => {
  const measurements = []
  for (const count of [1, 25]) {
    const db = database(dashboardSource(count))
    const students = await summaryLoader(db)('teacher')
    assert.equal(students.length, count)
    assert.ok(students.every(student => student.status.metrics.tyt.current === 20))
    measurements.push(db.calls.length)
    for (const table of ['tasks', 'meetings', 'student_goals', 'meeting_action_items']) {
      assert.equal(db.calls.filter(call => call.table === table).length, 1)
    }
    assert.ok(db.calls.filter(call => call.table === 'meetings').every(call => !/private|outcome_summary|\*/.test(call.columns)))
  }
  assert.equal(measurements[0], measurements[1])
  assert.equal(measurements[0], 18)
})

test('one invalid assessment and optional competency failure preserve other student summaries; core query errors remain errors', async () => {
  const source = dashboardSource(2)
  source.mock_exam_subject_results[0].correct_count = 400
  const db = database(source, { exam_topic_performance: new Error('unavailable') })
  const students = await summaryLoader(db)('teacher')
  assert.equal(students.length, 2)
  assert.equal(students[0].status.metrics.tyt.current, null)
  assert.equal(students[1].status.metrics.tyt.current, 20)
  assert.equal(students[1].competencyMap.hasReliableData, false)
  await assert.rejects(summaryLoader(database(source, { tasks: new Error('tasks unavailable') }))('teacher'), /tasks unavailable/)
})

function hookRuntime() {
  const slots = []
  let cursor = 0
  return { react: { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useEffect() {}, useMemo(fn) { return fn() }, useCallback(fn) { return fn },
  }, render(fn) { cursor = 0; return fn() } }
}

test('student meeting queries exclude private fields and never call private-note RPC; late teacher response cannot replace student data', async () => {
  const runtime = hookRuntime()
  const source = { meetings: [{ id: 'm', teacher_id: 't', student_id: 's', status: 'completed' }] }
  const db = database(source)
  let finishNote
  let noteCalls = 0
  db.rpc = (name, args) => {
    assert.equal(name, 'read_meeting_private_note')
    assert.deepEqual(args, { p_meeting_id: 'm' })
    noteCalls++
    return new Promise(resolve => { finishNote = resolve })
  }
  const { useMeetings } = loadTs('src/hooks/useMeetings.ts', { react: runtime.react, '../lib/supabase': { supabase: db } })
  const teacher = runtime.render(() => useMeetings('teacher', 't'))
  const pending = teacher.reload()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(noteCalls, 1)
  const student = runtime.render(() => useMeetings('student', 's'))
  await student.reload()
  finishNote({ data: 'PRIVATE_SENTINEL', error: null })
  await pending
  const loaded = runtime.render(() => useMeetings('student', 's'))
  assert.equal(loaded.meetings.length, 1)
  assert.doesNotMatch(JSON.stringify(loaded.meetings), /private_note|PRIVATE_SENTINEL/)
  assert.equal(noteCalls, 1)
  assert.ok(db.calls.every(call => !/private_note|outcome_summary|\*/.test(call.columns)))
  await runtime.render(() => useMeetings('student', 'other')).reload()
  assert.deepEqual(runtime.render(() => useMeetings('student', 'other')).meetings, [])
})

test('denied private-note reads expose no note and SQL authorization covers student, foreign mentor and revoked links', async () => {
  const runtime = hookRuntime()
  const db = database({ meetings: [{ id: 'm', teacher_id: 't', student_id: 's', status: 'completed' }] })
  db.rpc = async () => ({ data: null, error: { code: '42501' } })
  const { useMeetings } = loadTs('src/hooks/useMeetings.ts', { react: runtime.react, '../lib/supabase': { supabase: db } })
  await runtime.render(() => useMeetings('teacher', 't')).reload()
  const result = runtime.render(() => useMeetings('teacher', 't'))
  assert.deepEqual(result.meetings, [])
  assert.ok(result.error)
  assert.equal(result.loading, false)
  const sql = readFileSync('sql/migrations/202609120001_meeting_private_notes.sql', 'utf8')
  for (const name of ['read_meeting_private_note', 'save_meeting_outcome_summary']) {
    const body = sql.slice(sql.indexOf(`function public.${name}`)).split('end; $$;')[0]
    assert.match(body, /auth.uid\(\) is null/)
    assert.match(body, /current_profile_role\(\) is distinct from 'teacher'/)
    assert.match(body, /m.teacher_id <> auth.uid\(\)/)
    assert.match(body, /not public.is_teacher_of\(auth.uid\(\), m.student_id\)/)
    assert.match(body, /errcode = '42501'/)
  }
  assert.match(sql, /revoke select on public.meetings from public, anon, authenticated/)
  assert.match(sql, /revoke select \(outcome_summary\)/)
})

test('canonical goal uses the unique active record, never archived recency or input order', () => {
  const { selectCurrentGoal } = loadTs('src/lib/goalSelection.ts')
  const active = { id: 'active', student_id: 's', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01', target_tyt_net: 40, target_ayt_net: null }
  const archived = { ...active, id: 'archived', is_active: false, updated_at: '2026-09-12' }
  const other = { ...active, student_id: 'other', id: 'other' }
  assert.equal(selectCurrentGoal([active], 's'), active)
  for (const rows of [[archived, active, other], [other, active, archived], [active, { ...archived, updated_at: active.updated_at }]]) {
    const selected = selectCurrentGoal(rows, 's')
    assert.equal(selected, active)
    const progress = calculateGoalProgress({ goal: selected, performance: [{ tyt_net: 20, date: '2026-09-11' }], now })
    assert.equal(progress.metrics.tyt.current, 20)
    assert.equal(progress.metrics.tyt.remaining, 20)
    assert.equal(progress.metrics.tyt.hasTrendData, false)
  }
  assert.equal(selectCurrentGoal([archived, other], 's'), null)
  assert.equal(selectCurrentGoal([], 's'), null)
  for (const rows of [[active, { ...active, id: 'duplicate' }], [{ ...active, id: 'duplicate' }, active]]) {
    assert.throws(() => selectCurrentGoal(rows, 's'), /birden fazla aktif hedef/)
  }
  const sql = readFileSync('sql/migrations/202608310003_goal_progress_roadmap.sql', 'utf8')
  const statements = sql.replace(/--[^\n]*/g, '').split(';')
  const activeIndex = statements.find(statement => /\bcreate\s+unique\s+index\b/i.test(statement)
    && /\bon\s+public\s*\.\s*student_goals\s*\(\s*student_id\s*\)/i.test(statement)
    && /\bwhere\s+is_active\s*$/i.test(statement))
  assert.ok(activeIndex, 'student_goals must enforce one active goal per student with a partial unique index')
  for (const file of ['src/hooks/useGoalProgress.ts', 'src/hooks/useMentorStudentSummaries.ts', 'src/hooks/useMeetingGuidance.ts', 'supabase/functions/mentor-ai-insight/index.ts']) {
    assert.match(readFileSync(file, 'utf8'), /goal: selectCurrentGoal|setGoal\(selectCurrentGoal/)
  }
})

function findElement(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) {
    const match = findElement(child, predicate)
    if (match) return match
  }
  return null
}
function registerUI(register, resend = async () => ({ error: null })) {
  const runtime = hookRuntime(), errors = [], navigations = []
  const Register = loadTs('src/pages/Auth/Register.tsx', {
    react: runtime.react, 'react-router-dom': { Link: 'a', useNavigate: () => (...args) => navigations.push(args) },
    '../../hooks/useAuth': { useAuth: () => ({ register }) },
    '../../components/ui/ToastButton': { showError: error => errors.push(error), showSuccess() {} },
    '../../lib/supabase': { supabase: { auth: { resend } } },
  }).default
  const render = () => runtime.render(() => Register())
  const set = (id, value) => findElement(render(), node => node.props?.id === id).props.onChange({ target: { value } })
  set('register-field-1', 'Ada'); set('register-field-2', 'ada@example.test'); set('register-field-3', 'password123')
  return { render, set, errors, navigations,
    teacher() { findElement(render(), node => node.props?.type === 'radio' && node.props.value === 'teacher').props.onChange(); set('register-field-5', 'invite-secret') },
    submit() { return findElement(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }) },
  }
}

test('signup confirmation stays on success screen, blocks simultaneous submits and preserves teacher reentry', async () => {
  let finish, calls = 0
  const ui = registerUI(input => { calls++; assert.equal(input.role, 'teacher'); assert.equal(input.teacher_invite_code, 'invite-secret'); return new Promise(resolve => { finish = resolve }) })
  ui.teacher()
  const submit = findElement(ui.render(), node => node.type === 'form').props.onSubmit
  const first = submit({ preventDefault() {} })
  await submit({ preventDefault() {} })
  assert.equal(calls, 1)
  assert.equal(findElement(ui.render(), node => node.props?.type === 'submit').props.loading, true)
  finish({ requiresEmailConfirmation: true, requiresTeacherInviteReentry: true })
  await first
  const screen = ui.render()
  assert.equal(screen.props.role, 'status')
  assert.equal(findElement(screen, node => typeof node.props?.onClick === 'function').props.loading, false)
  assert.equal(ui.navigations.length, 0)
  assert.ok(findElement(screen, node => node.props?.to === '/login?teacherInvite=required'))
  assert.ok(JSON.stringify(screen).includes('Hesabınızı etkinleştirmek için e-posta adresinize gönderilen doğrulama bağlantısını açın.'))
  assert.doesNotMatch(JSON.stringify(screen), /password123|invite-secret/)
})

test('signup session success redirects by verified role; errors and rejected requests release loading for retry', async () => {
  for (const role of ['student', 'teacher']) {
    const ui = registerUI(async () => ({ user: { role } }))
    await ui.submit()
    assert.equal(ui.navigations[0][0], `/${role}`)
    assert.deepEqual(ui.navigations[0][1], { replace: true })
    assert.equal(findElement(ui.render(), node => node.props?.type === 'submit').props.loading, false)
  }
  for (const failure of [async () => ({ error: new Error('invalid') }), async () => { throw new Error('network') }]) {
    let calls = 0
    const ui = registerUI(() => { calls++; return failure() })
    await ui.submit()
    assert.equal(ui.errors.length, 1)
    assert.equal(ui.navigations.length, 0)
    assert.equal(findElement(ui.render(), node => node.props?.type === 'submit').props.loading, false)
    await ui.submit()
    assert.equal(calls, 2)
  }
})

test('confirmation resend is single-flight, errors allow retry and success disables further sends', async () => {
  let finish, calls = 0
  const ui = registerUI(async () => ({ requiresEmailConfirmation: true }), input => {
    calls++; assert.deepEqual(input, { type: 'signup', email: 'ada@example.test' })
    return new Promise(resolve => { finish = resolve })
  })
  await ui.submit()
  const button = () => findElement(ui.render(), node => typeof node.props?.onClick === 'function')
  const first = button().props.onClick()
  await button().props.onClick()
  assert.equal(calls, 1)
  finish({ error: new Error('Too many requests') })
  await first
  assert.equal(ui.errors.length, 1)
  assert.equal(button().props.loading, false)
  const retry = button().props.onClick()
  finish({ error: null })
  await retry
  assert.equal(button().props.disabled, true)
  await button().props.onClick()
  assert.equal(calls, 2)
})

test('auth signup keeps role/invite secrets out of metadata and redeems teacher invite only with a session', async () => {
  for (const role of ['student', 'teacher']) for (const session of [null, { access_token: 'session' }]) {
    const runtime = hookRuntime(), calls = []
    const db = { auth: {
      signUp: async input => { calls.push(['signup', input]); return { data: { user: { id: 's' }, session }, error: null } },
      signOut: async () => { calls.push(['signout']) },
    }, rpc: async (name, args) => { calls.push([name, args]); return { error: null } },
    from(table) { assert.equal(table, 'profiles'); return { select() { return this }, eq() { return this },
      maybeSingle: async () => ({ data: { id: 's', role, username: 'Ada' }, error: null }) } } }
    const { AuthProvider } = loadTs('src/context/AuthContext.tsx', { react: runtime.react, '../lib/supabase': { supabase: db, isSupabaseConfigured: true } })
    const auth = runtime.render(() => AuthProvider({ children: null })).props.value
    const result = await auth.register({ username: 'Ada', email: 'ada@example.test', password: 'password123', role,
      teacher_invite_code: ' invite ', mentor_join_code: ' mentor ' })
    assert.deepEqual(calls[0][1].options, { data: { username: 'Ada' } })
    if (!session) {
      assert.equal(result.requiresEmailConfirmation, true)
      assert.equal(result.requiresTeacherInviteReentry, role === 'teacher')
      assert.equal(calls.length, 1)
      assert.equal(runtime.render(() => AuthProvider({ children: null })).props.value.user, null)
    } else {
      assert.equal(result.user.role, role)
      assert.deepEqual(calls[1], role === 'teacher' ? ['redeem_teacher_registration_invite', { p_code: 'invite' }] : ['join_teacher_by_code', { p_code: 'mentor' }])
    }
  }
})
