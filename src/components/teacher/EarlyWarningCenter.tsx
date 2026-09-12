import React from 'react'
import type { MentorStudentSummary } from '../../hooks/useMentorStudentSummaries'
import { hasNearMeeting, needsAttention } from '../../lib/teacherOverview'
import Card from '../ui/Card'

type Props = {
  students: MentorStudentSummary[]
  loading: boolean
  error: Error | null
  onSelectStudent: (studentId: string) => void
  onRetry: () => void
}

export default function EarlyWarningCenter({ students, loading, error, onRetry }: Props) {
  return <Card>
    <h3 className="font-bold text-gray-800">Bugün Dikkat Gerektirenler</h3>
    {loading ? <p role="status">Öncelikler hazırlanıyor...</p> : error ? <div role="alert">Özet yüklenemedi. <button type="button" onClick={onRetry}>Tekrar dene</button></div> :
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
        {[
          ['Öğrenci', students.length],
          ['Dikkat gereken', students.filter(needsAttention).length],
          ['Görüşmesi yaklaşan', students.filter(student => hasNearMeeting(student)).length],
          ['Veri birikiyor', students.filter(student => !student.status.hasEnoughData && !needsAttention(student)).length],
        ].map(([label, count]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-gray-500">{label}</dt><dd className="text-xl font-semibold">{count}</dd></div>)}
      </dl>}
  </Card>
}
