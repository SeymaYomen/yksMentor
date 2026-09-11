import React, { useId, useRef, useState } from 'react'
import { aiMentorInsightService } from '../../services/aiMentorService'
import type { AIMentorInsightResponse } from '../../lib/aiMentorOutput'

import { isAIMentorInsightStale } from '../../lib/aiMentorContext'
import { AIMentorServiceError, aiMentorErrorMessage } from '../../lib/aiMentorErrors'

export default function AIMentorInsightPanel({
  studentId,
  currentFingerprint = null,
}: {
  studentId: string
  currentFingerprint?: string | null
}) {
  const titleId = useId()

  const [results, setResults] = useState<Record<string, AIMentorInsightResponse>>({})
  const pending = useRef(new Set<string>())
  const [loadingStudents, setLoadingStudents] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const result = results[studentId]
  const loading = Boolean(loadingStudents[studentId])
  const stale = isAIMentorInsightStale(currentFingerprint, result?.contextFingerprint ?? null)
  const error = errors[studentId]

  async function generateInsight() {
    if (pending.current.has(studentId)) return
    pending.current.add(studentId)
    setLoadingStudents(current => ({ ...current, [studentId]: true }))
    setErrors(current => ({ ...current, [studentId]: '' }))
    try {
      const response = await aiMentorInsightService.generateMentorInsight(studentId)
      setResults(current => ({ ...current, [studentId]: response }))
    } catch (caughtError) {
      const code = caughtError instanceof AIMentorServiceError ? caughtError.code : 'INTERNAL_ERROR'
      setErrors(current => ({ ...current, [studentId]: code === 'RATE_LIMITED' || code === 'UNAUTHORIZED' || code === 'FORBIDDEN'
        ? aiMentorErrorMessage(code) : 'AI Mentor şu anda kullanılamıyor.' }))
    } finally {
      pending.current.delete(studentId)
      setLoadingStudents(current => ({ ...current, [studentId]: false }))
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4" aria-labelledby={titleId} aria-busy={loading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 id={titleId} className="font-bold text-violet-900">AI Mentor Yorumu</h5>
          <p className="mt-0.5 text-xs text-violet-700">Bu yorum öğrencinin hedef, performans, görev, konu yeterliliği ve aktif uyarı verilerine dayanır.</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generateInsight()}
          className="min-h-11 max-w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Mentor yorumu hazırlanıyor...' : result ? 'Yorumu Yenile' : 'Yorum Oluştur'}
        </button>
      </div>

      {result && stale && (
        <p className="mt-3 text-sm text-amber-800" role="status">Yeni öğrenci verileri var. Bu yorum önceki verilere göre oluşturuldu.</p>
      )}
      {result && currentFingerprint && !stale && <p role="status" className="mt-3 text-xs text-emerald-700">Güncel</p>}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="mt-4 space-y-4 border-t border-violet-100 pt-4">
          <div>
            <h6 className="text-xs font-bold uppercase tracking-wider text-violet-700">Özet</h6>
            <p className="mt-1.5 text-sm leading-6 text-gray-700">{result.insight.summary}</p>
          </div>

          {result.insight.meetingTopics.length > 0 && (
            <div>
              <h6 className="text-xs font-bold uppercase tracking-wider text-violet-700">Görüşmede Ele Al</h6>
              <ul className="mt-1.5 space-y-1 text-sm leading-6 text-gray-700">
                {result.insight.meetingTopics.map(topic => <li key={topic}>• {topic}</li>)}
              </ul>
            </div>
          )}

          {result.insight.mentorActions.length > 0 && (
            <div>
              <h6 className="text-xs font-bold uppercase tracking-wider text-violet-700">Önerilen Mentor Aksiyonu</h6>
              <ul className="mt-1.5 space-y-1 text-sm leading-6 text-gray-700">
                {result.insight.mentorActions.map(action => <li key={action}>• {action}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-white px-3 py-3 shadow-sm">
            <h6 className="text-xs font-bold uppercase tracking-wider text-violet-700">Öğrenciye Geri Bildirim</h6>
            <p className="mt-1.5 text-sm leading-6 text-gray-700">{result.insight.studentFeedback}</p>
          </div>

          <p className="text-xs text-gray-500">
            {new Date(result.generatedAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })} tarihinde oluşturuldu.
          </p>
        </div>
      )}
    </div>
  )
}
