import { weeklyStudyComparison, type StudentStatusResult } from './studentStatus.ts'
import type { GoalProgressResult } from './goalProgress'
import type { CompetencyMapResult } from './competencyMap'

export type BriefingPerformanceRow = {
  daily_hours?: number | null
  tyt_net?: number | null
  ayt_net?: number | null
  date?: string | null
  created_at?: string | null
}

export type BriefingTaskRow = {
  status?: boolean | null
  due_date?: string | null
  created_at?: string | null
}

export type BriefingMeetingRow = {
  id: string
  status: string
  scheduled_at?: string | null
}

export type MeetingActionItem = {
  id: string
  meeting_id: string
  student_id: string
  teacher_id: string
  item_text: string
  kind: 'action' | 'followup'
  status: 'open' | 'completed' | 'cancelled'
  due_date: string | null
  created_at: string
  completed_at: string | null
}

export type BriefingMetricChange = {
  previous: number | null
  current: number | null
  delta: number | null
  hasData: boolean
}

export type MeetingBriefing = {
  studentStatus: StudentStatusResult
  goalProgress: GoalProgressResult | null
  competencyMap: CompetencyMapResult | null
  period: {
    start: string
    end: string
    label: string
    previousMeetingId: string | null
    isFirstMeeting: boolean
  }
  performance: {
    tyt: BriefingMetricChange
    ayt: BriefingMetricChange
    weeklyStudyHours: BriefingMetricChange
  }
  tasks: {
    total: number
    completed: number
    open: number
    overdue: number
    hasData: boolean
  }
  warnings: string[]
  positives: string[]
  previousOpenItems: Array<MeetingActionItem & { isOverdue: boolean }>
  hasPeriodActivity: boolean
}

export type BuildMeetingBriefingInput = {
  targetMeeting: BriefingMeetingRow
  studentStatus: StudentStatusResult
  goalProgress?: GoalProgressResult
  competencyMap?: CompetencyMapResult
  performance: BriefingPerformanceRow[]
  tasks: BriefingTaskRow[]
  meetings: BriefingMeetingRow[]
  actionItems: MeetingActionItem[]
  now?: Date
}

const FIRST_MEETING_LOOKBACK_DAYS = 14

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function timestamp(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function performanceTimestamp(row: BriefingPerformanceRow) {
  return timestamp(row.date ?? row.created_at)
}

function metricChange(rows: BriefingPerformanceRow[], key: 'tyt_net' | 'ayt_net'): BriefingMetricChange {
  const values = rows
    .map(row => ({ value: row[key], time: performanceTimestamp(row) }))
    .filter((entry): entry is { value: number; time: number } => (
      typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.time !== null
    ))
    .sort((a, b) => a.time - b.time)

  if (values.length < 2) return { previous: null, current: values[0]?.value ?? null, delta: null, hasData: values.length > 0 }

  const previous = values[values.length - 2].value
  const current = values[values.length - 1].value
  return { previous, current, delta: round(current - previous), hasData: true }
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function periodPerformanceRows(
  rows: BriefingPerformanceRow[],
  start: number,
  end: number,
  allowNearestFallback: boolean,
) {
  const inPeriod = rows.filter(row => {
    const time = performanceTimestamp(row)
    return time !== null && time >= start && time <= end
  })

  if (!allowNearestFallback || inPeriod.length >= 2) return inPeriod

  return rows
    .filter(row => {
      const time = performanceTimestamp(row)
      return time !== null && time <= end
    })
    .sort((a, b) => (performanceTimestamp(a) ?? 0) - (performanceTimestamp(b) ?? 0))
    .slice(-2)
}

export function buildMeetingBriefing(input: BuildMeetingBriefingInput): MeetingBriefing {
  const now = input.now ?? new Date()
  const end = now.getTime()
  const targetTime = timestamp(input.targetMeeting.scheduled_at) ?? end
  const previousMeetings = input.meetings
    .filter(meeting => {
      const time = timestamp(meeting.scheduled_at)
      return meeting.id !== input.targetMeeting.id && meeting.status === 'completed' && time !== null && time < targetTime && time <= end
    })
    .sort((a, b) => (timestamp(b.scheduled_at) ?? 0) - (timestamp(a.scheduled_at) ?? 0))
  const previousMeeting = previousMeetings[0] ?? null
  const defaultStart = end - FIRST_MEETING_LOOKBACK_DAYS * 86_400_000
  let start = previousMeeting ? (timestamp(previousMeeting.scheduled_at) ?? defaultStart) : defaultStart
  const performanceRows = periodPerformanceRows(input.performance, start, end, previousMeeting === null)

  if (previousMeeting === null && performanceRows.length > 0) {
    const earliestFallback = Math.min(...performanceRows.map(row => performanceTimestamp(row) ?? end))
    start = Math.min(start, earliestFallback)
  }

  const tasks = input.tasks.filter(task => {
    const time = timestamp(task.created_at)
    return time !== null && time >= start && time <= end
  })
  const today = localDateKey(now)
  const completedTasks = tasks.filter(task => task.status === true).length
  const overdueTasks = tasks.filter(task => (
    task.status !== true && typeof task.due_date === 'string' && task.due_date.slice(0, 10) < today
  )).length
  const eligibleMeetingIds = new Set(previousMeetings.map(meeting => meeting.id))
  const previousOpenItems = input.actionItems
    .filter(item => item.status === 'open' && eligibleMeetingIds.has(item.meeting_id))
    .map(item => ({
      ...item,
      isOverdue: typeof item.due_date === 'string' && item.due_date.slice(0, 10) < today,
    }))
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || a.created_at.localeCompare(b.created_at))
  const overdueActionItems = previousOpenItems.filter(item => item.isOverdue).length
  const warnings = [...input.studentStatus.warnings]

  if (overdueActionItems > 0) {
    warnings.push(`${overdueActionItems} açık görüşme kararının süresi geçti.`)
  }

  return {
    studentStatus: input.studentStatus,
    goalProgress: input.goalProgress ?? null,
    competencyMap: input.competencyMap ?? null,
    period: {
      start: new Date(start).toISOString(),
      end: now.toISOString(),
      label: previousMeeting ? 'Son tamamlanan görüşmeden beri' : 'İlk görüşme için yakın dönem',
      previousMeetingId: previousMeeting?.id ?? null,
      isFirstMeeting: previousMeeting === null,
    },
    performance: {
      tyt: metricChange(input.performance.filter(row => (performanceTimestamp(row) ?? Infinity) <= end), 'tyt_net'),
      ayt: metricChange(input.performance.filter(row => (performanceTimestamp(row) ?? Infinity) <= end), 'ayt_net'),
      weeklyStudyHours: weeklyStudyComparison(input.performance, now),
    },
    tasks: {
      total: tasks.length,
      completed: completedTasks,
      open: tasks.length - completedTasks,
      overdue: overdueTasks,
      hasData: tasks.length > 0,
    },
    warnings,
    positives: [...input.studentStatus.positives],
    previousOpenItems,
    hasPeriodActivity: performanceRows.length > 0 || tasks.length > 0,
  }
}
