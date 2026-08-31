export type StudentStatusLevel = 'green' | 'yellow' | 'red'
export type TrendDirection = 'up' | 'down' | 'stable' | 'insufficient'

export type PerformanceSignal = {
  daily_hours?: number | null
  tyt_net?: number | null
  ayt_net?: number | null
  date?: string | null
  created_at?: string | null
}

export type TaskSignal = {
  status?: boolean | null
  due_date?: string | null
}

export type MeetingSignal = {
  status?: string | null
  scheduled_at?: string | null
}

export type StudentStatusInput = {
  performance: PerformanceSignal[]
  tasks: TaskSignal[]
  meetings: MeetingSignal[]
  now?: Date
}

export type MetricComparison = {
  previous: number | null
  current: number | null
  delta: number | null
  trend: TrendDirection
}

export type StudentStatusMetrics = {
  taskCompletionRate: number | null
  totalTasks: number
  openTasks: number
  overdueTasks: number
  performanceTrend: TrendDirection
  studyTrend: TrendDirection
  tyt: MetricComparison
  ayt: MetricComparison
  studyHours: MetricComparison
  lastMeetingDays: number | null
  nextMeetingAt: string | null
}

export type StudentStatusResult = {
  level: StudentStatusLevel
  label: 'İyi ilerliyor' | 'Takip edilmeli' | 'Müdahale gerekli'
  reasons: string[]
  warnings: string[]
  positives: string[]
  metrics: StudentStatusMetrics
  hasEnoughData: boolean
}

export const STUDENT_STATUS_RULES = {
  comparisonRecordLimit: 6,
  tytNetChange: 2,
  aytNetChange: 2,
  studyHoursAbsoluteChange: 0.5,
  studyHoursRelativeDecline: 0.2,
  highTaskCompletionRate: 75,
  lowTaskCompletionRate: 50,
  minimumTasksForLowRate: 3,
  multipleOverdueTasks: 2,
  staleMeetingDays: 14,
  redStrongWarningCount: 2,
  redMixedStrongWarningCount: 1,
  redMixedSoftWarningCount: 2,
} as const

type NumericPerformanceKey = 'daily_hours' | 'tyt_net' | 'ayt_net'

function round(value: number, digits = 1) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)
}

