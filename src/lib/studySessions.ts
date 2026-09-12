export const STUDY_ACTIVITIES = {
  question_practice: 'Soru Çözümü',
  topic_review: 'Konu Tekrarı',
  video_resource: 'Video / Kaynak',
  note_taking: 'Not Çıkarma',
} as const

export type StudyActivity = keyof typeof STUDY_ACTIVITIES
export type StudySessionInput = {
  student_id: string
  study_date: string
  subject_id: string
  topic_id: string
  activity_type: StudyActivity
  duration_minutes: number
  question_count: number | null
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  source: string | null
  note: string | null
}
export type StudySession = StudySessionInput & { id: string; created_at: string; updated_at: string }
export type StudyDuration = Pick<StudySession, 'student_id' | 'study_date' | 'duration_minutes'>
export type StudyPerformanceRow = {
  id: string
  student_id: string
  daily_hours: number | null
  tyt_net: number | null
  ayt_net: number | null
  date: string | null
  created_at: string | null
}

export function localStudyDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function prepareStudySession(input: StudySessionInput): StudySessionInput {
  if (!input.student_id || !input.subject_id || !input.topic_id) throw new Error('Ders ve konu seçin.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.study_date) ||
      !Number.isFinite(Date.parse(input.study_date)) ||
      new Date(input.study_date).toISOString().slice(0, 10) !== input.study_date) throw new Error('Geçerli bir tarih seçin.')
  if (!Object.prototype.hasOwnProperty.call(STUDY_ACTIVITIES, input.activity_type)) throw new Error('Çalışma türü seçin.')
  if (!Number.isInteger(input.duration_minutes) || input.duration_minutes <= 0 || input.duration_minutes > 2147483647) {
    throw new Error('Süre sıfırdan büyük bir tam sayı olmalı.')
  }
  const result = { ...input, source: input.source?.trim() || null, note: input.note?.trim() || null }
  if ((result.source?.length ?? 0) > 250 || (result.note?.length ?? 0) > 1000) throw new Error('Kaynak veya not çok uzun.')
  if (input.activity_type !== 'question_practice') {
    result.question_count = result.correct_count = result.wrong_count = result.blank_count = null
  }
  const counts = [result.question_count, result.correct_count, result.wrong_count, result.blank_count]
  if (counts.some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 2147483647))) {
    throw new Error('Soru sayıları negatif olmayan tam sayılar olmalı.')
  }
  if (result.question_count !== null && (result.correct_count ?? 0) + (result.wrong_count ?? 0) + (result.blank_count ?? 0) > result.question_count) {
    throw new Error('Doğru, yanlış ve boş toplamı soru sayısını aşamaz.')
  }
  return result
}

export function dailyStudyTotals(sessions: StudyDuration[]) {
  const totals = new Map<string, StudyDuration>()
  for (const session of sessions) {
    const key = `${session.student_id}/${session.study_date}`
    const previous = totals.get(key)
    totals.set(key, { student_id: session.student_id, study_date: session.study_date,
      duration_minutes: (previous?.duration_minutes ?? 0) + session.duration_minutes })
  }
  return [...totals.values()]
}

// Preserve every legacy net observation. Supply exactly one duration per session day;
// null hours on the other legacy rows are ignored by existing metric consumers.
export function mergeStudyHours(legacy: StudyPerformanceRow[], sessions: StudyDuration[]): StudyPerformanceRow[] {
  const authoritative = new Set(sessions.map(row => row.student_id))
  const totals = new Map(dailyStudyTotals(sessions).map(row => [`${row.student_id}/${row.study_date}`, row]))
  const used = new Set<string>()
  const rows = legacy.map(row => {
    const day = (row.date || row.created_at || '').slice(0, 10)
    const key = `${row.student_id}/${day}`
    const total = totals.get(key)
    if (!total) return { ...row, daily_hours: authoritative.has(row.student_id) ? null : row.daily_hours }
    const hours = used.has(key) ? null : total.duration_minutes / 60
    used.add(key)
    return { ...row, daily_hours: hours }
  })
  for (const [key, total] of totals) {
    if (!used.has(key)) rows.push({ id: `study/${key}`, student_id: total.student_id,
      date: total.study_date, created_at: null, daily_hours: total.duration_minutes / 60, tyt_net: null, ayt_net: null })
  }
  return rows.sort((a, b) => (a.date || a.created_at || '').localeCompare(b.date || b.created_at || ''))
}

export function recentStudyTopics(sessions: StudySession[]) {
  const seen = new Set<string>()
  return [...sessions].sort((a, b) => b.study_date.localeCompare(a.study_date) || b.created_at.localeCompare(a.created_at))
    .filter(row => {
      const key = `${row.subject_id}/${row.topic_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 3)
}
