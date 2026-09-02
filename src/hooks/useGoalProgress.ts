import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  calculateGoalProgress,
  type GoalPerformanceRow,
  type GoalProgressResult,
  type StudentGoal,
} from '../lib/goalProgress'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { StudentStatusResult } from '../lib/studentStatus'

export function useGoalProgress(studentId: string, studentStatus?: StudentStatusResult) {
  const [goal, setGoal] = useState<StudentGoal | null>(null)
  const [performance, setPerformance] = useState<GoalPerformanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    if (!studentId) {
      setGoal(null)
      setPerformance([])
      setLoading(false)
      setError(null)
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
      const [goalResult, performanceResult] = await Promise.all([
        supabase
          .from('student_goals')
          .select('*')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('performance')
          .select('tyt_net, ayt_net, date, created_at')
          .eq('student_id', studentId),
      ])

      if (goalResult.error) throw goalResult.error
      if (performanceResult.error) throw performanceResult.error
      setGoal((goalResult.data as StudentGoal | null) ?? null)
      setPerformance((performanceResult.data ?? []) as GoalPerformanceRow[])
    } catch (caughtError) {
      console.error('Goal progress could not be loaded:', caughtError)
      setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void reload()
    const handleUpdate = () => void reload()
    window.addEventListener('goal_updated', handleUpdate)
    window.addEventListener('performance_updated', handleUpdate)
    window.addEventListener('tasks_updated', handleUpdate)
    return () => {
      window.removeEventListener('goal_updated', handleUpdate)
      window.removeEventListener('performance_updated', handleUpdate)
      window.removeEventListener('tasks_updated', handleUpdate)
    }
  }, [reload])

  const progress: GoalProgressResult = useMemo(() => calculateGoalProgress({
    goal,
    performance,
    studentStatus,
  }), [goal, performance, studentStatus])

  return { goal, progress, loading, error, reload }
}
