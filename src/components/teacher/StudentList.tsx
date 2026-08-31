import React from 'react'
import Card from '../ui/Card'
import Spinner from '../ui/Spinner'
import type { MentorStudentSummary } from '../../hooks/useMentorStudentSummaries'
import StudentStatusBadge from './StudentStatusBadge'

type Props = {
  students: MentorStudentSummary[]
  selectedStudent: string | null
  onSelectStudent: (id: string) => void
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
}

export default function StudentList({ students, selectedStudent, onSelectStudent, loading, error, onRetry }: Props) {
  if (loading) {
    return (
      <Card className="flex min-h-48 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Spinner /> Öğrenci durumları hazırlanıyor...
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <div className="font-medium text-red-600">Öğrenci bilgileri yüklenemedi.</div>
        <p className="mt-1 text-sm text-gray-500">{error.message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Tekrar dene
          </button>
        )}
      </Card>
    )
  }

  if (students.length === 0) {
    return (
      <Card className="text-center p-8">
        <div className="text-gray-500 mb-2">Henüz öğrenciniz bulunmuyor.</div>
        <p className="text-sm text-gray-400">
          Öğrencileriniz kayıt olurken katılım kodunuzu girerek size bağlanabilirler.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50/50">
        <h3 className="font-semibold text-gray-700">Öğrencileriniz</h3>
      </div>
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {students.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectStudent(s.id)}
            className={`w-full px-4 py-3 text-left transition-colors hover:bg-indigo-50 ${
              selectedStudent === s.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 font-bold text-indigo-600">
                {s.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className={`font-medium ${selectedStudent === s.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {s.username}
                    </div>
                    <div className="text-xs text-gray-500">ID: {s.id.slice(0, 8)}...</div>
                  </div>
                  <StudentStatusBadge status={s.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{s.status.reasons[0]}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