function recordTimestamp(record: PerformanceSignal) {
  const value = record.date ?? record.created_at
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function compareMetric(
  records: PerformanceSignal[],
  key: NumericPerformanceKey,
  positiveThreshold: (previous: number) => number,
  negativeThreshold = positiveThreshold,
): MetricComparison {
  const values = [...records]
    .sort((a, b) => recordTimestamp(a) - recordTimestamp(b))
    .map(record => record[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .slice(-STUDENT_STATUS_RULES.comparisonRecordLimit)

  if (values.length < 2) {
    return { previous: null, current: null, delta: null, trend: 'insufficient' }
  }

  const splitIndex = Math.floor(values.length / 2)
  const previous = average(values.slice(0, splitIndex))
  const current = average(values.slice(splitIndex))
  const delta = current - previous
  const trend = delta >= positiveThreshold(previous)
    ? 'up'
    : delta <= -negativeThreshold(previous)
      ? 'down'
      : 'stable'

  return {
    previous: round(previous),
    current: round(current),
    delta: round(delta),
    trend,
  }
}

function combinePerformanceTrend(tyt: MetricComparison, ayt: MetricComparison): TrendDirection {
  const trends = [tyt.trend, ayt.trend].filter(trend => trend !== 'insufficient')
  if (trends.length === 0) return 'insufficient'
  if (trends.includes('down') && !trends.includes('up')) return 'down'
  if (trends.includes('up') && !trends.includes('down')) return 'up'
  return 'stable'
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function meetingMetrics(meetings: MeetingSignal[], now: Date) {
  const completedDates = meetings
    .filter(meeting => meeting.status === 'completed' && meeting.scheduled_at)
    .map(meeting => new Date(meeting.scheduled_at as string).getTime())
    .filter(timestamp => Number.isFinite(timestamp) && timestamp <= now.getTime())
    .sort((a, b) => b - a)

  const upcomingDates = meetings
    .filter(meeting => meeting.status === 'scheduled' && meeting.scheduled_at)
    .map(meeting => ({ value: meeting.scheduled_at as string, timestamp: new Date(meeting.scheduled_at as string).getTime() }))
    .filter(meeting => Number.isFinite(meeting.timestamp) && meeting.timestamp >= now.getTime())
    .sort((a, b) => a.timestamp - b.timestamp)

  return {
    lastMeetingDays: completedDates.length > 0
      ? Math.max(0, Math.floor((now.getTime() - completedDates[0]) / 86_400_000))
      : null,
    nextMeetingAt: upcomingDates[0]?.value ?? null,
  }
}

export function calculateStudentStatus(input: StudentStatusInput): StudentStatusResult {
  const now = input.now ?? new Date()
  const tyt = compareMetric(input.performance, 'tyt_net', () => STUDENT_STATUS_RULES.tytNetChange)
  const ayt = compareMetric(input.performance, 'ayt_net', () => STUDENT_STATUS_RULES.aytNetChange)
  const studyHours = compareMetric(
    input.performance,
    'daily_hours',
    () => STUDENT_STATUS_RULES.studyHoursAbsoluteChange,
    previous => Math.max(
      STUDENT_STATUS_RULES.studyHoursAbsoluteChange,
      previous * STUDENT_STATUS_RULES.studyHoursRelativeDecline,
    ),
  )
  const performanceTrend = combinePerformanceTrend(tyt, ayt)

  const totalTasks = input.tasks.length
  const completedTasks = input.tasks.filter(task => task.status === true).length
  const openTasks = totalTasks - completedTasks
  const today = localDateKey(now)
  const overdueTasks = input.tasks.filter(task => (
    task.status !== true && typeof task.due_date === 'string' && task.due_date.slice(0, 10) < today
  )).length
  const taskCompletionRate = totalTasks > 0 ? round((completedTasks / totalTasks) * 100, 0) : null
  const { lastMeetingDays, nextMeetingAt } = meetingMetrics(input.meetings, now)

  const positives: string[] = []
  const strongWarnings: string[] = []
  const softWarnings: string[] = []

  if (performanceTrend === 'up') {
    const risingMetrics = [tyt.trend === 'up' ? 'TYT' : null, ayt.trend === 'up' ? 'AYT' : null].filter(Boolean).join(' ve ')
    positives.push(`Son ölçümlerde ${risingMetrics} performansı yükseliyor.`)
  } else if (performanceTrend === 'down') {
    const fallingMetrics = [tyt.trend === 'down' ? 'TYT' : null, ayt.trend === 'down' ? 'AYT' : null].filter(Boolean).join(' ve ')
    strongWarnings.push(`Son ölçümlerde ${fallingMetrics} performansı belirgin biçimde düştü.`)
  }

  if (studyHours.trend === 'up') {
    positives.push('Son dönemde çalışma süresi arttı.')
  } else if (studyHours.trend === 'stable' && (studyHours.current ?? 0) > 0) {
    positives.push('Çalışma süresi son dönemde düzenli seyrediyor.')
  } else if (studyHours.trend === 'down') {
    strongWarnings.push('Son dönemde çalışma süresi belirgin biçimde azaldı.')
  }

  if (taskCompletionRate !== null) {
    if (taskCompletionRate >= STUDENT_STATUS_RULES.highTaskCompletionRate) {
      positives.push(`Görevlerin %${formatNumber(taskCompletionRate)}’i tamamlandı.`)
    } else if (
      totalTasks >= STUDENT_STATUS_RULES.minimumTasksForLowRate &&
      taskCompletionRate < STUDENT_STATUS_RULES.lowTaskCompletionRate
    ) {
      strongWarnings.push(`Görev tamamlama oranı %${formatNumber(taskCompletionRate)} ile düşük.`)
    } else if (taskCompletionRate < STUDENT_STATUS_RULES.highTaskCompletionRate) {
      softWarnings.push(`Görev tamamlama oranı %${formatNumber(taskCompletionRate)} seviyesinde.`)
    }
  }

  if (overdueTasks >= STUDENT_STATUS_RULES.multipleOverdueTasks) {
    strongWarnings.push(`${overdueTasks} görev son teslim tarihini geçti.`)
  } else if (overdueTasks === 1) {
    softWarnings.push('1 görev son teslim tarihini geçti.')
  }

  if (lastMeetingDays !== null) {
    if (lastMeetingDays > STUDENT_STATUS_RULES.staleMeetingDays) {
      softWarnings.push(`Son tamamlanan görüşmenin üzerinden ${lastMeetingDays} gün geçti.`)
    } else {
      positives.push(`Son mentor görüşmesi ${lastMeetingDays === 0 ? 'bugün' : `${lastMeetingDays} gün önce`} tamamlandı.`)
    }
  }

  const warnings = [...strongWarnings, ...softWarnings]
  const hasEnoughData = input.performance.length >= 2 || totalTasks > 0 || lastMeetingDays !== null
  let level: StudentStatusLevel

  if (
    strongWarnings.length >= STUDENT_STATUS_RULES.redStrongWarningCount ||
    (
      strongWarnings.length >= STUDENT_STATUS_RULES.redMixedStrongWarningCount &&
      softWarnings.length >= STUDENT_STATUS_RULES.redMixedSoftWarningCount
    )
  ) {
    level = 'red'
  } else if (warnings.length > 0 || positives.length === 0) {
    level = 'yellow'
  } else {
    level = 'green'
  }

  const label = level === 'green'
    ? 'İyi ilerliyor'
    : level === 'red'
      ? 'Müdahale gerekli'
      : 'Takip edilmeli'
  const reasons = level === 'green'
    ? positives
    : warnings.length > 0
      ? warnings
      : ['Henüz güvenilir bir durum değerlendirmesi için yeterli veri yok.']

  return {
    level,
    label,
    reasons,
    warnings,
    positives,
    hasEnoughData,
    metrics: {
      taskCompletionRate,
      totalTasks,
      openTasks,
      overdueTasks,
      performanceTrend,
      studyTrend: studyHours.trend,
      tyt,
      ayt,
      studyHours,
      lastMeetingDays,
      nextMeetingAt,
    },
  }
}
