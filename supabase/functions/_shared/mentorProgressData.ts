import { mergeAssessmentHistory, mockTopicSignals, type MockExam } from '../../../src/lib/mockExams.ts'
import { mergeStudyHours, type StudyDuration, type StudyPerformanceRow } from '../../../src/lib/studySessions.ts'
import type { AcademicCatalog } from '../../../src/lib/academicData.ts'

// Use the caller's authenticated client, never the service-role client.
export async function loadMentorProgressData(db: { from: (table: string) => any }, studentId: string) {
  async function pages<T>(table: string, filter?: [string, string[]]): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += 500) {
      let query = db.from(table).select('*').order('id').range(from, from + 499)
      if (filter) query = query.in(filter[0], filter[1])
      const { data, error } = await query
      if (error) throw error
      rows.push(...(data ?? []))
      if ((data?.length ?? 0) < 500) return rows
    }
  }
  const filter: [string, string[]] = ['student_id', [studentId]]
  const [legacy, parents, sessions, subjects, topics] = await Promise.all([
    pages<StudyPerformanceRow>('performance', filter), pages<MockExam>('mock_exams', filter),
    pages<StudyDuration>('study_sessions', filter), pages<AcademicCatalog['subjects'][number]>('exam_subjects'),
    pages<AcademicCatalog['topics'][number]>('exam_topics'),
  ])
  const exams: MockExam[] = []
  for (let offset = 0; offset < parents.length; offset += 100) {
    const batch = parents.slice(offset, offset + 100)
    const childFilter: [string, string[]] = ['exam_id', batch.map(row => row.id)]
    const [results, errors] = await Promise.all([
      pages<MockExam['subject_results'][number]>('mock_exam_subject_results', childFilter),
      pages<MockExam['topic_errors'][number]>('mock_exam_topic_errors', childFilter),
    ])
    exams.push(...batch.map(row => ({ ...row, subject_results: results.filter(result => result.exam_id === row.id),
      topic_errors: errors.filter(error => error.exam_id === row.id) })))
  }
  const catalog = { subjects, topics }
  return { exams, performance: mergeStudyHours(mergeAssessmentHistory(legacy, exams, catalog), sessions),
    topicSignals: mockTopicSignals(exams, catalog) }
}
