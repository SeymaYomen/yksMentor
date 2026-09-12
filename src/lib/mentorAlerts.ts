import {
  STUDENT_STATUS_RULES,
  type PerformanceSignal,
  type StudentStatusResult,
  type TaskSignal,
} from './studentStatus.ts'

import type {
  GoalMetricProgress,
  GoalProgressResult,
} from './goalProgress.ts'

import type {
  CompetencyMapResult,
  TopicCompetencyResult,
} from './competencyMap.ts'

import type {
  MeetingActionItem,
} from './meetingBriefing.ts'
export type MentorAlertType =
  | 'ACADEMIC_DECLINE'
  | 'GOAL_OFF_TRACK'
  | 'TASK_COMPLIANCE'
  | 'STUDY_DROP'
  | 'TOPIC_WEAKNESS'
  | 'MEETING_OVERDUE'
  | 'FOLLOWUP_OVERDUE'
  | 'DATA_GAP'

export type MentorAlertSeverity = 'medium' | 'high'
export type MentorAttentionPriority = 'low' | 'medium' | 'high' | 'critical'

export type MentorAlert = {
  type: MentorAlertType
  severity: MentorAlertSeverity
  title: string
  reason: string
  evidence: Record<string, unknown>
}

export type MentorAlertResult = {
  studentId: string
  priority: MentorAttentionPriority
  alerts: MentorAlert[]
  summary: string
  suggestedAction: string | null
  needsMeeting: boolean
}

export type MentorAlertMeeting = {
  status?: string | null
  scheduled_at?: string | null
}

export type CalculateMentorAlertsInput = {
  studentId: string
  studentCreatedAt?: string | null
  studentStatus: StudentStatusResult
  goalProgress: GoalProgressResult
  competencySummary: CompetencyMapResult
  performance: PerformanceSignal[]
  tasks: TaskSignal[]
  meetings: MentorAlertMeeting[]
  actionItems: MeetingActionItem[]
  now?: Date
}

export const MENTOR_ALERT_RULES = {
  dataGapDays: 7,
  severeDataGapDays: 14,
  newStudentGraceDays: 7,
  upcomingMeetingWindowDays: 7,
  highStudyDropRelative: 0.3,
  highOverdueTaskCount: 3,
  highFollowupOverdueDays: 7,
  highFollowupOverdueCount: 2,
  topicAlertLimit: 3,
  criticalHighAlertCount: 2,
  highMediumAlertCount: 3,
} as const

export const MENTOR_PRIORITY_ORDER: Record<MentorAttentionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const ALERT_TYPE_ORDER: Record<MentorAlertType, number> = {
  FOLLOWUP_OVERDUE: 0,
  ACADEMIC_DECLINE: 1,
  GOAL_OFF_TRACK: 2,
  STUDY_DROP: 3,
  TASK_COMPLIANCE: 4,
  TOPIC_WEAKNESS: 5,
  MEETING_OVERDUE: 6,
  DATA_GAP: 7,
}

const DAY_MS = 86_400_000

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)
}

