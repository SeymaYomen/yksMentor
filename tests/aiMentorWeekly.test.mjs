import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { loadTs } from './loadTs.mjs'

const contextApi = loadTs('src/lib/aiMentorContext.ts')
const { aiMentorWeekKey, buildAIMentorContext, createAIMentorContextFingerprint: fingerprint, insufficientAIMentorInsight } = contextApi
const { calculateStudentStatus } = loadTs('src/lib/studentStatus.ts')
const { calculateGoalProgress } = loadTs('src/lib/goalProgress.ts')
const { selectCurrentGoal } = loadTs('src/lib/goalSelection.ts')
const { calculateCompetencyMap } = loadTs('src/lib/competencyMap.ts')
const { calculateMentorAlerts } = loadTs('src/lib/mentorAlerts.ts')
const { parseAIMentorInsight, parseAIMentorInsightResponse } = loadTs('src/lib/aiMentorOutput.ts')
const now = new Date('2026-09-16T12:00:00Z')
const active = { id: 'active', student_id: 's', is_active: true, goal_type: 'net', score_type: 'sayisal',
  target_tyt_net: 60, target_ayt_net: null, target_rank: null, target_score: null,
  university_name: null, program_name: null, target_date: '2027-06-01', created_at: '2026-01-01', updated_at: '2026-01-01' }
const archived = { ...active, id: 'archived', is_active: false, updated_at: '2026-09-16', target_tyt_net: 120 }
function context({ performance = [], tasks = [], meetings = [], goals = [], actionItems = [], date = now } = {}) {
  const studentStatus = calculateStudentStatus({ performance, tasks, meetings, now: date })
  const goalProgress = calculateGoalProgress({ goal: selectCurrentGoal(goals, 's'), performance, studentStatus, now: date })
  const competencyMap = calculateCompetencyMap([])
  const mentorAlerts = calculateMentorAlerts({ studentId: 's', studentCreatedAt: date.toISOString(), studentStatus,
    goalProgress, competencySummary: competencyMap, performance, tasks, meetings, actionItems, now: date })
  return buildAIMentorContext({ displayName: 'Ada', studentStatus, goalProgress, competencyMap, mentorAlerts, now: date })
}

test('weekly identity uses Istanbul Sunday/Monday boundary, same-week days and year rollover', () => {
  assert.equal(aiMentorWeekKey(new Date('2026-09-13T20:59:59Z')), '2026-09-07')
  assert.equal(aiMentorWeekKey(new Date('2026-09-13T21:00:00Z')), '2026-09-14')
  for (const value of ['2026-09-14T01:00:00Z', '2026-09-16T12:00:00Z', '2026-09-20T20:59:59Z']) {
    assert.equal(aiMentorWeekKey(new Date(value)), '2026-09-14')
  }
  assert.equal(aiMentorWeekKey(new Date('2026-09-20T21:00:00Z')), '2026-09-21')
  assert.equal(aiMentorWeekKey(new Date('2027-01-01T00:00:00Z')), '2026-12-28')
  assert.equal(aiMentorWeekKey(new Date('2027-01-03T21:00:00Z')), '2027-01-04')
})

test('same-week unchanged evidence fingerprints match; next week and real rolling evidence changes do not', async () => {
  const monday = context({ date: new Date('2026-09-14T12:00:00Z') })
  const sunday = context({ date: new Date('2026-09-20T12:00:00Z') })
  assert.equal(await fingerprint(monday), await fingerprint(sunday))
  assert.notEqual(await fingerprint(sunday), await fingerprint(context({ date: new Date('2026-09-21T12:00:00Z') })))
  const performance = [{ date: '2026-09-09', daily_hours: 2 }]
  assert.notEqual(await fingerprint(context({ performance, date: new Date('2026-09-14T12:00:00Z') })),
    await fingerprint(context({ performance, date: new Date('2026-09-20T12:00:00Z') })))
})

