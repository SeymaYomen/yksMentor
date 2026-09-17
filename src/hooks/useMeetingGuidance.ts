import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildMeetingBriefing, type MeetingActionItem, type MeetingBriefing } from '../lib/meetingBriefing'
import { calculateGoalProgress, type StudentGoal } from '../lib/goalProgress'
import { selectCurrentGoal } from '../lib/goalSelection'
import { loadTopicPerformanceSignals, type StudentTopicPerformanceSignal } from '../lib/academicData'
import { calculateCompetencyMap } from '../lib/competencyMap'
import { calculateStudentStatus } from '../lib/studentStatus'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { loadStudyPerformance } from '../lib/studySessionData'
import type { Meeting } from './useMeetings'
import type { UserRole } from './useAuth'

type PerformanceRow = {
  student_id: string
  daily_hours: number | null
  tyt_net: number | null
  ayt_net: number | null
  date: string | null
  created_at: string | null
}

type TaskRow = {
  student_id: string
  status: boolean | null
  due_date: string | null
  created_at: string | null
}

type CreateActionItemInput = {
  meetingId: string
  text: string
  kind: MeetingActionItem['kind']
  dueDate?: string | null
}

function groupByStudent<T extends { student_id: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((groups, row) => {
    ;(groups[row.student_id] ??= []).push(row)
    return groups
  }, {})
}

function groupItemsByMeeting(items: MeetingActionItem[]) {
  return items.reduce<Record<string, MeetingActionItem[]>>((groups, item) => {
    ;(groups[item.meeting_id] ??= []).push(item)
    return groups
  }, {})
}