function timestamp(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function daysSince(value: string | null | undefined, now: Date) {
  const valueTime = timestamp(value)
  if (valueTime === null || valueTime > now.getTime()) return null
  return Math.max(0, Math.floor((now.getTime() - valueTime) / DAY_MS))
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetweenDateKeys(earlier: string, later: string) {
  const earlierParts = earlier.slice(0, 10).split('-').map(Number)
  const laterParts = later.slice(0, 10).split('-').map(Number)
  if (earlierParts.length !== 3 || laterParts.length !== 3 || [...earlierParts, ...laterParts].some(Number.isNaN)) return 0
  return Math.max(0, Math.round((
    Date.UTC(laterParts[0], laterParts[1] - 1, laterParts[2]) -
    Date.UTC(earlierParts[0], earlierParts[1] - 1, earlierParts[2])
  ) / DAY_MS))
}

function metricDeclineReason(name: 'TYT' | 'AYT', previous: number, current: number, delta: number) {
  return `${name} son ölçüm ortalaması ${formatNumber(previous)} netten ${formatNumber(current)} nete geriledi (${formatNumber(Math.abs(delta))} net düşüş).`
}

function academicDeclineAlert(status: StudentStatusResult): MentorAlert | null {
  const declining = ([
    ['TYT', status.metrics.tyt],
    ['AYT', status.metrics.ayt],
  ] as const).filter(([, metric]) => (
    metric.trend === 'down' && metric.previous !== null && metric.current !== null && metric.delta !== null
  ))

  if (declining.length === 0) return null
  const reasons = declining.map(([name, metric]) => metricDeclineReason(
    name,
    metric.previous as number,
    metric.current as number,
    metric.delta as number,
  ))

  return {
    type: 'ACADEMIC_DECLINE',
    severity: declining.length > 1 ? 'high' : 'medium',
    title: `${declining.map(([name]) => name).join(' ve ')} performansı düşüyor`,
    reason: reasons.join(' '),
    evidence: {
      metrics: declining.map(([name, metric]) => ({
        examType: name,
        previous: metric.previous,
        current: metric.current,
        delta: metric.delta,
      })),
    },
  }
}

function goalMetricEntries(goalProgress: GoalProgressResult) {
  return ([
    ['TYT', goalProgress.metrics.tyt],
    ['AYT', goalProgress.metrics.ayt],
  ] as Array<['TYT' | 'AYT', GoalMetricProgress]>).filter(([, metric]) => metric.target !== null)
}

function goalOffTrackAlert(goalProgress: GoalProgressResult): MentorAlert | null {
  if (!goalProgress.hasGoal || goalProgress.status === 'achieved') return null

  const metrics = goalMetricEntries(goalProgress)
  const movingAway = metrics.filter(([, metric]) => metric.status === 'moving_away')
  const stable = metrics.filter(([, metric]) => metric.status === 'stable' && metric.hasTrendData)
  if (movingAway.length === 0 && stable.length === 0 && !goalProgress.targetDatePassed) return null

  const evidenceMetrics = [...movingAway, ...stable].map(([examType, metric]) => ({
    examType,
    target: metric.target,
    current: metric.current,
    remaining: metric.remaining,
    change30Days: metric.change30Days,
    status: metric.status,
  }))
  const movingReasons = movingAway.map(([examType, metric]) => (
    `${examType} hedef ilerlemesi son 30 günde ${formatNumber(Math.abs(metric.change30Days ?? 0))} net geriledi.`
  ))
  const stableReasons = stable.map(([examType]) => `${examType} hedef ilerlemesi son 30 günde durağan kaldı.`)
  const dateReason = goalProgress.targetDatePassed ? ['Hedef tarihi geçti.'] : []

  return {
    type: 'GOAL_OFF_TRACK',
    severity: movingAway.length > 0 || goalProgress.targetDatePassed ? 'high' : 'medium',
    title: movingAway.length > 0 ? 'Hedeften uzaklaşıyor' : 'Hedef ilerlemesi durağan',
    reason: [...movingReasons, ...stableReasons, ...dateReason].join(' '),
    evidence: { status: goalProgress.status, targetDatePassed: goalProgress.targetDatePassed, metrics: evidenceMetrics },
  }
}

function taskComplianceAlert(status: StudentStatusResult): MentorAlert | null {
  const { taskCompletionRate, evaluatedTasks, totalTasks, overdueTasks, openTasks } = status.metrics
  const lowCompletion = taskCompletionRate !== null &&
    evaluatedTasks >= STUDENT_STATUS_RULES.minimumTasksForLowRate &&
    taskCompletionRate < STUDENT_STATUS_RULES.lowTaskCompletionRate
  if (!lowCompletion && overdueTasks === 0) return null

  const reasons: string[] = []
  if (lowCompletion) reasons.push(`Değerlendirilebilir ${evaluatedTasks} görevin %${formatNumber(taskCompletionRate as number)}’i tamamlandı.`)
  if (overdueTasks > 0) reasons.push(`${overdueTasks} açık görev son teslim tarihini geçti.`)
  const severity = overdueTasks >= MENTOR_ALERT_RULES.highOverdueTaskCount ||
    (lowCompletion && overdueTasks >= STUDENT_STATUS_RULES.multipleOverdueTasks)
    ? 'high'
    : 'medium'

  return {
    type: 'TASK_COMPLIANCE',
    severity,
    title: lowCompletion ? 'Görev uyumu düşük' : 'Geciken görev var',
    reason: reasons.join(' '),
    evidence: { taskCompletionRate, evaluatedTasks, totalTasks, openTasks, overdueTasks },
  }
}

function studyDropAlert(status: StudentStatusResult): MentorAlert | null {
  const metric = status.metrics.studyHours
  if (metric.trend !== 'down' || metric.previous === null || metric.current === null || metric.delta === null) return null
  const relativeDecline = metric.previous > 0 ? Math.abs(metric.delta) / metric.previous : null

  return {
    type: 'STUDY_DROP',
    severity: relativeDecline !== null && relativeDecline >= MENTOR_ALERT_RULES.highStudyDropRelative ? 'high' : 'medium',
    title: 'Çalışma süresi azaldı',
    reason: relativeDecline === null
      ? `Çalışma ortalaması ${formatNumber(metric.previous)} saatten ${formatNumber(metric.current)} saate geriledi.`
      : `Çalışma ortalaması ${formatNumber(metric.previous)} saatten ${formatNumber(metric.current)} saate geriledi (%${formatNumber(relativeDecline * 100)} düşüş).`,
    evidence: { previous: metric.previous, current: metric.current, delta: metric.delta, relativeDecline },
  }
}

function topicPriority(topic: TopicCompetencyResult) {
  if (topic.status === 'weak' && topic.trend === 'declining') return 0
  if (topic.trend === 'declining') return 1
  return 2
}

function topicLabel(topic: TopicCompetencyResult) {
  const state = topic.status === 'weak' && topic.trend === 'declining'
    ? 'zayıf ve geriliyor'
    : topic.trend === 'declining'
      ? 'geriliyor'
      : 'zayıf'
  const score = topic.score === null ? '' : ` (%${formatNumber(topic.score)} doğruluk)`
  return `${topic.examType} ${topic.subjectName} / ${topic.topicName} ${state}${score}`
}

function topicWeaknessAlert(competencySummary: CompetencyMapResult): MentorAlert | null {
  const topics = competencySummary.topics
    .filter(topic => topic.status !== 'insufficient_data' && (topic.status === 'weak' || topic.trend === 'declining'))
    .sort((a, b) => topicPriority(a) - topicPriority(b))
    .slice(0, MENTOR_ALERT_RULES.topicAlertLimit)
  if (topics.length === 0) return null
  const hasWeakDeclining = topics.some(topic => topic.status === 'weak' && topic.trend === 'declining')

  return {
    type: 'TOPIC_WEAKNESS',
    severity: hasWeakDeclining ? 'high' : 'medium',
    title: topics.length === 1 ? `${topics[0].topicName} dikkat gerektiriyor` : `${topics.length} akademik alan dikkat gerektiriyor`,
    reason: `${topics.map(topicLabel).join('; ')}.`,
    evidence: {
      topics: topics.map(topic => ({
        topicId: topic.topicId,
        examType: topic.examType,
        subjectName: topic.subjectName,
        topicName: topic.topicName,
        status: topic.status,
        trend: topic.trend,
        score: topic.score,
        attempts: topic.evidence.attempts,
      })),
    },
  }
}

function hasUpcomingMeeting(meetings: MentorAlertMeeting[], now: Date) {
  const windowEnd = now.getTime() + MENTOR_ALERT_RULES.upcomingMeetingWindowDays * DAY_MS
  return meetings.some(meeting => {
    const meetingTime = timestamp(meeting.scheduled_at)
    return meeting.status === 'scheduled' && meetingTime !== null && meetingTime >= now.getTime() && meetingTime <= windowEnd
  })
}

function meetingOverdueAlert(input: CalculateMentorAlertsInput, now: Date, upcomingMeeting: boolean): MentorAlert | null {
  if (upcomingMeeting) return null
  const lastMeetingDays = input.studentStatus.metrics.lastMeetingDays
  if (lastMeetingDays !== null && lastMeetingDays > STUDENT_STATUS_RULES.staleMeetingDays) {
    return {
      type: 'MEETING_OVERDUE',
      severity: 'medium',
      title: 'Mentor görüşmesi gecikti',
      reason: `Son tamamlanan mentor görüşmesinin üzerinden ${lastMeetingDays} gün geçti.`,
      evidence: { lastMeetingDays, hasUpcomingMeeting: false },
    }
  }

  const studentAgeDays = daysSince(input.studentCreatedAt, now)
  if (lastMeetingDays === null && studentAgeDays !== null && studentAgeDays > STUDENT_STATUS_RULES.staleMeetingDays) {
    return {
      type: 'MEETING_OVERDUE',
      severity: 'medium',
      title: 'İlk mentor görüşmesi bekleniyor',
      reason: `Öğrenci ${studentAgeDays} gündür sistemde; henüz tamamlanmış mentor görüşmesi yok.`,
      evidence: { studentAgeDays, lastMeetingDays: null, hasUpcomingMeeting: false },
    }
  }
  return null
}

function followupOverdueAlert(actionItems: MeetingActionItem[], now: Date): MentorAlert | null {
  const today = localDateKey(now)
  const overdue = actionItems
    .filter(item => item.status === 'open' && item.due_date && item.due_date.slice(0, 10) < today)
    .map(item => ({ ...item, overdueDays: daysBetweenDateKeys(item.due_date as string, today) }))
    .sort((a, b) => b.overdueDays - a.overdueDays)
  if (overdue.length === 0) return null
  const mostOverdue = overdue[0]
  const severity = overdue.length >= MENTOR_ALERT_RULES.highFollowupOverdueCount ||
    mostOverdue.overdueDays >= MENTOR_ALERT_RULES.highFollowupOverdueDays
    ? 'high'
    : 'medium'
  const firstItemReason = `“${mostOverdue.item_text}” maddesinin son tarihi ${mostOverdue.overdueDays} gün geçti.`
  const additionalReason = overdue.length > 1 ? ` Toplam ${overdue.length} açık karar gecikmiş durumda.` : ''

  return {
    type: 'FOLLOWUP_OVERDUE',
    severity,
    title: overdue.length > 1 ? `${overdue.length} görüşme kararı gecikti` : 'Görüşme kararı gecikti',
    reason: firstItemReason + additionalReason,
    evidence: {
      overdueCount: overdue.length,
      items: overdue.slice(0, 3).map(item => ({
        id: item.id,
        meetingId: item.meeting_id,
        text: item.item_text,
        dueDate: item.due_date,
        overdueDays: item.overdueDays,
      })),
    },
  }
}

function dataGapAlert(input: CalculateMentorAlertsInput, now: Date): MentorAlert | null {
  const latestPerformanceTime = input.performance
    .map(row => timestamp(row.date ?? row.created_at))
    .filter((value): value is number => value !== null && value <= now.getTime())
    .sort((a, b) => b - a)[0] ?? null
  const studentAgeDays = daysSince(input.studentCreatedAt, now)

  if (latestPerformanceTime === null) {
    if (studentAgeDays === null || studentAgeDays < MENTOR_ALERT_RULES.newStudentGraceDays) return null
    return {
      type: 'DATA_GAP',
      severity: studentAgeDays >= MENTOR_ALERT_RULES.severeDataGapDays ? 'high' : 'medium',
      title: 'Performans verisi bekleniyor',
      reason: `Öğrenci ${studentAgeDays} gündür sistemde; henüz performans kaydı yok.`,
      evidence: { lastPerformanceDays: null, studentAgeDays, performanceCount: input.performance.length },
    }
  }

  const lastPerformanceDays = Math.max(0, Math.floor((now.getTime() - latestPerformanceTime) / DAY_MS))
  if (lastPerformanceDays < MENTOR_ALERT_RULES.dataGapDays) return null
  return {
    type: 'DATA_GAP',
    severity: lastPerformanceDays >= MENTOR_ALERT_RULES.severeDataGapDays ? 'high' : 'medium',
    title: 'Yeni performans verisi gecikti',
    reason: `${lastPerformanceDays} gündür yeni performans veya çalışma kaydı yok.`,
    evidence: { lastPerformanceDays, studentAgeDays, performanceCount: input.performance.length },
  }
}

function calculatePriority(alerts: MentorAlert[], status: StudentStatusResult): MentorAttentionPriority {
  alerts = alerts.filter(alert => alert.type !== 'DATA_GAP')
  if (alerts.length === 0) return 'low'
  const highCount = alerts.filter(alert => alert.severity === 'high').length
  if (highCount >= MENTOR_ALERT_RULES.criticalHighAlertCount) return 'critical'
  if (highCount > 0 || alerts.length >= MENTOR_ALERT_RULES.highMediumAlertCount || (status.level === 'red' && alerts.length >= 2)) return 'high'
  return 'medium'
}

function buildSuggestedAction(priority: MentorAttentionPriority, alerts: MentorAlert[], upcomingMeeting: boolean) {
  if ((priority === 'high' || priority === 'critical') && !upcomingMeeting) return 'Görüşme planlanması önerilir.'
  const alertTypes = new Set(alerts.map(alert => alert.type))
  if (alertTypes.has('FOLLOWUP_OVERDUE')) return 'Geciken görüşme kararlarını gözden geçir ve bir sonraki adımı netleştir.'
  if (alertTypes.has('ACADEMIC_DECLINE') || alertTypes.has('GOAL_OFF_TRACK') || alertTypes.has('TOPIC_WEAKNESS')) {
    return 'Yaklaşan görüşmede akademik planı ve hedef ilerlemesini gözden geçir.'
  }
  if (alertTypes.has('STUDY_DROP') || alertTypes.has('TASK_COMPLIANCE')) return 'Çalışma düzeni ve görev planını öğrenciyle gözden geçir.'
  if (alertTypes.has('DATA_GAP')) return 'Öğrenciden güncel performans ve çalışma verisi girmesini iste.'
  if (alertTypes.has('MEETING_OVERDUE')) return 'Yeni bir mentor görüşmesi için uygun zamanı belirle.'
  return null
}

export function calculateMentorAlerts(input: CalculateMentorAlertsInput): MentorAlertResult {
  const now = input.now ?? new Date()
  const upcomingMeeting = hasUpcomingMeeting(input.meetings, now)
  const alerts = [
    academicDeclineAlert(input.studentStatus),
    goalOffTrackAlert(input.goalProgress),
    taskComplianceAlert(input.studentStatus),
    studyDropAlert(input.studentStatus),
    topicWeaknessAlert(input.competencySummary),
    meetingOverdueAlert(input, now, upcomingMeeting),
    followupOverdueAlert(input.actionItems, now),
    dataGapAlert(input, now),
  ]
    .filter((alert): alert is MentorAlert => alert !== null)
    .sort((a, b) => Number(b.severity === 'high') - Number(a.severity === 'high') || ALERT_TYPE_ORDER[a.type] - ALERT_TYPE_ORDER[b.type])
  const priority = calculatePriority(alerts, input.studentStatus)

  return {
    studentId: input.studentId,
    priority,
    alerts,
    summary: alerts.length === 0
      ? 'Şu anda anlamlı bir dikkat sinyali yok.'
      : `${alerts.slice(0, 2).map(alert => alert.title).join(' ve ')} nedeniyle takip edilmeli.`,
    suggestedAction: buildSuggestedAction(priority, alerts, upcomingMeeting),
    needsMeeting: (priority === 'high' || priority === 'critical') && !upcomingMeeting,
  }
}
