import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function compile(sourcePath, requireImpl = () => ({})) {
  const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const loaded = { exports: {} }
  new Function('exports', 'module', 'require', compiled.outputText)(loaded.exports, loaded, requireImpl)
  return loaded.exports
}

const statusModule = compile('../src/lib/studentStatus.ts')
const alertsModule = compile('../src/lib/mentorAlerts.ts', id => {
  if (id === './studentStatus') return statusModule
  return {}
})
const { calculateMentorAlerts } = alertsModule

const now = new Date('2026-09-02T12:00:00+03:00')

function comparison(overrides = {}) {
  return { previous: null, current: null, delta: null, trend: 'insufficient', ...overrides }
}

function status(overrides = {}) {
  const metrics = {
    taskCompletionRate: null,
    totalTasks: 0,
    openTasks: 0,
    overdueTasks: 0,
    performanceTrend: 'insufficient',
    studyTrend: 'insufficient',
    tyt: comparison(),
    ayt: comparison(),
    studyHours: comparison(),
    lastMeetingDays: 3,
    nextMeetingAt: null,
    ...(overrides.metrics ?? {}),
  }
  return {
    level: 'green', label: 'İyi ilerliyor', reasons: [], warnings: [], positives: [], hasEnoughData: true,
    ...overrides,
    metrics,
  }
}

function emptyGoal(overrides = {}) {
  const emptyMetric = { target: null, current: null, remaining: null, initialRemaining: null, change30Days: null, status: 'insufficient_data', reached: false, hasTrendData: false }
  return {
    hasGoal: false,
    goal: null,
    status: 'insufficient_data',
    label: 'Hedef tanımlanmamış',
    metrics: { tyt: emptyMetric, ayt: { ...emptyMetric } },
    reasons: [], roadmap: [], targetDatePassed: false, reliableRankEstimateAvailable: false, rankEstimateMessage: null,
    ...overrides,
  }
}

function emptyCompetency(topics = []) {
  return {
    topics,
    strong: topics.filter(topic => topic.status === 'strong'),
    developing: topics.filter(topic => topic.status === 'developing'),
    weak: topics.filter(topic => topic.status === 'weak'),
    insufficient: topics.filter(topic => topic.status === 'insufficient_data'),
    hasReliableData: topics.some(topic => topic.status !== 'insufficient_data'),
  }
}

function topic(overrides = {}) {
  return {
    topicId: 'geometry', topicName: 'Geometri', topicIsActive: true,
    subjectId: 'math', subjectName: 'Matematik', examType: 'TYT',
    status: 'weak', score: 38, trend: 'declining',
    evidence: { attempts: 3, correct: 11, wrong: 17, blank: 2, knownQuestions: 30, recentAccuracy: 0.38 },
    reasons: ['Performans düşüyor.'],
    ...overrides,
  }
}

function actionItem(overrides = {}) {
  return {
    id: 'item-1', meeting_id: 'meeting-1', student_id: 'student-1', teacher_id: 'teacher-1',
    item_text: 'Haftada iki deneme çöz', kind: 'followup', status: 'open', due_date: '2026-08-29',
    created_at: '2026-08-20T12:00:00Z', completed_at: null,
    ...overrides,
  }
}

function calculate(overrides = {}) {
  return calculateMentorAlerts({
    studentId: 'student-1',
    studentCreatedAt: '2026-08-01T12:00:00Z',
    studentStatus: status(),
    goalProgress: emptyGoal(),
    competencySummary: emptyCompetency(),
    performance: [{ date: '2026-09-01', tyt_net: 60, ayt_net: 30, daily_hours: 3 }],
    tasks: [],
    meetings: [{ status: 'completed', scheduled_at: '2026-08-30T12:00:00+03:00' }],
    actionItems: [],
    now,
    ...overrides,
  })
}

test('ciddi çoklu negatif sinyal kritik öncelik ve açıklanabilir kanıt üretir', () => {
  const result = calculate({
    studentStatus: status({
      level: 'red',
      metrics: {
        performanceTrend: 'down', studyTrend: 'down',
        tyt: comparison({ previous: 74, current: 65, delta: -9, trend: 'down' }),
        ayt: comparison({ previous: 45, current: 38, delta: -7, trend: 'down' }),
        studyHours: comparison({ previous: 5, current: 2, delta: -3, trend: 'down' }),
        taskCompletionRate: 25, totalTasks: 4, openTasks: 3, overdueTasks: 3,
      },
    }),
  })

  assert.equal(result.priority, 'critical')
  assert.equal(result.needsMeeting, true)
  assert.match(result.alerts[0].reason, /net|görev|saat/i)
  assert.ok(Object.keys(result.alerts[0].evidence).length > 0)
})

