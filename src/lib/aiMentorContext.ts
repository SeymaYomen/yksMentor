import type { StudentStatusResult } from './studentStatus'
import type { GoalProgressResult } from './goalProgress'
import type { CompetencyMapResult, TopicCompetencyResult } from './competencyMap'
import type { MentorAlertResult } from './mentorAlerts'

type ContextTopic = {
  examType: 'TYT' | 'AYT'
  subjectName: string
  topicName: string
  status: TopicCompetencyResult['status']
  trend: TopicCompetencyResult['trend']
  accuracy: number | null
}

export type AIMentorContext = {
  student: { displayName: string }
  status: {
    level: StudentStatusResult['level']
    label: StudentStatusResult['label']
    hasEnoughData: boolean
    reasons: string[]
  }
  goalProgress: {
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
    status: {
      level: input.studentStatus.level,
      label: input.studentStatus.label,
      hasEnoughData: input.studentStatus.hasEnoughData,
      reasons: input.studentStatus.reasons.slice(0, 4),
    },
    goalProgress: {
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
  const bytes = new TextEncoder().encode(stableSerialize(context))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function isAIMentorInsightStale(currentFingerprint: string | null, insightFingerprint: string | null) {
  return Boolean(currentFingerprint && insightFingerprint && currentFingerprint !== insightFingerprint)
}
