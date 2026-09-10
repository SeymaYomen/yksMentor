import { supabase } from './supabase'
import { mergeStudyHours, prepareStudySession, type StudyDuration, type StudyPerformanceRow, type StudySession, type StudySessionInput } from './studySessions'

function client() {
  if (!supabase) throw new Error('Çalışma hizmetine bağlanılamadı.')
  return supabase
}

export async function loadStudySessions(studentId: string): Promise<StudySession[]> {
  return readPages<StudySession>((from, to) => client().from('study_sessions').select('*')
    .eq('student_id', studentId).order('id').range(from, to))
}

// Supabase caps individual responses. Do not truncate a day's total or history.
async function readPages<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  const size = 500
  for (let offset = 0; ; offset += size) {
    const { data, error } = await query(offset, offset + size - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < size) return rows
  }
}

export async function createStudySession(input: StudySessionInput): Promise<StudySession> {
  const payload = prepareStudySession(input)
  const { data, error } = await client().from('study_sessions').insert(payload).select('*').single()
  if (error) throw error
  return data as StudySession
}

export async function loadStudyPerformance(studentIds: string[]): Promise<StudyPerformanceRow[]> {
  if (!studentIds.length) return []
  const db = client()
  const [legacy, sessions] = await Promise.all([
    readPages<StudyPerformanceRow>((from, to) => db.from('performance')
      .select('id, student_id, daily_hours, tyt_net, ayt_net, date, created_at').in('student_id', studentIds).order('id').range(from, to)),
    readPages<StudyDuration>((from, to) => db.from('study_sessions')
      .select('student_id, study_date, duration_minutes').in('student_id', studentIds).order('id').range(from, to)),
  ])
  return mergeStudyHours(legacy, sessions)
}