test('assessment, task completion, study and meeting/followup changes invalidate weekly context', async () => {
  const base = await fingerprint(context())
  for (const input of [
    { performance: [{ date: '2026-09-16', tyt_net: 0 }] },
    { performance: [{ date: '2026-09-16', daily_hours: 0 }] },
    { tasks: [{ created_at: '2026-09-16', status: false }] },
    { meetings: [{ status: 'completed', scheduled_at: '2026-09-15T12:00:00Z' }] },
  ]) assert.notEqual(await fingerprint(context(input)), base)
  const performance = [{ date: '2026-09-15', tyt_net: 40 }, { date: '2026-09-16', tyt_net: 50 }]
  assert.notEqual(await fingerprint(context({ performance })), await fingerprint(context({ performance: [...performance.slice(0, 1), { date: '2026-09-16', tyt_net: 51 }] })))
  const task = { created_at: '2026-09-15', due_date: '2026-09-17', status: false }
  assert.notEqual(await fingerprint(context({ tasks: [task] })), await fingerprint(context({ tasks: [{ ...task, status: true }] })))
})

test('canonical active goal targets affect fingerprint even with no exams or unchanged achieved gap; archives do not', async () => {
  const base = await fingerprint(context({ goals: [archived, active] }))
  for (const patch of [{ target_tyt_net: 65 }, { target_rank: 10000 }, { target_score: 450 },
    { target_date: '2027-06-02' }, { university_name: 'Yeni hedef' }, { program_name: 'Yeni bölüm' }]) {
    assert.notEqual(await fingerprint(context({ goals: [{ ...active, ...patch }, archived] })), base)
  }
  assert.equal(await fingerprint(context({ goals: [active, { ...archived, target_rank: 1, updated_at: '2027-01-01' }] })), base)
  assert.notEqual(await fingerprint(context({ goals: [archived] })), base)
  const performance = [{ tyt_net: 80, date: '2026-09-16' }]
  assert.notEqual(await fingerprint(context({ goals: [active], performance })),
    await fingerprint(context({ goals: [{ ...active, target_tyt_net: 70 }], performance })))
})

test('insufficient evaluation distinguishes missing, explicit zero and isolated evidence; real progress keeps provider path', () => {
  const empty = context()
  assert.equal(empty.weeklySnapshot.latestTYT, null)
  assert.match(insufficientAIMentorInsight(empty).summary, /yeterli kayıt yok/)
  const zero = context({ performance: [{ date: '2026-09-16', tyt_net: 0, daily_hours: 0 }] })
  assert.equal(zero.weeklySnapshot.latestTYT, 0)
  assert.equal(zero.recentChanges.tytChange, null)
  assert.equal(zero.recentChanges.studyHoursChange, null)
  const fallback = insufficientAIMentorInsight(zero)
  assert.match(fallback.summary, /TYT sonucu: 0 net/)
  assert.match(fallback.summary, /çalışma: 0 saat/)
  assert.match(fallback.summary, /henüz yeterli değil/)
  assert.deepEqual(parseAIMentorInsight(fallback), fallback)
  const single = context({ performance: [{ date: '2026-09-16', tyt_net: 40 }] })
  assert.match(insufficientAIMentorInsight(single).summary, /40 net/)
  for (const second of [30, 50]) {
    const reliable = context({ performance: [{ date: '2026-09-15', tyt_net: 40 }, { date: '2026-09-16', tyt_net: second }] })
    assert.equal(insufficientAIMentorInsight(reliable), null)
    assert.equal(reliable.recentChanges.tytChange, second - 40)
  }
})

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) {
    const found = find(child, predicate)
    if (found) return found
  }
  return null
}
function panel(generate) {
  let cursor = 0, props = { studentId: 's', currentFingerprint: 'fingerprint-a' }
  const slots = []
  const react = { ...React, useId: () => 'title',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
  }
  const Panel = loadTs('src/components/teacher/AIMentorInsightPanel.tsx', { react,
    '../../services/aiMentorService': { aiMentorInsightService: { generateMentorInsight: generate } },
    '../../lib/aiMentorErrors': errors,
  }).default
  const render = () => { cursor = 0; return Panel(props) }
  return { render, set(next) { props = { ...props, ...next } }, click() { find(render(), node => node.type === 'button').props.onClick() } }
}
const errors = loadTs('src/lib/aiMentorErrors.ts')
const flush = () => new Promise(resolve => setImmediate(resolve))
function response(fp = 'fingerprint-a', weekKey = aiMentorWeekKey()) {
  return { insight: { summary: 'Korunan iyi sonuç', meetingTopics: [], mentorActions: [], studentFeedback: 'Geri bildirim' },
    contextFingerprint: fp, weekKey, generatedAt: new Date().toISOString(), cached: false }
}

