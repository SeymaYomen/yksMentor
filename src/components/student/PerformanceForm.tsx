import React, { useEffect, useRef, useState } from 'react'
import { PlusIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { useAcademicCatalog } from '../../hooks/useAcademicCatalog'
import { createStudySession, loadStudySessions } from '../../lib/studySessionData'
import { localStudyDate, prepareStudySession, recentStudyTopics, STUDY_ACTIVITIES, type StudyActivity, type StudySession } from '../../lib/studySessions'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Badge from '../ui/Badge'
import { showSuccess } from '../ui/ToastButton'

const emptyForm = { subject: '', topic: '', activity: '', duration: '', questions: '', correct: '', wrong: '', blank: '', source: '', note: '' }
const selectClass = 'min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
const count = (value: string) => value === '' ? null : Number(value)

export default function PerformanceForm({ studentId }: { studentId: string }) {
  const { subjects, topics, loading: catalogLoading, error: catalogError } = useAcademicCatalog()
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [form, setForm] = useState(emptyForm)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [today, setToday] = useState(localStudyDate)
  const submitting = useRef(false)
  const owner = useRef(studentId)
  owner.current = studentId
  const subjectInput = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localStudyDate()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setSessions([])
    setForm(emptyForm)
    setExpanded(false)
    setError(null)
    loadStudySessions(studentId).then(rows => {
      if (!cancelled) setSessions(rows)
    }).catch(() => {
      if (!cancelled) setLoadError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [studentId, retry])

  const daily = sessions.filter(row => row.study_date === today).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const minutes = daily.reduce((total, row) => total + row.duration_minutes, 0)
  const recent = recentStudyTopics(sessions.filter(row =>
    subjects.some(subject => subject.id === row.subject_id) && topics.some(topic => topic.id === row.topic_id)))
  const update = (key: keyof typeof emptyForm, value: string) => setForm(previous => ({ ...previous, [key]: value }))

  function openForm(subject = '', topic = '') {
    setForm({ ...emptyForm, subject, topic })
    setError(null)
    setExpanded(true)
    window.requestAnimationFrame(() => subjectInput.current?.focus())
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    setError(null)
    let payload
    try {
      payload = prepareStudySession({ student_id: studentId, study_date: localStudyDate(),
        subject_id: form.subject, topic_id: form.topic, activity_type: form.activity as StudyActivity,
        duration_minutes: Number(form.duration), question_count: count(form.questions), correct_count: count(form.correct),
        wrong_count: count(form.wrong), blank_count: count(form.blank), source: form.source, note: form.note })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bilgileri kontrol edin.')
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      const row = await createStudySession(payload)
      if (owner.current !== studentId) return
      setToday(localStudyDate())
      setSessions(previous => [row, ...previous])
      setForm(emptyForm)
      // Keep the form open for the next independent session.
      window.dispatchEvent(new Event('performance_updated'))
      showSuccess('Çalışma kaydı eklendi.')
    } catch {
      if (owner.current === studentId) setError('Çalışma kaydedilemedi. Bilgilerin korundu; bağlantını kontrol edip tekrar dene.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return <div className="min-w-0 space-y-5">
    {loading ? <p role="status" className="text-sm text-slate-500">Çalışmalar yükleniyor…</p> : loadError ?
      <div role="alert" className="space-y-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
        <p>Çalışmalar yüklenemedi. Bağlantını kontrol edip tekrar dene.</p>
        <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Tekrar Dene</Button>
      </div> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-slate-500">Bugün</p><p className="text-2xl font-semibold text-slate-900">{Math.floor(minutes / 60)} sa {minutes % 60} dk</p></div>
          <div className="flex flex-wrap gap-2"><Badge>{new Set(daily.map(row => row.subject_id)).size} ders</Badge><Badge>{daily.length} çalışma</Badge></div>
        </div>
        {daily.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Bugün henüz çalışma eklemedin.</p> :
          <ul className="space-y-2" aria-label="Bugünkü çalışmalar">
            {daily.map(row => <li key={row.id} className="flex min-w-0 gap-3 rounded-xl border border-slate-200 p-3">
              <BookOpenIcon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-indigo-600" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-slate-800">{subjects.find(subject => subject.id === row.subject_id)?.name ?? 'Ders'} · {topics.find(topic => topic.id === row.topic_id)?.name ?? 'Konu'}</p>
                <p className="mt-1 text-slate-500">{STUDY_ACTIVITIES[row.activity_type]} · {row.duration_minutes} dk{row.question_count !== null ? ` · ${row.question_count} soru` : ''}</p>
                {row.source && <p className="mt-1 text-xs text-slate-500">{row.source}</p>}
                {row.note && <p className="mt-1 text-xs text-slate-500">{row.note}</p>}
              </div>
            </li>)}
          </ul>}
        {!expanded && <Button onClick={() => openForm()}><PlusIcon aria-hidden="true" className="h-4 w-4" />Çalışma Ekle</Button>}
        {recent.length > 0 && <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">Son çalışmaların</p>
          <div className="flex flex-wrap gap-2">{recent.map(row => <Button key={`${row.subject_id}/${row.topic_id}`} variant="secondary" disabled={saving} className="max-w-full whitespace-normal text-left"
            onClick={() => openForm(row.subject_id, row.topic_id)}>
            {subjects.find(subject => subject.id === row.subject_id)?.name} · {topics.find(topic => topic.id === row.topic_id)?.name} · Tekrar Ekle
          </Button>)}</div>
        </div>}
      </>}

    {expanded && <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-5">
      {catalogError && <p role="alert" className="text-sm text-red-700">Ders ve konu listesi yüklenemedi. Sayfayı yenileyip tekrar dene.</p>}
      <fieldset disabled={saving || catalogLoading || !!catalogError} className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-slate-700">Ders
            <select ref={subjectInput} required value={form.subject} onChange={event => setForm(previous => ({ ...previous, subject: event.target.value, topic: '' }))} className={selectClass}>
              <option value="">Ders seç</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.exam_type} · {subject.name}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-slate-700">Konu
            <select required disabled={!form.subject} value={form.topic} onChange={event => update('topic', event.target.value)} className={selectClass}>
              <option value="">Konu seç</option>{topics.filter(topic => topic.subject_id === form.subject).map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-slate-700">Çalışma türü
            <select required value={form.activity} onChange={event => setForm(previous => ({ ...previous, activity: event.target.value, questions: '', correct: '', wrong: '', blank: '' }))} className={selectClass}>
              <option value="">Çalışma türü seç</option>{Object.entries(STUDY_ACTIVITIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-slate-700">Süre (dakika)
            <Input required type="number" min="1" step="1" value={form.duration} onChange={event => update('duration', event.target.value)} placeholder="Örn: 55" />
          </label>
        </div>
        {form.activity === 'question_practice' && <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          {(['questions', 'correct', 'wrong', 'blank'] as const).map((key, index) => <label key={key} className="min-w-0 text-sm text-slate-700">
            {['Soru sayısı', 'Doğru', 'Yanlış', 'Boş'][index]}
            <Input type="number" min="0" step="1" value={form[key]} onChange={event => update(key, event.target.value)} placeholder="İsteğe bağlı" />
          </label>)}
        </div>}
        <details className="text-sm text-slate-600"><summary className="cursor-pointer py-1">Kaynak ve kısa not (isteğe bağlı)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0">Kaynak<Input maxLength={250} value={form.source} onChange={event => update('source', event.target.value)} /></label>
            <label className="min-w-0">Kısa not<Input maxLength={1000} value={form.note} onChange={event => update('note', event.target.value)} /></label>
          </div>
        </details>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" loading={saving} disabled={catalogLoading || !!catalogError} className="w-full sm:w-auto">Çalışmayı Ekle</Button>
    </form>}
  </div>
}
