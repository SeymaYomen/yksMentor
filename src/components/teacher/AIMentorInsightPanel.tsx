import React, { useState } from 'react'
import { aiMentorInsightService } from '../../services/aiMentorService'
import type { AIMentorInsightResponse } from '../../lib/aiMentorOutput'

export default function AIMentorInsightPanel({ studentId }: { studentId: string }) {
  const [results, setResults] = useState<Record<string, AIMentorInsightResponse>>({})
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const result = results[studentId]
  const loading = loadingStudentId === studentId
  const error = errors[studentId]

  async function generateInsight() {
    setLoadingStudentId(studentId)
    setErrors(current => ({ ...current, [studentId]: '' }))
    try {
      const response = await aiMentorInsightService.generateMentorInsight(studentId)
      setResults(current => ({ ...current, [studentId]: response }))
    } catch (caughtError) {
      console.error('AI mentor insight could not be generated:', caughtError)
      setErrors(current => ({ ...current, [studentId]: 'AI yorumu oluşturulamadı. Mevcut mentor değerlendirmeleri kullanılmaya devam edebilir.' }))
    } finally {
      setLoadingStudentId(null)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-4" aria-labelledby="ai-mentor-insight-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 id="ai-mentor-insight-title" className="font-bold text-violet-900">AI Mentor Yorumu</h5>
          <p className="mt-0.5 text-xs text-violet-700">Mevcut deterministik değerlendirmeleri açıklar; kararları veya öğrenci kayıtlarını değiştirmez.</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generateInsight()}
          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Mentor yorumu hazırlanıyor...' : result ? 'Yorumu Yenile' : 'Yorum Oluştur'}
        </button>
      </div>

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

          <p className="text-[11px] text-gray-400">
            {new Date(result.generatedAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })} tarihinde oluşturuldu.
          </p>
        </div>
      )}
    </div>
  )
}
