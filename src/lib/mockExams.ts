import type { StudentTopicPerformanceSignal } from './academicData'
import type { AcademicCatalog } from './academicData'
import type { StudyPerformanceRow } from './studySessions'

export type MockExamType = 'TYT' | 'AYT' | 'BRANCH'
export type ExamDifficulty = 'easy' | 'medium' | 'hard'
export type ExamSubjectInput = { subject_id: string; correct_count: number; wrong_count: number; blank_count: number }
export type ExamTopicErrorInput = { subject_id: string; topic_id: string; wrong_count: number; blank_count: number }
export type MockExamInput = {
  exam_type: MockExamType
  exam_date: string
  name: string | null
  difficulty: ExamDifficulty | null
  branch_subject_id: string | null
  subject_results: ExamSubjectInput[]
  topic_errors: ExamTopicErrorInput[]
}
export type MockExam = Omit<MockExamInput, 'subject_results' | 'topic_errors'> & {
  id: string
  student_id: string
  created_at: string
  updated_at: string
  subject_results: Array<ExamSubjectInput & { id: string; exam_id: string; net: number; created_at: string; updated_at: string }>
  topic_errors: Array<ExamTopicErrorInput & { id: string; exam_id: string; created_at: string }>
}

// Integer question counts yield exact quarter-point increments in JS and SQL.
export function examNet(correct: number, wrong: number) { return (correct * 4 - wrong) / 4 }
// AYT Tarih/Coğrafya catalog entries aggregate both social-science tests.
export const EXAM_QUESTION_LIMITS: Record<'TYT' | 'AYT', Record<string, number>> = {
  TYT: { 'Türkçe': 40, 'Matematik': 40, 'Fizik': 7, 'Kimya': 7, 'Biyoloji': 6, 'Tarih': 5, 'Coğrafya': 5, 'Felsefe': 5, 'Din Kültürü': 5 },
  AYT: { 'Matematik': 40, 'Fizik': 14, 'Kimya': 13, 'Biyoloji': 13, 'Türk Dili ve Edebiyatı': 24, 'Tarih': 21, 'Coğrafya': 17, 'Felsefe Grubu': 12 },
}
export function subjectQuestionLimit(subject: { exam_type: 'TYT' | 'AYT'; name: string } | undefined) {
  return subject ? EXAM_QUESTION_LIMITS[subject.exam_type]?.[subject.name] ?? null : null
}
export function subjectResultError(row: ExamSubjectInput, catalog: AcademicCatalog): string | null {
  const subject = catalog.subjects.find(subject => subject.id === row.subject_id)
  const limit = subjectQuestionLimit(subject)
  if (![row.correct_count, row.wrong_count, row.blank_count].every(value => Number.isInteger(value) && value >= 0)) return 'Doğru, yanlış ve boş alanlarına negatif olmayan tam sayılar girin.'
  if (limit === null) return 'Bu ders için soru sınırı tanımlanmamış.'
  return row.correct_count + row.wrong_count + row.blank_count > limit ? `${subject!.name}: doğru + yanlış + boş toplamı ${limit} soruyu aşamaz.` : null
}
export function examTotal(results: ExamSubjectInput[]): number | null {
  return results.length ? results.reduce((quarters, row) => quarters + row.correct_count * 4 - row.wrong_count, 0) / 4 : null
}

export function validateMockExam(input: MockExamInput, catalog: AcademicCatalog): MockExamInput {
  const fail = (message: string): never => { throw new Error(message) }
  if (!['TYT', 'AYT', 'BRANCH'].includes(input.exam_type)) fail('Deneme türünü seçin.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.exam_date) || !Number.isFinite(Date.parse(input.exam_date)) ||
      new Date(input.exam_date).toISOString().slice(0, 10) !== input.exam_date) fail('Geçerli bir tarih girin.')
  if (input.difficulty !== null && !['easy', 'medium', 'hard'].includes(input.difficulty)) fail('Geçerli bir zorluk seçin.')
  if ((input.name?.trim().length ?? 0) > 200) fail('Deneme adı en fazla 200 karakter olabilir.')
  if (!input.subject_results.length) fail('En az bir ders sonucu girin.')
  if (input.exam_type === 'BRANCH' && (!input.branch_subject_id || input.subject_results.length !== 1 || input.subject_results[0].subject_id !== input.branch_subject_id)) {
    fail('Branş denemesinde yalnız seçilen ders bulunmalı.')
  }
  if (input.exam_type !== 'BRANCH' && input.branch_subject_id !== null) fail('Branş dersi yalnız branş denemesinde seçilebilir.')
  const validCount = (value: number) => Number.isInteger(value) && value >= 0 && value <= 2147483647
  const subjectIds = new Set<string>()
  for (const row of input.subject_results) {
    const subject = catalog.subjects.find(subject => subject.id === row.subject_id)
    if (!subject || (input.exam_type !== 'BRANCH' && subject.exam_type !== input.exam_type)) fail('Ders, deneme türüyle eşleşmiyor.')
    if (subjectIds.has(row.subject_id)) fail('Bir ders aynı denemeye iki kez eklenemez.')
    subjectIds.add(row.subject_id)
    if (![row.correct_count, row.wrong_count, row.blank_count].every(validCount)) fail('Doğru, yanlış ve boş alanlarına negatif olmayan tam sayılar girin.')
    const countError = subjectResultError(row, catalog)
    if (countError) fail(countError)
  }
  const topics = new Set<string>()
  for (const row of input.topic_errors) {
    if (!subjectIds.has(row.subject_id) || !catalog.topics.some(topic => topic.id === row.topic_id && topic.subject_id === row.subject_id)) fail('Hata konusu seçilen derse ait olmalı.')
    if (topics.has(row.topic_id)) fail('Aynı konu iki kez etiketlenemez.')
    topics.add(row.topic_id)
    if (![row.wrong_count, row.blank_count].every(validCount) || row.wrong_count + row.blank_count === 0) fail('Konuya en az bir yanlış veya boş etiketleyin.')
  }
  for (const row of input.subject_results) {
    const errors = input.topic_errors.filter(error => error.subject_id === row.subject_id)
    if (errors.reduce((sum, error) => sum + error.wrong_count, 0) > row.wrong_count || errors.reduce((sum, error) => sum + error.blank_count, 0) > row.blank_count) {
      fail('Konu etiketleri dersin yanlış veya boş toplamını aşamaz.')
    }
  }
  return { ...input, name: input.name?.trim() || null }
}

