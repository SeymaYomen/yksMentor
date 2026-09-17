import type { StudentGoal } from './goalProgress'

// The database's partial unique index permits only one active goal per student.
// Timestamps never make an archived goal current or resolve invalid duplicates.
export function selectCurrentGoal(goals: StudentGoal[], studentId: string): StudentGoal | null {
  const active = goals.filter(goal => goal.student_id === studentId && goal.is_active)
  if (active.length > 1) throw new Error('Öğrenci için birden fazla aktif hedef bulundu.')
  return active[0] ?? null
}
