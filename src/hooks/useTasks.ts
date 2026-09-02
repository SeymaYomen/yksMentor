import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type Task = {
  id: string
  student_id: string
  title: string
  status: boolean
  due_date?: string | null
  exam_type?: 'TYT' | 'AYT' | null
  subject_id?: string | null
  topic_id?: string | null
  subject?: { name: string } | null
  topic?: { name: string } | null
}

export type TaskAcademicLink = {
  examType?: 'TYT' | 'AYT' | null
  subjectId?: string | null
  topicId?: string | null
}

export function useTasks(studentId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!studentId) return
    fetchTasks()

    // AssignTaskForm'dan fırlatılan olayı dinle → otomatik yenile
    const handleUpdate = () => fetchTasks()
    window.addEventListener('tasks_updated', handleUpdate)
    return () => window.removeEventListener('tasks_updated', handleUpdate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function fetchTasks() {
    if (!studentId || !supabase) {
      setTasks([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, subject:exam_subjects(name), topic:exam_topics(name)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      console.error(error)
      setTasks([])
      return
    }
    setTasks(data as any)
  }

  async function createTask(student_id: string, title: string, due_date?: string, academic?: TaskAcademicLink) {
    if (!supabase) throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
    const hasAcademicLink = Boolean(academic?.examType || academic?.subjectId || academic?.topicId)
    const { data, error } = hasAcademicLink
      ? await supabase.rpc('assign_academic_task', {
        p_student_id: student_id,
        p_title: title,
        p_due_date: due_date || null,
        p_description: null,
        p_exam_type: academic?.examType ?? null,
        p_subject_id: academic?.subjectId ?? null,
        p_topic_id: academic?.topicId ?? null,
      })
      : await supabase.rpc('assign_task', {
        p_student_id: student_id,
        p_title: title,
        p_due_date: due_date || null,
        p_description: null,
      })
    if (error) throw error
    window.dispatchEvent(new Event('tasks_updated'))
    await fetchTasks()
    return data
  }

  async function toggleTaskStatus(id: string, status: boolean) {
    if (!supabase) throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
    const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select().single()
    if (error) throw error
    window.dispatchEvent(new Event('tasks_updated'))
    await fetchTasks()
    return data
  }

  return { tasks, loading, fetchTasks, createTask, toggleTaskStatus }
}

export async function getStudentsByTeacher(teacherId: string) {
  if (!supabase) throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
  const { data, error } = await supabase.from('profiles').select('id, username').eq('mentor_id', teacherId)
  if (error) throw error
  return data
}