// A new exam supersedes the entire legacy history of its type for this student.
// Study hours stay on their original rows; BRANCH never masquerades as TYT/AYT.
export function mergeAssessmentHistory(legacy: StudyPerformanceRow[], exams: MockExam[], catalog?: AcademicCatalog): StudyPerformanceRow[] {
  const authoritative = new Set(exams.filter(exam => exam.exam_type !== 'BRANCH').map(exam => `${exam.student_id}/${exam.exam_type}`))
  const rows = legacy.map(row => ({ ...row,
    tyt_net: authoritative.has(`${row.student_id}/TYT`) ? null : validLegacyNet(row.tyt_net, 120),
    ayt_net: authoritative.has(`${row.student_id}/AYT`) ? null : validLegacyNet(row.ayt_net, 80),
  }))
  for (const exam of exams) {
    if (exam.exam_type === 'BRANCH') continue
    if (catalog) { try { validateMockExam(exam, catalog) } catch { continue } }
    const total = examTotal(exam.subject_results)
    rows.push({ id: `exam/${exam.id}`, student_id: exam.student_id, date: exam.exam_date, created_at: exam.created_at,
      daily_hours: null, tyt_net: exam.exam_type === 'TYT' ? total : null, ayt_net: exam.exam_type === 'AYT' ? total : null })
  }
  return rows.filter(row => row.daily_hours !== null || row.tyt_net !== null || row.ayt_net !== null)
    .sort((a, b) => (a.date || a.created_at || '').localeCompare(b.date || b.created_at || '') || (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id))
}

// Old performance zeros were defaults, without assessment provenance.
function validLegacyNet(value: number | null, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max ? value : null
}

export type ExamHistoryPoint = { id: string; date: string; created_at: string; net: number; source: 'mock_exam' | 'legacy' }
export function examHistory(rows: StudyPerformanceRow[], type: 'TYT' | 'AYT'): ExamHistoryPoint[] {
  const key = type === 'TYT' ? 'tyt_net' : 'ayt_net'
  return rows.flatMap(row => {
    const net = row[key]
    return net === null || !Number.isFinite(net) ? [] : [{ id: row.id, date: row.date || row.created_at || '', created_at: row.created_at || '', net,
      source: row.id.startsWith('exam/') ? 'mock_exam' as const : 'legacy' as const }]
  }).sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}
export function latestExamSummary(history: ExamHistoryPoint[]) {
  const latest = history.at(-1) ?? null
  const previous = history.at(-2) ?? null
  return { latest, delta: latest && previous ? latest.net - previous.net : null }
}

export function previousExamDelta(exam: MockExam, exams: MockExam[]) {
  const ordered = exams.filter(row => row.student_id === exam.student_id && row.exam_type === exam.exam_type && row.branch_subject_id === exam.branch_subject_id)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const index = ordered.findIndex(row => row.id === exam.id)
  const current = examTotal(exam.subject_results)
  const previous = index > 0 ? examTotal(ordered[index - 1].subject_results) : null
  return current !== null && previous !== null ? current - previous : null
}

export function mockTopicSignals(exams: MockExam[], catalog: AcademicCatalog): StudentTopicPerformanceSignal[] {
  return exams.flatMap(exam => {
    try { validateMockExam(exam, catalog) } catch { return [] }
    return exam.topic_errors.flatMap(error => {
      const topic = catalog.topics.find(row => row.id === error.topic_id)
      const subject = catalog.subjects.find(row => row.id === error.subject_id)
      if (!topic || !subject) return []
      return [{ studentId: exam.student_id, topicId: topic.id, topicName: topic.name, topicIsActive: topic.is_active,
        subjectId: subject.id, subjectName: subject.name, examType: subject.exam_type, correctCount: null,
        wrongCount: error.wrong_count, blankCount: error.blank_count, observedAt: exam.exam_date,
        evidenceKind: 'assessment_topic_error' as const, assessmentEventId: exam.id }]
    })
  })
}