export function useMeetingGuidance(role: UserRole | undefined, userId: string | undefined, meetings: Meeting[]) {
  const [performance, setPerformance] = useState<PerformanceRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([])
  const [goals, setGoals] = useState<StudentGoal[]>([])
  const [topicPerformance, setTopicPerformance] = useState<StudentTopicPerformanceSignal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const studentIds = useMemo(() => [...new Set(meetings.map(meeting => meeting.student_id))], [meetings])
  const studentIdsKey = studentIds.join(',')

  const reload = useCallback(async () => {
    if (!role || !userId || studentIds.length === 0) {
      setPerformance([])
      setTasks([])
      setActionItems([])
      setGoals([])
      setTopicPerformance([])
      setError(null)
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setError(new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.'))
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // These filters reduce payload size only. Existing table RLS remains the
      // authorization boundary for both mentor and student reads.
      const [performanceResult, taskResult, actionItemResult, goalResult, topicPerformanceResult] = await Promise.all([
        loadStudyPerformance(studentIds),
        supabase
          .from('tasks')
          .select('student_id, status, due_date, created_at')
          .in('student_id', studentIds),
        supabase
          .from('meeting_action_items')
          .select('id, meeting_id, student_id, teacher_id, item_text, kind, status, due_date, created_at, completed_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('student_goals')
          .select('*')
          .in('student_id', studentIds)
          .eq('is_active', true),
        loadTopicPerformanceSignals(studentIds).catch(caughtError => {
          console.error('Meeting academic competency data could not be loaded:')
          return []
        }),
      ])

      if (taskResult.error) throw taskResult.error
      if (actionItemResult.error) throw actionItemResult.error
      if (goalResult.error) throw goalResult.error

      setPerformance(performanceResult)
      setTasks((taskResult.data ?? []) as TaskRow[])
      setActionItems((actionItemResult.data ?? []) as MeetingActionItem[])
      setGoals((goalResult.data ?? []) as StudentGoal[])
      setTopicPerformance(topicPerformanceResult)
    } catch (caughtError) {
      console.error('Meeting guidance data could not be loaded:')
      setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
    } finally {
      setLoading(false)
    }
  }, [role, userId, studentIdsKey])

  useEffect(() => {
    void reload()
    const handleUpdate = () => void reload()
    window.addEventListener('meeting_guidance_updated', handleUpdate)
    window.addEventListener('performance_updated', handleUpdate)
    window.addEventListener('tasks_updated', handleUpdate)
    window.addEventListener('goal_updated', handleUpdate)
    window.addEventListener('topic_performance_updated', handleUpdate)
    return () => {
      window.removeEventListener('meeting_guidance_updated', handleUpdate)
      window.removeEventListener('performance_updated', handleUpdate)
      window.removeEventListener('tasks_updated', handleUpdate)
      window.removeEventListener('goal_updated', handleUpdate)
      window.removeEventListener('topic_performance_updated', handleUpdate)
    }
  }, [reload])

  const guidance = useMemo(() => {
    const performanceByStudent = groupByStudent(performance)
    const tasksByStudent = groupByStudent(tasks)
    const meetingsByStudent = groupByStudent(meetings)
    const itemsByStudent = groupByStudent(actionItems)
    const goalsByStudent = groupByStudent(goals)
    const topicPerformanceByStudent = topicPerformance.reduce<Record<string, StudentTopicPerformanceSignal[]>>((groups, row) => {
      ;(groups[row.studentId] ??= []).push(row)
      return groups
    }, {})
    const briefingsByMeeting: Record<string, MeetingBriefing> = {}

    meetings.forEach(meeting => {
      if (meeting.status !== 'scheduled') return
      const studentPerformance = performanceByStudent[meeting.student_id] ?? []
      const studentTasks = tasksByStudent[meeting.student_id] ?? []
      const studentMeetings = meetingsByStudent[meeting.student_id] ?? []
      const studentActionItems = itemsByStudent[meeting.student_id] ?? []
      const studentStatus = calculateStudentStatus({
        performance: studentPerformance,
        tasks: studentTasks,
        meetings: studentMeetings,
      })
      const competencyMap = calculateCompetencyMap(topicPerformanceByStudent[meeting.student_id] ?? [])
      const goalProgress = calculateGoalProgress({
        goal: selectCurrentGoal(goalsByStudent[meeting.student_id] ?? [], meeting.student_id),
        performance: studentPerformance,
        studentStatus,
        academicInsights: competencyMap.topics.flatMap(topic => topic.status === 'insufficient_data' ? [] : [{
          examType: topic.examType,
          topicName: topic.topicName,
          status: topic.status,
          trend: topic.trend,
        }]),
      })

      briefingsByMeeting[meeting.id] = buildMeetingBriefing({
        targetMeeting: meeting,
        studentStatus,
        goalProgress,
        competencyMap,
        performance: studentPerformance,
        tasks: studentTasks,
        meetings: studentMeetings,
        actionItems: studentActionItems,
      })
    })

    return {
      briefingsByMeeting,
      actionItemsByMeeting: groupItemsByMeeting(actionItems),
    }
  }, [actionItems, goals, meetings, performance, tasks, topicPerformance])

  async function saveOutcomeSummary(meetingId: string, summary: string) {
    if (!supabase) throw new Error('Supabase yapılandırılmamış.')
    const { error: rpcError } = await supabase.rpc('save_meeting_outcome_summary', {
      p_meeting_id: meetingId,
      p_summary: summary,
    })
    if (rpcError) throw rpcError
    window.dispatchEvent(new Event('meetings_updated'))
  }

  async function createActionItem(input: CreateActionItemInput) {
    if (!supabase) throw new Error('Supabase yapılandırılmamış.')
    const { error: rpcError } = await supabase.rpc('create_meeting_action_item', {
      p_meeting_id: input.meetingId,
      p_text: input.text,
      p_kind: input.kind,
      p_due_date: input.dueDate || null,
    })
    if (rpcError) throw rpcError
    window.dispatchEvent(new Event('meeting_guidance_updated'))
  }

  async function updateActionItemStatus(itemId: string, status: MeetingActionItem['status']) {
    if (!supabase) throw new Error('Supabase yapılandırılmamış.')
    const { error: rpcError } = await supabase.rpc('update_meeting_action_item_status', {
      p_item_id: itemId,
      p_status: status,
    })
    if (rpcError) throw rpcError
    window.dispatchEvent(new Event('meeting_guidance_updated'))
  }

  return {
    ...guidance,
    loading,
    error,
    reload,
    saveOutcomeSummary,
    createActionItem,
    updateActionItemStatus,
  }
}
