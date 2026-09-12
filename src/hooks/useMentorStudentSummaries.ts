import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { loadStudyPerformance } from '../lib/studySessionData'
import { calculateGoalProgress, type GoalProgressResult, type StudentGoal } from '../lib/goalProgress'
import { loadTopicPerformanceSignals, type StudentTopicPerformanceSignal } from '../lib/academicData'
import { calculateCompetencyMap, type CompetencyMapResult } from '../lib/competencyMap'
import { calculateMentorAlerts, type MentorAlertResult } from '../lib/mentorAlerts'
import type { MeetingActionItem } from '../lib/meetingBriefing'
import {
  calculateStudentStatus,
  type MeetingSignal,
  type PerformanceSignal,
  type StudentStatusResult,
  type TaskSignal,
} from '../lib/studentStatus'

export type MentorStudentSummary = {
  id: string
  username: string
  created_at: string | null
  status: StudentStatusResult
  goalProgress: GoalProgressResult
  competencyMap: CompetencyMapResult
  alerts: MentorAlertResult
}

type ProfileRow = {
  id: string
  username: string
  created_at: string | null
}

type PerformanceRow = PerformanceSignal & { student_id: string }
type TaskRow = TaskSignal & { student_id: string }
type MeetingRow = MeetingSignal & { student_id: string }

function groupByStudent<T extends { student_id: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((groups, row) => {
    ;(groups[row.student_id] ??= []).push(row)
    return groups
  }, {})
}

export async function loadMentorStudentSummaries(teacherId: string): Promise<MentorStudentSummary[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
  }

  // teacherId is only a query filter. Authorization remains server-side in the
  // existing profiles/performance/tasks/meetings/student_goals RLS policies.
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, created_at')
    .eq('mentor_id', teacherId)
    .order('username', { ascending: true })

  if (profileError) throw profileError

  const profiles = (profileData ?? []) as ProfileRow[]
  const studentIds = profiles.map(profile => profile.id)
  if (studentIds.length === 0) return []

  const [performanceResult, taskResult, meetingResult, goalResult, actionItemResult, topicPerformance] = await Promise.all([
    loadStudyPerformance(studentIds),
    supabase
      .from('tasks')
      .select('student_id, status, due_date, created_at')
      .in('student_id', studentIds),
    supabase
      .from('meetings')
      .select('student_id, status, scheduled_at')
      .in('student_id', studentIds),
    supabase
      .from('student_goals')
      .select('*')
      .in('student_id', studentIds)
      .eq('is_active', true),
    supabase
      .from('meeting_action_items')
      .select('*')
      .in('student_id', studentIds),
    loadTopicPerformanceSignals(studentIds).catch(caughtError => {
      console.error('Academic competency data could not be loaded:')
      return []
    }),
  ])

  if (taskResult.error) throw taskResult.error
  if (meetingResult.error) throw meetingResult.error
  if (goalResult.error) throw goalResult.error
  if (actionItemResult.error) throw actionItemResult.error

  const performanceByStudent = groupByStudent(performanceResult as PerformanceRow[])
  const tasksByStudent = groupByStudent((taskResult.data ?? []) as TaskRow[])
  const meetingsByStudent = groupByStudent((meetingResult.data ?? []) as MeetingRow[])
  const actionItemsByStudent = groupByStudent((actionItemResult.data ?? []) as MeetingActionItem[])
  const goalsByStudent = new Map(((goalResult.data ?? []) as StudentGoal[]).map(goal => [goal.student_id, goal]))
  const topicPerformanceByStudent = topicPerformance.reduce<Record<string, StudentTopicPerformanceSignal[]>>((groups, row) => {
    ;(groups[row.studentId] ??= []).push(row)
    return groups
  }, {})
  const now = new Date()

  return profiles.map(profile => {
    const performance = performanceByStudent[profile.id] ?? []
    const tasks = tasksByStudent[profile.id] ?? []
    const meetings = meetingsByStudent[profile.id] ?? []
    const status = calculateStudentStatus({
      performance,
      tasks,
      meetings,
      now,
    })
    const competencyMap = calculateCompetencyMap(topicPerformanceByStudent[profile.id] ?? [])
    const goalProgress = calculateGoalProgress({
      goal: goalsByStudent.get(profile.id) ?? null,
      performance,
      studentStatus: status,
      academicInsights: competencyMap.topics.flatMap(topic => topic.status === 'insufficient_data' ? [] : [{
        examType: topic.examType,
        topicName: topic.topicName,
        status: topic.status,
        trend: topic.trend,
      }]),
      now,
    })
    return {
      ...profile,
      status,
      competencyMap,
      goalProgress,
      alerts: calculateMentorAlerts({
        studentId: profile.id,
        studentCreatedAt: profile.created_at,
        studentStatus: status,
        goalProgress,
        competencySummary: competencyMap,
        performance,
        tasks,
        meetings,
        actionItems: actionItemsByStudent[profile.id] ?? [],
        now,
      }),
    }
  })
}

export function useMentorStudentSummaries(teacherId?: string) {
  const [students, setStudents] = useState<MentorStudentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    if (!teacherId) {
      setStudents([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setStudents(await loadMentorStudentSummaries(teacherId))
    } catch (caughtError) {
      console.error('Mentor student summaries could not be loaded:')
      setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
    } finally {
      setLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    void reload()

    const handleDataUpdate = () => void reload()
    window.addEventListener('performance_updated', handleDataUpdate)
    window.addEventListener('tasks_updated', handleDataUpdate)
    window.addEventListener('meetings_updated', handleDataUpdate)
    window.addEventListener('goal_updated', handleDataUpdate)
    window.addEventListener('topic_performance_updated', handleDataUpdate)
    window.addEventListener('meeting_guidance_updated', handleDataUpdate)

    return () => {
      window.removeEventListener('performance_updated', handleDataUpdate)
      window.removeEventListener('tasks_updated', handleDataUpdate)
      window.removeEventListener('meetings_updated', handleDataUpdate)
      window.removeEventListener('goal_updated', handleDataUpdate)
      window.removeEventListener('topic_performance_updated', handleDataUpdate)
      window.removeEventListener('meeting_guidance_updated', handleDataUpdate)
    }
  }, [reload])

  return { students, loading, error, reload }
}
