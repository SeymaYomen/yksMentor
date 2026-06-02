import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
  profiles?: { username: string } // related profile (student for teacher, teacher for student)
}

export function useMeetings(role: 'teacher' | 'student', userId: string | undefined) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  async function loadMeetings() {
    if (!userId || !supabase) return
    setLoading(true)
    
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
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMeetings()
    
    const handleUpdate = () => loadMeetings()
    window.addEventListener('meetings_updated', handleUpdate)
    return () => window.removeEventListener('meetings_updated', handleUpdate)
  }, [role, userId])

  async function scheduleMeeting(data: Partial<Meeting>) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.from('meetings').insert([data])
    if (error) throw error
    window.dispatchEvent(new Event('meetings_updated'))
  }

  async function updateMeetingStatus(id: string, status: 'scheduled' | 'completed' | 'cancelled') {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.from('meetings').update({ status }).eq('id', id)
    if (error) throw error
    window.dispatchEvent(new Event('meetings_updated'))
  }

  return { meetings, loading, scheduleMeeting, updateMeetingStatus, reload: loadMeetings }
}
