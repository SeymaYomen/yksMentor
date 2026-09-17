import type { StudentStatusResult } from './studentStatus'
import type { GoalProgressResult } from './goalProgress'
import type { CompetencyMapResult, TopicCompetencyResult } from './competencyMap'
import type { MentorAlertResult } from './mentorAlerts'
import type { AIMentorInsight } from './aiMentorOutput'

// Use the same calendar timezone as the study comparison. The key is Monday's
// date, avoiding ambiguous week numbers at year boundaries.
export function aiMentorWeekKey(now = new Date()): string {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(now)
  const monday = new Date(`${day}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  return monday.toISOString().slice(0, 10)
}

type ContextTopic = {
  examType: 'TYT' | 'AYT'
  subjectName: string
  topicName: string
  status: TopicCompetencyResult['status']
  trend: TopicCompetencyResult['trend']
  accuracy: number | null
  observations: number
}

export type AIMentorContext = {
  weeklySnapshot: {
    weekKey: string
    study: StudentStatusResult['metrics']['weeklyStudy'] | null
    latestTYT: number | null
    latestAYT: number | null
    tytGoalGap: number | null
    aytGoalGap: number | null
    limitedTopicEvidence: ContextTopic[]
    assignedTaskCompletion: StudentStatusResult['metrics']['weeklyTasks'] | null
  }
  student: { displayName: string }
  status: {
    level: StudentStatusResult['level']
    label: StudentStatusResult['label']
    hasEnoughData: boolean
    reasons: string[]
  }
  goalProgress: {
    target: {
      type: string | null; scoreType: string | null; university: string | null; program: string | null
      rank: number | null; score: number | null; tytNet: number | null; aytNet: number | null; date: string | null
    } | null
    hasGoal: boolean
    status: GoalProgressResult['status']
    label: string
    targetDatePassed: boolean
    reasons: string[]
  }
  competencySummary: {
    strongTopics: ContextTopic[]
    developingTopics: ContextTopic[]
    weakTopics: ContextTopic[]
  }
  alerts: {
    priority: MentorAlertResult['priority']
    items: Array<{ type: string; severity: string; title: string; reason: string }>
    summary: string
    suggestedAction: string | null
  }
  tasks: {
    completionRate: number | null
    totalCount: number
    openCount: number
    overdueCount: number
  }
  meetings: {
    daysSinceLastMeeting: number | null
    upcomingMeetingAt: string | null
    overdueFollowupCount: number
  }
  recentChanges: {
    tytChange: number | null
    aytChange: number | null
    studyHoursChange: number | null
  }
}

export type BuildAIMentorContextInput = {
  now?: Date
  displayName: string
  studentStatus: StudentStatusResult
  goalProgress: GoalProgressResult
  competencyMap: CompetencyMapResult
  mentorAlerts: MentorAlertResult
}

function contextTopic(topic: TopicCompetencyResult): ContextTopic {
  return {
    examType: topic.examType,
    subjectName: topic.subjectName,
    topicName: topic.topicName,
    status: topic.status,
    trend: topic.trend,
    accuracy: topic.score,
    observations: topic.evidence.attempts,
  }
}

function safeDisplayName(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 100) : 'Öğrenci'
}

export function buildAIMentorContext(input: BuildAIMentorContextInput): AIMentorContext {
  const metrics = input.studentStatus.metrics
  const followupAlert = input.mentorAlerts.alerts.find(alert => alert.type === 'FOLLOWUP_OVERDUE')
  const overdueFollowupCount = typeof followupAlert?.evidence.overdueCount === 'number'
    ? followupAlert.evidence.overdueCount
    : 0

  return {
    student: { displayName: safeDisplayName(input.displayName) },
    weeklySnapshot: {
      weekKey: aiMentorWeekKey(input.now),
      study: metrics.weeklyStudy ?? null,
      latestTYT: metrics.tyt.current,
      latestAYT: metrics.ayt.current,
      tytGoalGap: input.goalProgress.metrics.tyt?.remaining ?? null,
      aytGoalGap: input.goalProgress.metrics.ayt?.remaining ?? null,
      limitedTopicEvidence: input.competencyMap.insufficient.slice(0, 3).map(contextTopic),
      assignedTaskCompletion: metrics.weeklyTasks ?? null,
    },
    status: {
      level: input.studentStatus.level,
      label: input.studentStatus.label,
      hasEnoughData: input.studentStatus.hasEnoughData,
      reasons: input.studentStatus.reasons.slice(0, 4),
    },
    goalProgress: {
      target: input.goalProgress.goal ? {
        type: input.goalProgress.goal.goal_type ?? null,
        scoreType: input.goalProgress.goal.score_type ?? null,
        university: input.goalProgress.goal.university_name ?? null,
        program: input.goalProgress.goal.program_name ?? null,
        rank: input.goalProgress.goal.target_rank ?? null,
        score: input.goalProgress.goal.target_score ?? null,
        tytNet: input.goalProgress.goal.target_tyt_net ?? null,
        aytNet: input.goalProgress.goal.target_ayt_net ?? null,
        date: input.goalProgress.goal.target_date ?? null,
      } : null,
      hasGoal: input.goalProgress.hasGoal,
      status: input.goalProgress.status,
      label: input.goalProgress.label,
      targetDatePassed: input.goalProgress.targetDatePassed,
      reasons: input.goalProgress.reasons.slice(0, 4),
    },
    competencySummary: {
      strongTopics: input.competencyMap.strong.slice(0, 2).map(contextTopic),
      developingTopics: input.competencyMap.developing.slice(0, 2).map(contextTopic),
      weakTopics: input.competencyMap.weak
        .filter(topic => topic.status !== 'insufficient_data')
        .sort((a, b) => Number(b.trend === 'declining') - Number(a.trend === 'declining'))
        .slice(0, 3)
        .map(contextTopic),
    },
    alerts: {
      priority: input.mentorAlerts.priority,
      items: input.mentorAlerts.alerts.slice(0, 5).map(alert => ({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        reason: alert.reason,
      })),
      summary: input.mentorAlerts.summary,
      suggestedAction: input.mentorAlerts.suggestedAction,
    },
    tasks: {
      completionRate: metrics.taskCompletionRate,
      totalCount: metrics.totalTasks,
      openCount: metrics.openTasks,
      overdueCount: metrics.overdueTasks,
    },
    meetings: {
      daysSinceLastMeeting: metrics.lastMeetingDays,
      upcomingMeetingAt: metrics.nextMeetingAt,
      overdueFollowupCount,
    },
    recentChanges: {
      tytChange: metrics.tyt.delta,
      aytChange: metrics.ayt.delta,
      studyHoursChange: metrics.studyHours.delta,
    },
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

export async function createAIMentorContextFingerprint(context: AIMentorContext) {
  // Rolling window labels advance daily even when all relevant evidence stays
  // the same. Hash the evidence and canonical week, not these display dates.
  const study = context.weeklySnapshot?.study
  const normalized = study ? { ...context, weeklySnapshot: { ...context.weeklySnapshot,
    study: Object.fromEntries(Object.entries(study).filter(([key]) => !['start', 'middle', 'end'].includes(key))),
  } } : context
  const bytes = new TextEncoder().encode(stableSerialize(normalized))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function isAIMentorInsightStale(currentFingerprint: string | null, insightFingerprint: string | null) {
  return Boolean(currentFingerprint && insightFingerprint && currentFingerprint !== insightFingerprint)
}

// No reliable trend and no actionable deterministic warning: a model cannot
// add evidence. Preserve observed zeros and describe the limitation directly.
export function insufficientAIMentorInsight(context: AIMentorContext): AIMentorInsight | null {
  if (context.status.hasEnoughData || context.alerts.items.length > 0
    || context.competencySummary.strongTopics.length > 0
    || context.competencySummary.developingTopics.length > 0
    || context.competencySummary.weakTopics.length > 0) return null
  const snapshot = context.weeklySnapshot
  const observations: string[] = []
  if (snapshot.latestTYT !== null) observations.push(`Son TYT sonucu: ${snapshot.latestTYT} net.`)
  if (snapshot.latestAYT !== null) observations.push(`Son AYT sonucu: ${snapshot.latestAYT} net.`)
  if (snapshot.study?.current != null) observations.push(`Son yedi günde kayıtlı çalışma: ${snapshot.study.current} saat.`)
  const summary = observations.length ? observations.join(' ') + ' İlerleme veya düşüş yorumu için karşılaştırılabilir veri henüz yeterli değil.'
    : 'Haftalık ilerleme veya düşüş değerlendirmesi için yeterli kayıt yok. Eksik kayıtlar sıfır performans anlamına gelmez.'
  return { summary, meetingTopics: ['Mevcut kayıtların kapsamını ve çalışma planını birlikte gözden geçirin.'],
    mentorActions: ['Düzenli deneme ve çalışma kayıtları biriktirin.'],
    studentFeedback: 'Şu anki kayıtlarla ilerleme ya da gerileme sonucu çıkarılamaz. Yeni kayıtlarla birlikte yeniden değerlendirebiliriz.' }
}
