export type AIMentorCaller = {
  id: string
  role: string | null
}

export type AIMentorStudentRelation = {
  id: string
  mentorId: string | null
  role: string | null
}

export function canGenerateAIMentorInsight(caller: AIMentorCaller, student: AIMentorStudentRelation) {
  return caller.role === 'teacher' && student.role === 'student' && student.mentorId === caller.id
}
