import React, { useEffect, useMemo, useState } from 'react'
import { useCompetencyMap } from '../../hooks/useCompetencyMap'
import type { CompetencyStatus, CompetencyTrend } from '../../lib/competencyMap'
import Card from '../ui/Card'

const STATUS_LABELS: Record<CompetencyStatus, string> = {
  strong: 'Güçlü',
  developing: 'Gelişiyor',
  weak: 'Dikkat gerekiyor',
  insufficient_data: 'Veri yetersiz',
}

const STATUS_STYLES: Record<CompetencyStatus, string> = {
  strong: 'bg-emerald-100 text-emerald-700',
  developing: 'bg-blue-100 text-blue-700',
  weak: 'bg-red-100 text-red-700',
  insufficient_data: 'bg-gray-100 text-gray-500',
}

function trendSymbol(trend: CompetencyTrend) {
  if (trend === 'improving') return '↑'
  if (trend === 'declining') return '↓'
  if (trend === 'stable') return '→'
  return ''
}

export default function TopicCompetencyMap({ studentId }: { studentId: string }) {
  const { competencyMap, loading, error } = useCompetencyMap(studentId)
  const reliableTopics = competencyMap.topics.filter(topic => topic.status !== 'insufficient_data')
  const subjectOptions = useMemo(() => {
    const unique = new Map(reliableTopics.map(topic => [
      `${topic.examType}:${topic.subjectId}`,
      { key: `${topic.examType}:${topic.subjectId}`, label: `${topic.examType} ${topic.subjectName}` },
    ]))
    return [...unique.values()]
  }, [reliableTopics])
  const [selectedSubject, setSelectedSubject] = useState('')

  useEffect(() => {
    if (subjectOptions.length === 0) setSelectedSubject('')
    else if (!subjectOptions.some(option => option.key === selectedSubject)) setSelectedSubject(subjectOptions[0].key)
  }, [selectedSubject, subjectOptions])

  const visibleTopics = reliableTopics.filter(topic => `${topic.examType}:${topic.subjectId}` === selectedSubject)

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Konu Gelişimim</h3>
          <p className="text-xs text-gray-500">Son ölçümlerdeki gerçek konu sonuçlarından hesaplanır.</p>
        </div>
        {subjectOptions.length > 1 && (
          <select value={selectedSubject} onChange={event => setSelectedSubject(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            {subjectOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        )}
      </div>

      {loading ? <p className="mt-4 text-sm text-gray-400">Konu gelişimi yükleniyor...</p> : error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Konu gelişimi yüklenemedi: {error.message}</p>
      ) : visibleTopics.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Henüz güvenilir konu değerlendirmesi için yeterli veri yok.</p>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{subjectOptions.find(option => option.key === selectedSubject)?.label}</div>
          {visibleTopics.map(topic => (
            <div key={topic.topicId} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">
                  {topic.topicName} {!topic.topicIsActive && <span className="ml-1 text-[10px] font-normal text-gray-400">Arşiv konu</span>}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">{topic.evidence.attempts} ölçüm · {topic.evidence.knownQuestions} soru</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[topic.status]}`}>
                {STATUS_LABELS[topic.status]} {trendSymbol(topic.trend)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
