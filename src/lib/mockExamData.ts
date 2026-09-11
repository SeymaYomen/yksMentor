import { supabase } from './supabase'
import { validateMockExam, mergeAssessmentHistory, type MockExam, type MockExamInput } from './mockExams'
import type { AcademicCatalog } from './academicData'
import type { StudyPerformanceRow } from './studySessions'

function client() {
  if (!supabase) throw new Error('Deneme hizmetine bağlanılamadı.')
  return supabase
}

async function pages<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await query(from, from + 499)
    if (error) throw error
    rows.push(...(data ?? []) as T[])
    if ((data?.length ?? 0) < 500) return rows
  }
}

export async function loadMockExams(studentIds: string[]): Promise<MockExam[]> {
  if (!studentIds.length) return []
  const db = client()
  // Fetch child rows separately so embedded response limits cannot truncate totals.
  const parents = await pages<Omit<MockExam, 'subject_results' | 'topic_errors'>>((from, to) => db.from('mock_exams').select('*')
    .in('student_id', studentIds).order('id').range(from, to))
  const exams: MockExam[] = []
  for (let offset = 0; offset < parents.length; offset += 100) {
    const batch = parents.slice(offset, offset + 100)
    const ids = batch.map(row => row.id)
    const [subjects, topics] = await Promise.all([
      pages<MockExam['subject_results'][number]>((from, to) => db.from('mock_exam_subject_results').select('*').in('exam_id', ids).order('id').range(from, to)),
      pages<MockExam['topic_errors'][number]>((from, to) => db.from('mock_exam_topic_errors').select('*').in('exam_id', ids).order('id').range(from, to)),
    ])
    exams.push(...batch.map(exam => ({ ...exam, subject_results: subjects.filter(row => row.exam_id === exam.id), topic_errors: topics.filter(row => row.exam_id === exam.id) })))
  }
  return exams.sort((a, b) => b.exam_date.localeCompare(a.exam_date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
}

export async function loadAssessmentData(studentIds: string[]) {
  if (!studentIds.length) return { exams: [] as MockExam[], performance: [] as StudyPerformanceRow[] }
  const [exams, legacy] = await Promise.all([
    loadMockExams(studentIds),
    pages<StudyPerformanceRow>((from, to) => client().from('performance')
      .select('id, student_id, daily_hours, tyt_net, ayt_net, date, created_at').in('student_id', studentIds).order('id').range(from, to)),
  ])
  return { exams, performance: mergeAssessmentHistory(legacy, exams) }
}

export async function saveMockExam(input: MockExamInput, catalog: AcademicCatalog, examId: string | null = null): Promise<string> {
  const value = validateMockExam(input, catalog)
  const { data, error } = await client().rpc('save_mock_exam', { p_exam_id: examId, p_exam_type: value.exam_type, p_exam_date: value.exam_date,
    p_name: value.name, p_difficulty: value.difficulty, p_branch_subject_id: value.branch_subject_id,
    p_subject_results: value.subject_results, p_topic_errors: value.topic_errors })
  if (error) throw error
  return data as string
}

export async function deleteMockExam(examId: string) {
  const { data, error } = await client().from('mock_exams').delete().eq('id', examId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Deneme silinemedi.')
}