test('tek orta uyarı medium öncelik üretir', () => {
  const result = calculate({
    studentStatus: status({ metrics: { overdueTasks: 1, openTasks: 1, totalTasks: 2, taskCompletionRate: 50 } }),
  })
  assert.equal(result.priority, 'medium')
  assert.deepEqual(result.alerts.map(alert => alert.type), ['TASK_COMPLIANCE'])
})

test('normal öğrenci low ve actionable alertsiz kalır', () => {
  const result = calculate()
  assert.equal(result.priority, 'low')
  assert.equal(result.alerts.length, 0)
  assert.equal(result.suggestedAction, null)
})

test('gecikmiş açık action item follow-up alarmı üretir', () => {
  const result = calculate({ actionItems: [actionItem()] })
  const alert = result.alerts.find(item => item.type === 'FOLLOWUP_OVERDUE')
  assert.ok(alert)
  assert.match(alert.reason, /4 gün geçti/)
})

test('tamamlanmış ve iptal edilmiş action item alarm üretmez', () => {
  const result = calculate({
    actionItems: [actionItem({ status: 'completed' }), actionItem({ id: 'item-2', status: 'cancelled' })],
  })
  assert.equal(result.alerts.some(item => item.type === 'FOLLOWUP_OVERDUE'), false)
})

test('declining weak konu yüksek topic weakness uyarısı üretir', () => {
  const result = calculate({ competencySummary: emptyCompetency([topic()]) })
  const alert = result.alerts.find(item => item.type === 'TOPIC_WEAKNESS')
  assert.equal(alert?.severity, 'high')
  assert.match(alert?.reason ?? '', /Geometri.*zayıf ve geriliyor/)
})

test('insufficient topic data alarm üretmez', () => {
  const result = calculate({ competencySummary: emptyCompetency([topic({ status: 'insufficient_data', trend: 'insufficient_data', score: null })]) })
  assert.equal(result.alerts.some(item => item.type === 'TOPIC_WEAKNESS'), false)
})

test('eski performans kaydı doğru data gap açıklaması üretir', () => {
  const result = calculate({ performance: [{ date: '2026-08-24', tyt_net: 0, daily_hours: 0 }] })
  const alert = result.alerts.find(item => item.type === 'DATA_GAP')
  assert.equal(alert?.severity, 'medium')
  assert.match(alert?.reason ?? '', /9 gündür/)
})

test('yeni ve verisiz öğrenci grace period içinde yanlış alarm almaz', () => {
  const result = calculate({
    studentCreatedAt: '2026-08-30T12:00:00+03:00',
    performance: [],
    studentStatus: status({ hasEnoughData: false }),
    meetings: [],
  })
  assert.equal(result.alerts.some(item => item.type === 'DATA_GAP'), false)
  assert.equal(result.alerts.some(item => item.type === 'MEETING_OVERDUE'), false)
})

test('hedefe ulaşan öğrenci goal off track alarmı almaz', () => {
  const reached = { target: 70, current: 72, remaining: 0, initialRemaining: 5, change30Days: 5, status: 'achieved', reached: true, hasTrendData: true }
  const result = calculate({
    goalProgress: emptyGoal({ hasGoal: true, status: 'achieved', metrics: { tyt: reached, ayt: { ...reached, target: null } } }),
  })
  assert.equal(result.alerts.some(item => item.type === 'GOAL_OFF_TRACK'), false)
})

test('yüksek öncelikte yakın görüşme varsa otomatik planlama önerisi üretmez', () => {
  const result = calculate({
    competencySummary: emptyCompetency([topic()]),
    meetings: [{ status: 'scheduled', scheduled_at: '2026-09-05T12:00:00+03:00' }],
    actionItems: [actionItem({ due_date: '2026-08-20' })],
  })
  assert.equal(result.priority, 'critical')
  assert.equal(result.needsMeeting, false)
  assert.notEqual(result.suggestedAction, 'Görüşme planlanması önerilir.')
})