test('same student/week/fingerprint reuses existing result without service/quota calls; pending requests are single-flight', async () => {
  let calls = 0, finish
  const ui = panel(() => { calls++; return new Promise(resolve => { finish = resolve }) })
  const click = find(ui.render(), node => node.type === 'button').props.onClick
  click(); click()
  assert.equal(calls, 1)
  finish(response()); await flush()
  click(); ui.click(); await flush()
  assert.equal(calls, 1)
  assert.match(JSON.stringify(ui.render()), /Güncel/)
  ui.set({ currentFingerprint: 'fingerprint-b' })
  assert.match(JSON.stringify(ui.render()), /önceki değerlendirmeye/)
  ui.click(); assert.equal(calls, 2)
  finish(response('fingerprint-b')); await flush()
  ui.click(); assert.equal(calls, 2)
  ui.set({ studentId: 'other' }); ui.click(); assert.equal(calls, 3)
  finish(response('fingerprint-b')); await flush()
  ui.set({ studentId: 's' }); ui.click(); assert.equal(calls, 3)
})

test('week rollover permits new evaluation even with unchanged fingerprint and an already-open click handler', async () => {
  const RealDate = globalThis.Date
  let clock = new RealDate('2026-09-20T20:59:59Z').getTime(), calls = 0
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])) } static now() { return clock } }
  try {
    const ui = panel(async () => { calls++; return response() })
    const click = find(ui.render(), node => node.type === 'button').props.onClick
    click(); await flush(); click(); await flush()
    assert.equal(calls, 1)
    clock += 1000
    assert.match(JSON.stringify(ui.render()), /önceki değerlendirmeye/)
    assert.doesNotMatch(JSON.stringify(ui.render()), /Güncel/)
    click(); await flush(); assert.equal(calls, 2)
    click(); await flush(); assert.equal(calls, 2)
  } finally { globalThis.Date = RealDate }
})

test('provider and rate-limit failures keep last good result visible while pending and after failure; retry stays possible', async () => {
  for (const code of ['PROVIDER_TIMEOUT', 'INVALID_AI_OUTPUT', 'RATE_LIMITED']) {
    let calls = 0, fail
    const ui = panel(() => ++calls === 1 ? Promise.resolve(response()) : new Promise((resolve, reject) => { fail = reject }))
    ui.click(); await flush()
    ui.set({ currentFingerprint: 'fingerprint-b' }); ui.click()
    assert.match(JSON.stringify(ui.render()), /Korunan iyi sonuç/)
    fail(new errors.AIMentorServiceError(code)); await flush()
    const tree = ui.render()
    assert.match(JSON.stringify(tree), /Korunan iyi sonuç/)
    assert.match(JSON.stringify(tree), /önceki değerlendirmeye/)
    assert.equal(find(tree, node => node.type === 'button').props.disabled, false)
    assert.ok(find(tree, node => node.props?.role === 'alert'))
    if (code === 'RATE_LIMITED') assert.match(JSON.stringify(tree), /kullanım sınırına ulaşıldı/)
    ui.click(); assert.equal(calls, 3)
    fail(new errors.AIMentorServiceError(code)); await flush()
  }
})

test('response parser preserves canonical week and rejects invalid dates or non-Monday keys', () => {
  assert.equal(parseAIMentorInsightResponse(response()).weekKey, aiMentorWeekKey())
  for (const weekKey of ['2026-09-99', '2026-09-15', '2026-02-30', 'bad']) {
    assert.throws(() => parseAIMentorInsightResponse(response('fingerprint-a', weekKey)), /hafta kimliği/)
  }
})
