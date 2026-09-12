import type { MentorStudentSummary } from '../hooks/useMentorStudentSummaries'

export type StudentFilter = 'all' | 'attention' | 'meeting'
export function needsAttention(student: MentorStudentSummary) {
  return student.alerts.alerts.some(alert => alert.type !== 'DATA_GAP')
}
export function hasNearMeeting(student: MentorStudentSummary, now = new Date()) {
  const time = Date.parse(student.status.metrics.nextMeetingAt ?? '')
  return time >= now.getTime() && time <= now.getTime() + 7 * 86_400_000
}
export function filterMentorStudents(students: MentorStudentSummary[], query: string, filter: StudentFilter, now = new Date()) {
  const search = query.trim().toLocaleLowerCase('tr-TR')
  return students.filter(student => student.username.toLocaleLowerCase('tr-TR').includes(search) &&
    (filter === 'all' || (filter === 'attention' ? needsAttention(student) : hasNearMeeting(student, now))))
}
