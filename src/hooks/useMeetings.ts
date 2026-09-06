import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { UserRole } from './useAuth'

export type Meeting = {
  id: string
  teacher_id: string
  student_id: string
  title: string
  description: string | null
  meeting_url: string | null
  scheduled_at: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  outcome_summary: string | null
  profiles?: { username: string } // related profile (student for teacher, teacher for student)
}

export type ScheduleMeetingInput = Pick<Meeting, 'student_id' | 'title' | 'description' | 'meeting_url' | 'scheduled_at'>

export function useMeetings(role: UserRole | undefined, userId: string | undefined) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function loadMeetings() {
    if (!role || !userId || !supabase) {
      setMeetings([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    // Fetch meetings
    let query = supabase.from('meetings').select('*, profiles!meetings_student_id_fkey(username)')
    if (role === 'teacher') {
      query = supabase.from('meetings').select('*, profiles!meetings_student_id_fkey(username)').eq('teacher_id', userId)
    } else {
      query = supabase.from('meetings').select('*, profiles!meetings_teacher_id_fkey(username)').eq('student_id', userId)
    }

    const { data, error } = await query.order('scheduled_at', { ascending: true })

    if (!error && data) {
      setMeetings(data as unknown as Meeting[])
    } else if (error) {
      console.error('Meetings could not be loaded:')
      setError(new Error(error.message))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMeetings()

    const handleUpdate = () => loadMeetings()
    window.addEventListener('meetings_updated', handleUpdate)
    return () => window.removeEventListener('meetings_updated', handleUpdate)
  }, [role, userId])

  async function scheduleMeeting(data: ScheduleMeetingInput) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.rpc('schedule_meeting', {
      p_student_id: data.student_id,
      p_title: data.title,
      p_description: data.description,
      p_meeting_url: data.meeting_url,
      p_scheduled_at: data.scheduled_at,
    })
    if (error) throw error
    window.dispatchEvent(new Event('meetings_updated'))
  }

  async function updateMeetingStatus(id: string, status: 'scheduled' | 'completed' | 'cancelled') {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.rpc('update_meeting_status', { p_meeting_id: id, p_status: status })
    if (error) throw error
    window.dispatchEvent(new Event('meetings_updated'))
  }

  return { meetings, loading, error, scheduleMeeting, updateMeetingStatus, reload: loadMeetings }
}
