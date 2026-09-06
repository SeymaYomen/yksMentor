import React, { useMemo, useState } from 'react'
import { useAcademicCatalog } from '../../hooks/useAcademicCatalog'
import type { ExamType } from '../../lib/competencyMap'
import Input from '../ui/Input'

export type TopicPerformanceEntryInput = {
  topic_id: string
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
}

type Props = {
  entries: TopicPerformanceEntryInput[]
  onChange: (entries: TopicPerformanceEntryInput[]) => void
}

function parsedCount(value: string) {
  return value === '' ? null : Number(value)
}

export default function TopicPerformanceFields({ entries, onChange }: Props) {
  const { subjects, topics, loading, error: catalogError } = useAcademicCatalog()
  const [expanded, setExpanded] = useState(false)
  const [examType, setExamType] = useState<ExamType>('TYT')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [correct, setCorrect] = useState('')
  const [wrong, setWrong] = useState('')
  const [blank, setBlank] = useState('')
  const [error, setError] = useState<string | null>(null)

  const visibleSubjects = useMemo(
    () => subjects.filter(subject => subject.exam_type === examType),
    [examType, subjects],
  )
  const visibleTopics = useMemo(
    () => topics.filter(topic => topic.subject_id === subjectId),
    [subjectId, topics],
  )
  const topicById = useMemo(() => new Map(topics.map(topic => [topic.id, topic])), [topics])
  const subjectById = useMemo(() => new Map(subjects.map(subject => [subject.id, subject])), [subjects])

  function addEntry() {
    const counts = [parsedCount(correct), parsedCount(wrong), parsedCount(blank)]
    if (!topicId) {
      setError('Ders ve konu seçin.')
      return
    }
    if (entries.some(entry => entry.topic_id === topicId)) {
      setError('Bu konu zaten eklendi.')
      return
    }
    if (counts.some(value => value !== null && (!Number.isInteger(value) || value < 0))) {
      setError('Doğru, yanlış ve boş sayıları negatif olmayan tam sayı olmalı.')
      return
    }
    if (counts.every(value => value === null) || counts.reduce<number>((sum, value) => sum + (value ?? 0), 0) <= 0) {
      setError('Konu için toplam soru sayısı sıfırdan büyük olmalı.')
      return
    }

    onChange([...entries, {
      topic_id: topicId,
      correct_count: counts[0],
      wrong_count: counts[1],
      blank_count: counts[2],
    }])
    setTopicId('')
    setCorrect('')
    setWrong('')
    setBlank('')
    setError(null)
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-bold text-indigo-800">Konu sonuçları</span>
          <span className="block text-xs text-indigo-600">İsteğe bağlı · yalnız denemede ölçülen konuları ekleyin</span>
        </span>
        <span className="text-lg text-indigo-500">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-indigo-100 pt-4">
          {catalogError ? (
            <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">Ders ve konu kataloğu yüklenemedi: {catalogError.message}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <select aria-label="Sınav türü"
                  value={examType}
                  disabled={loading}
                  onChange={event => {
                    setExamType(event.target.value as ExamType)
                    setSubjectId('')
                    setTopicId('')
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="TYT">TYT</option>
                  <option value="AYT">AYT</option>
                </select>
                <select aria-label="Ders"
                  value={subjectId}
                  disabled={loading}
                  onChange={event => { setSubjectId(event.target.value); setTopicId('') }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">Ders seçin</option>
                  {visibleSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
                <select aria-label="Konu"
                  value={topicId}
                  disabled={!subjectId}
                  onChange={event => setTopicId(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">Konu seçin</option>
                  {visibleTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input aria-label="Doğru sayısı" type="number" min="0" step="1" value={correct} onChange={event => setCorrect(event.target.value)} placeholder="Doğru" />
                <Input aria-label="Yanlış sayısı" type="number" min="0" step="1" value={wrong} onChange={event => setWrong(event.target.value)} placeholder="Yanlış" />
                <Input aria-label="Boş sayısı" type="number" min="0" step="1" value={blank} onChange={event => setBlank(event.target.value)} placeholder="Boş" />
                <button type="button" onClick={addEntry} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Ekle</button>
              </div>
            </>
          )}

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map(entry => {
                const topic = topicById.get(entry.topic_id)
                const subject = topic ? subjectById.get(topic.subject_id) : undefined
                return (
                  <li key={entry.topic_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-700">
                    <span><strong>{subject?.exam_type} / {subject?.name} / {topic?.name}</strong> · D {entry.correct_count ?? '—'} · Y {entry.wrong_count ?? '—'} · B {entry.blank_count ?? '—'}</span>
                    <button type="button" onClick={() => onChange(entries.filter(item => item.topic_id !== entry.topic_id))} className="font-semibold text-red-500 hover:text-red-700">Kaldır</button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
