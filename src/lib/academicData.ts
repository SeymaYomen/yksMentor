import { isSupabaseConfigured, supabase } from './supabase'
import type { ExamType, TopicPerformanceSignal } from './competencyMap'
import { loadMockExams } from './mockExamData'
import { mockTopicSignals } from './mockExams'

export type AcademicSubject = {
  id: string
  exam_type: ExamType
  name: string
  sort_order: number
  is_active: boolean
}

export type AcademicTopic = {
  id: string
  subject_id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type AcademicCatalog = {
  subjects: AcademicSubject[]
  topics: AcademicTopic[]
}

type TopicPerformanceRow = {
  student_id: string
  topic_id: string
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  observed_at: string | null
  created_at: string | null
}

export type StudentTopicPerformanceSignal = TopicPerformanceSignal & { studentId: string }

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
  }
  return supabase
}

export async function loadAcademicCatalog(includeInactive = false): Promise<AcademicCatalog> {
  const client = requireClient()
  let subjectQuery = client
    .from('exam_subjects')
    .select('id, exam_type, name, sort_order, is_active')
    .order('exam_type')
    .order('sort_order')
  let topicQuery = client
    .from('exam_topics')
    .select('id, subject_id, name, sort_order, is_active')
    .order('sort_order')

  if (!includeInactive) {
    subjectQuery = subjectQuery.eq('is_active', true)
    topicQuery = topicQuery.eq('is_active', true)
  }

  const [subjectResult, topicResult] = await Promise.all([subjectQuery, topicQuery])
  if (subjectResult.error) throw subjectResult.error
  if (topicResult.error) throw topicResult.error

  return {
    subjects: (subjectResult.data ?? []) as AcademicSubject[],
    topics: (topicResult.data ?? []) as AcademicTopic[],
  }
}

export async function loadTopicPerformanceSignals(studentIds: string[]): Promise<StudentTopicPerformanceSignal[]> {
  if (studentIds.length === 0) return []
  const client = requireClient()
  const [performanceResult, catalog, exams] = await Promise.all([
    client
      .from('exam_topic_performance')
      .select('student_id, topic_id, correct_count, wrong_count, blank_count, observed_at, created_at')
      .in('student_id', studentIds),
    loadAcademicCatalog(true),
    loadMockExams(studentIds),
  ])
  if (performanceResult.error) throw performanceResult.error

  const subjectById = new Map(catalog.subjects.map(subject => [subject.id, subject]))
  const topicById = new Map(catalog.topics.map(topic => [topic.id, topic]))

  const legacy = ((performanceResult.data ?? []) as TopicPerformanceRow[]).flatMap(row => {
    const topic = topicById.get(row.topic_id)
    const subject = topic ? subjectById.get(topic.subject_id) : undefined
    if (!topic || !subject) return []
    return [{
      topicId: topic.id,
      topicName: topic.name,
      topicIsActive: topic.is_active,
      subjectId: subject.id,
      subjectName: subject.name,
      examType: subject.exam_type,
      correctCount: row.correct_count,
      wrongCount: row.wrong_count,
      blankCount: row.blank_count,
      observedAt: row.observed_at ?? row.created_at,
      studentId: row.student_id,
    }]
  })
  const fresh = mockTopicSignals(exams, catalog)
  const authoritative = new Set(exams.map(exam => `${exam.student_id}/${exam.exam_type}`))
  return [...legacy.filter(row => !authoritative.has(`${row.studentId}/${row.examType}`)), ...fresh]
}
