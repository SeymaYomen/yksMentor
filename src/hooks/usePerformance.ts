import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type PerfRow = {
  id: string
  student_id: string
  daily_hours?: number | null
  tyt_net?: number | null
  ayt_net?: number | null
  date?: string | null
  created_at?: string | null
}

export default function usePerformance(studentId: string) {
  const [data, setData] = useState<PerfRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    if (!studentId) {
      setData([])
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) setError(new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.'))
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const { data: rows, error } = await supabase
          .from('performance')
          .select('id, student_id, daily_hours, tyt_net, ayt_net, date, created_at')
          .eq('student_id', studentId)

        if (error) throw error

        const mapped = (rows || [])
          .map((r: any) => ({
            id: r.id,
            student_id: r.student_id,
            daily_hours: r.daily_hours,
            tyt_net: r.tyt_net,
            ayt_net: r.ayt_net,
            date: r.date || r.created_at,
            created_at: r.created_at,
          }))
          .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

        if (!cancelled) setData(mapped)
      } catch (err) {
        if (!cancelled) {
          console.error('usePerformance fetch error:', err)
          setError(err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    // PerformanceForm'dan fırlatılan 'performance_updated' olayını dinle → otomatik yenile
    const handleUpdate = () => load()
    window.addEventListener('performance_updated', handleUpdate)

    return () => {
      cancelled = true
      window.removeEventListener('performance_updated', handleUpdate)
    }
  }, [studentId])

  return { data, loading, error }
}
