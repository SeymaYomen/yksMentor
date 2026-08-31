import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
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

async function loadMentorStudentSummaries(teacherId: string): Promise<MentorStudentSummary[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
  }

  // teacherId is only a query filter. Authorization remains server-side in the
  // existing profiles/performance/tasks/meetings RLS policies.
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, created_at')
    .eq('mentor_id', teacherId)
    .order('username', { ascending: true })

  if (profileError) throw profileError

  const profiles = (profileData ?? []) as ProfileRow[]
  const studentIds = profiles.map(profile => profile.id)
  if (studentIds.length === 0) return []

  const [performanceResult, taskResult, meetingResult] = await Promise.all([
    supabase
      .from('performance')
      .select('student_id, daily_hours, tyt_net, ayt_net, date, created_at')
      .in('student_id', studentIds),
    supabase
      .from('tasks')
      .select('student_id, status, due_date')
      .in('student_id', studentIds),
    supabase
      .from('meetings')
      .select('student_id, status, scheduled_at')
      .in('student_id', studentIds),
  ])

  if (performanceResult.error) throw performanceResult.error
  if (taskResult.error) throw taskResult.error
  if (meetingResult.error) throw meetingResult.error

  const performanceByStudent = groupByStudent((performanceResult.data ?? []) as PerformanceRow[])
  const tasksByStudent = groupByStudent((taskResult.data ?? []) as TaskRow[])
  const meetingsByStudent = groupByStudent((meetingResult.data ?? []) as MeetingRow[])
  const now = new Date()

  return profiles.map(profile => ({
    ...profile,
    status: calculateStudentStatus({
      performance: performanceByStudent[profile.id] ?? [],
      tasks: tasksByStudent[profile.id] ?? [],
      meetings: meetingsByStudent[profile.id] ?? [],
      now,
    }),
  }))
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
      console.error('Mentor student summaries could not be loaded:', caughtError)
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

    return () => {
      window.removeEventListener('performance_updated', handleDataUpdate)
      window.removeEventListener('tasks_updated', handleDataUpdate)
      window.removeEventListener('meetings_updated', handleDataUpdate)
    }
  }, [reload])

  return { students, loading, error, reload }
}
