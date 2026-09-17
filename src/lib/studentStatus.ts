export type StudentStatusLevel = 'green' | 'yellow' | 'red' | 'neutral'
export type TrendDirection = 'up' | 'down' | 'stable' | 'insufficient'

export type PerformanceSignal = {
  daily_hours?: number | null
  tyt_net?: number | null
  ayt_net?: number | null
  date?: string | null
  created_at?: string | null
}

export type TaskSignal = {
  created_at?: string | null
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
  weeklyStudy?: ReturnType<typeof weeklyStudyComparison>
  weeklyTasks?: { assigned: number; completed: number; completionRate: number | null }
  taskCompletionRate: number | null
  totalTasks: number
  evaluatedTasks: number
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
  label: 'İyi ilerliyor' | 'Takip edilmeli' | 'Müdahale gerekli' | 'Veri birikiyor'
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
    return { previous: null, current: values[0] ?? null, delta: null, trend: 'insufficient' }
  }

  const previous = values[values.length - 2]
  const current = values[values.length - 1]
  const delta = current - previous
  const trend = delta >= positiveThreshold(previous)
    ? 'up'
    : delta <= -negativeThreshold(previous)
      ? 'down'
      : 'stable'

  return {
    previous: round(previous, 2),
    current: round(current, 2),
    delta: round(delta, 2),
    trend,
  }
}

// Equal rolling seven-day windows; missing days never become observations.
export function weeklyStudyComparison(records: PerformanceSignal[], now: Date) {
  const dayKey = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(date)
  const end = dayKey(now)
  const boundary = (days: number) => dayKey(new Date(now.getTime() - days * 86_400_000))
  const middle = boundary(7)
  const start = boundary(14)
  const days = new Map<string, number>()
  for (const row of records) {
    const raw = row.date || row.created_at
    if (!raw) continue
    const parsed = new Date(raw)
    if (!Number.isFinite(parsed.getTime())) continue
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    if (dateOnly && parsed.toISOString().slice(0, 10) !== raw) continue
    const day = dateOnly ? raw : dayKey(parsed)
    if (day > start && day <= end && typeof row.daily_hours === 'number' && Number.isFinite(row.daily_hours) && row.daily_hours >= 0) {
      days.set(day, (days.get(day) ?? 0) + row.daily_hours)
    }
  }
  const previousDays = [...days].filter(([day]) => day <= middle)
  const currentDays = [...days].filter(([day]) => day > middle)
  const sum = (entries: Array<[string, number]>) => entries.length ? round(entries.reduce((sum, [, hours]) => sum + hours, 0), 2) : null
  const previous = sum(previousDays)
  const current = sum(currentDays)
  const comparable = previousDays.length >= 2 && currentDays.length >= 2
  return { previous, current, delta: comparable ? round(current! - previous!, 2) : null,
    hasData: current !== null, comparable, previousDays: previousDays.length, currentDays: currentDays.length,
    start, middle, end }
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
  const weeklyStudy = weeklyStudyComparison(input.performance, now)
  const weeklyTasks = input.tasks.filter(task => {
    const day = task.created_at?.slice(0, 10)
    return day && day > weeklyStudy.middle && day <= weeklyStudy.end
  })
  const weeklyCompleted = weeklyTasks.filter(task => task.status === true).length
  const previousStudy = weeklyStudy.previous === null ? null : weeklyStudy.previous / weeklyStudy.previousDays
  const currentStudy = weeklyStudy.current === null ? null : weeklyStudy.current / weeklyStudy.currentDays
  const studyDelta = weeklyStudy.comparable ? currentStudy! - previousStudy! : null
  const studyHours: MetricComparison = { previous: previousStudy, current: currentStudy, delta: studyDelta,
    trend: studyDelta === null ? 'insufficient' : studyDelta >= STUDENT_STATUS_RULES.studyHoursAbsoluteChange ? 'up'
      : studyDelta <= -Math.max(STUDENT_STATUS_RULES.studyHoursAbsoluteChange, previousStudy! * STUDENT_STATUS_RULES.studyHoursRelativeDecline) ? 'down' : 'stable' }
  const performanceTrend = combinePerformanceTrend(tyt, ayt)

  const totalTasks = input.tasks.length
  const completedTasks = input.tasks.filter(task => task.status === true).length
  const openTasks = totalTasks - completedTasks
  const today = localDateKey(now)
  // Date-only deadlines remain open through the end of their local calendar day.
  const isPastDue = (task: TaskSignal) => {
    const day = task.due_date?.slice(0, 10)
    return !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) &&
      new Date(day).toISOString().slice(0, 10) === day && day < today
  }
  const overdueTasks = input.tasks.filter(task => task.status !== true && isPastDue(task)).length
  const evaluatedTasks = completedTasks + overdueTasks
  const taskCompletionRate = evaluatedTasks > 0 ? round((completedTasks / evaluatedTasks) * 100, 0) : null
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
      evaluatedTasks >= STUDENT_STATUS_RULES.minimumTasksForLowRate &&
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
  const hasEnoughData = performanceTrend !== 'insufficient' || studyHours.trend !== 'insufficient' ||
    evaluatedTasks >= STUDENT_STATUS_RULES.minimumTasksForLowRate
  let level: StudentStatusLevel

  if (!hasEnoughData && warnings.length === 0) {
    level = 'neutral'
  } else if (
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

  const label = level === 'neutral' ? 'Veri birikiyor' : level === 'green'
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
      weeklyStudy,
      weeklyTasks: { assigned: weeklyTasks.length, completed: weeklyCompleted,
        completionRate: weeklyTasks.length ? round(weeklyCompleted / weeklyTasks.length * 100, 0) : null },
      taskCompletionRate,
      totalTasks,
      evaluatedTasks,
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
