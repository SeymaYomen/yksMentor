import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type Task = {
  id: string
  student_id: string
  title: string
  status: boolean
  due_date?: string | null
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
    const { data, error } = await supabase.from('tasks').select('*').eq('student_id', studentId).order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      console.error(error)
      setTasks([])
      return
    }
    setTasks(data as any)
  }

  async function createTask(student_id: string, title: string, due_date?: string) {
    if (!supabase) throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
    const { data, error } = await supabase.from('tasks').insert([{ student_id, title, due_date }]).select().single()
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
