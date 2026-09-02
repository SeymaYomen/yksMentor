import React from 'react'
import { Link } from 'react-router-dom'
import type { MentorStudentSummary } from '../../hooks/useMentorStudentSummaries'
import { MENTOR_PRIORITY_ORDER, type MentorAttentionPriority } from '../../lib/mentorAlerts'
import Card from '../ui/Card'
import Spinner from '../ui/Spinner'

const PRIORITY_LABELS: Record<MentorAttentionPriority, string> = {
  critical: 'Kritik',
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
}

const PRIORITY_STYLES: Record<MentorAttentionPriority, { dot: string; badge: string; border: string }> = {
  critical: { dot: 'bg-red-600', badge: 'bg-red-100 text-red-700', border: 'border-red-200' },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  medium: { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
  low: { dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-600', border: 'border-gray-200' },
}

type Props = {
  students: MentorStudentSummary[]
  loading: boolean
  error: Error | null
  onSelectStudent: (studentId: string) => void
  onRetry: () => void
}

export default function EarlyWarningCenter({ students, loading, error, onSelectStudent, onRetry }: Props) {
  const attentionStudents = students
    .filter(student => student.alerts.priority !== 'low')
    .sort((a, b) => (
      MENTOR_PRIORITY_ORDER[a.alerts.priority] - MENTOR_PRIORITY_ORDER[b.alerts.priority] ||
      a.username.localeCompare(b.username, 'tr')
    ))

  return (
    <Card className="overflow-hidden border-indigo-100 p-0">
      <div className="flex flex-col gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-gray-800">Bugün Dikkat Gerektirenler</h3>
          <p className="mt-0.5 text-xs text-gray-500">Mevcut durum, hedef, görev, görüşme ve konu verilerinden açıklanabilir olarak hesaplanır.</p>
        </div>
        {!loading && !error && attentionStudents.length > 0 && (
          <span className="self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm sm:self-auto">
            {attentionStudents.length} öğrenci
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-3 p-6 text-sm text-gray-500">
          <Spinner /> Öncelikler hazırlanıyor...
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="font-medium text-red-600">Erken uyarılar hazırlanamadı.</p>
          <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Tekrar dene
          </button>
        </div>
      ) : attentionStudents.length === 0 ? (
        <div className="p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-600">✓</div>
          <p className="mt-3 text-sm font-semibold text-gray-700">Şu anda acil dikkat gerektiren öğrenci yok.</p>
          <p className="mt-1 text-xs text-gray-400">Yeni veriler geldikçe öncelikler otomatik güncellenir.</p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {attentionStudents.map(student => {
            const styles = PRIORITY_STYLES[student.alerts.priority]
            const visibleAlerts = student.alerts.alerts.slice(0, 2)
            return (
              <article key={student.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${styles.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onSelectStudent(student.id)} className="min-w-0 text-left">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
                      <span className="truncate font-bold text-gray-800 hover:text-indigo-700">{student.username}</span>
                    </span>
                  </button>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.badge}`}>
                    {PRIORITY_LABELS[student.alerts.priority]}
                  </span>
                </div>
                <button type="button" onClick={() => onSelectStudent(student.id)} className="mt-3 block w-full text-left">
                  <ul className="space-y-1.5 text-xs leading-5 text-gray-600">
                    {visibleAlerts.map(alert => <li key={alert.type}>• {alert.title}</li>)}
                    {student.alerts.alerts.length > visibleAlerts.length && (
                      <li className="font-medium text-gray-400">+{student.alerts.alerts.length - visibleAlerts.length} uyarı daha</li>
                    )}
                  </ul>
                </button>
                {student.alerts.needsMeeting && (
                  <Link
                    to={`/teacher/meetings?studentId=${encodeURIComponent(student.id)}`}
                    className="mt-3 inline-flex rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    Görüşme Planla
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      )}
    </Card>
  )
}
