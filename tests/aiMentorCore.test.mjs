import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function compile(sourcePath) {
  const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const loaded = { exports: {} }
  new Function('exports', 'module', compiled.outputText)(loaded.exports, loaded)
  return loaded.exports
}

const { buildAIMentorContext } = compile('../src/lib/aiMentorContext.ts')
const { canGenerateAIMentorInsight } = compile('../src/lib/aiMentorAuthorization.ts')
const { AI_MENTOR_SYSTEM_PROMPT } = compile('../src/lib/aiMentorPrompt.ts')
const { parseAIMentorInsight } = compile('../src/lib/aiMentorOutput.ts')

function comparison(overrides = {}) {
  return { previous: 60, current: 64, delta: 4, trend: 'up', ...overrides }
}

function contextInput(overrides = {}) {
  const status = {
    level: 'green', label: 'İyi ilerliyor', reasons: ['Performans düzenli ilerliyor.'], warnings: [], positives: [], hasEnoughData: true,
    metrics: {
      taskCompletionRate: 80, totalTasks: 5, openTasks: 1, overdueTasks: 0,
      performanceTrend: 'up', studyTrend: 'stable',
      tyt: comparison(), ayt: comparison({ previous: 30, current: 32, delta: 2 }),
      studyHours: comparison({ previous: 3, current: 3, delta: 0, trend: 'stable' }),
      lastMeetingDays: 4, nextMeetingAt: '2026-09-05T10:00:00Z',
    },
  }
  const goal = {
    hasGoal: true, status: 'approaching', label: 'Hedefe yaklaşıyor', targetDatePassed: false,
    reasons: ['TYT hedefi için 6 net fark kaldı.'], roadmap: [], reliableRankEstimateAvailable: false, rankEstimateMessage: null,
    goal: { id: 'SECRET-GOAL-ID', student_id: 'SECRET-STUDENT-ID', created_by: 'SECRET-TEACHER-ID' },
    metrics: {},
  }
  const strongTopic = {
    topicId: 'SECRET-TOPIC-ID', subjectId: 'SECRET-SUBJECT-ID', topicName: 'Problemler', subjectName: 'Matematik', examType: 'TYT',
    status: 'strong', trend: 'stable', score: 82, topicIsActive: true,
    evidence: { attempts: 3, correct: 24, wrong: 6, blank: 0, knownQuestions: 30, recentAccuracy: 0.8 }, reasons: [],
  }
  const competency = { topics: [strongTopic], strong: [strongTopic], developing: [], weak: [], insufficient: [], hasReliableData: true }
  const alerts = {
    studentId: 'SECRET-STUDENT-ID', priority: 'low', alerts: [], summary: 'Anlamlı dikkat sinyali yok.',
    suggestedAction: null, needsMeeting: false, internalEmail: 'private@example.com',
  }
  return { displayName: 'Ayşe', studentStatus: status, goalProgress: goal, competencyMap: competency, mentorAlerts: alerts, ...overrides }
}

test('context builder teknik kimlikleri ve gereksiz kişisel veriyi dışarıda bırakır', () => {
  const context = buildAIMentorContext(contextInput())
  const serialized = JSON.stringify(context)

  assert.equal(context.student.displayName, 'Ayşe')
  assert.doesNotMatch(serialized, /SECRET-|private@example\.com|studentId|topicId|subjectId|created_by|join_code/i)
  assert.deepEqual(Object.keys(context), ['student', 'status', 'goalProgress', 'competencySummary', 'alerts', 'tasks', 'meetings', 'recentChanges'])
})

test('low-risk context ve prompt aşırı alarm dilini açıkça engeller', () => {
  const context = buildAIMentorContext(contextInput())

  assert.equal(context.status.level, 'green')
  assert.equal(context.alerts.priority, 'low')
  assert.equal(context.alerts.items.length, 0)
  assert.match(AI_MENTOR_SYSTEM_PROMPT, /priority low.*alarm dili kullanma/i)
  assert.match(AI_MENTOR_SYSTEM_PROMPT, /kesin hüküm|tanı/i)
})

test('server authorization yalnız teacher ve bağlı student ilişkisini kabul eder', () => {
  assert.equal(canGenerateAIMentorInsight(
    { id: 'teacher-1', role: 'teacher' },
    { id: 'student-1', mentorId: 'teacher-1', role: 'student' },
  ), true)
  assert.equal(canGenerateAIMentorInsight(
    { id: 'student-1', role: 'student' },
    { id: 'student-1', mentorId: 'teacher-1', role: 'student' },
  ), false)
})

test('başka mentorun öğrencisi için AI insight yetkisi verilmez', () => {
  assert.equal(canGenerateAIMentorInsight(
    { id: 'teacher-2', role: 'teacher' },
    { id: 'student-1', mentorId: 'teacher-1', role: 'student' },
  ), false)
})

test('malformed AI output reddedilir', () => {
  assert.throws(() => parseAIMentorInsight({ summary: 'Eksik alanlar' }), /Geçersiz AI yanıtı/)
  assert.throws(() => parseAIMentorInsight({
    summary: 'Özet', meetingTopics: [], mentorActions: [], studentFeedback: 'Geri bildirim', unexpected: true,
  }), /şemayla eşleşmiyor/)
})

test('geçerli structured output parse edilir', () => {
  const parsed = parseAIMentorInsight({
    summary: 'Hedef ilerlemesi sürüyor.',
    meetingTopics: ['Çalışma planının uygulanabilirliği'],
    mentorActions: ['Görev kapsamını birlikte gözden geçir.'],
    studentFeedback: 'Düzenli ilerlemeyi sürdürürken çalışma planını birlikte netleştirebilirsin.',
  })
  assert.equal(parsed.meetingTopics.length, 1)
  assert.equal(parsed.mentorActions.length, 1)
})

test('meetingTopics üç madde sınırını aşamaz', () => {
  assert.throws(() => parseAIMentorInsight({
    summary: 'Özet', meetingTopics: ['1', '2', '3', '4'], mentorActions: [], studentFeedback: 'Geri bildirim',
  }), /meetingTopics/)
})

test('mentorActions iki madde sınırını aşamaz', () => {
  assert.throws(() => parseAIMentorInsight({
    summary: 'Özet', meetingTopics: [], mentorActions: ['1', '2', '3'], studentFeedback: 'Geri bildirim',
  }), /mentorActions/)
})
