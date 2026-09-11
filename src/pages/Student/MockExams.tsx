import { formatDate, formatNumber } from '../../lib/format'
import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import { loadAcademicCatalog, type AcademicCatalog } from '../../lib/academicData'
import { loadMockExams, saveMockExam, deleteMockExam } from '../../lib/mockExamData'
import { examNet, examTotal, previousExamDelta, validateMockExam, type MockExam, type MockExamInput, type MockExamType } from '../../lib/mockExams'
import { localStudyDate } from '../../lib/studySessions'

const empty = (): MockExamInput => ({ exam_type: 'TYT', exam_date: localStudyDate(), name: null, difficulty: null,
  branch_subject_id: null, subject_results: [], topic_errors: [] })
const field = 'block min-w-0 w-full rounded-lg border border-gray-300 p-2 mt-1'
const button = 'min-h-11 rounded-xl bg-indigo-600 text-white px-4 py-2 font-semibold transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50'
const message = (error: unknown) => error instanceof Error ? error.message : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'

export default function MockExams() {
  const { user } = useAuth()
  const [catalog, setCatalog] = useState<AcademicCatalog>({ subjects: [], topics: [] })
  const [exams, setExams] = useState<MockExam[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [input, setInput] = useState<MockExamInput>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setExams([])
    if (!user?.id) return () => { active = false }
    Promise.all([loadAcademicCatalog(true), loadMockExams([user.id])]).then(([c, e]) => {
      if (active) { setCatalog(c); setExams(e) }
    }).catch(() => { if (active) setError('Denemeler yüklenemedi. Lütfen tekrar deneyin.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id, retry])
  const name = (id: string) => catalog.subjects.find(s => s.id === id)?.name ?? 'Ders'
  const available = catalog.subjects.filter(s => (s.is_active || input.subject_results.some(r => r.subject_id === s.id)) &&
    (input.exam_type === 'BRANCH' ? s.id === input.branch_subject_id : s.exam_type === input.exam_type))
  function next() {
    setError('')
    try {
      if (step === 1) {
        const results = input.subject_results.length ? input.subject_results : available.map(s => ({ subject_id: s.id, correct_count: 0, wrong_count: 0, blank_count: 0 }))
        // Metadata validation uses a provisional row; result fields are entered next.
        validateMockExam({ ...input, subject_results: results, topic_errors: [] }, catalog)
        setInput({ ...input, subject_results: results })
      } else validateMockExam(input, catalog)
      setStep(step + 1)
    } catch (e) { setError(message(e)) }
  }
  async function save() {
    setBusy(true); setError(''); setNotice('')
    try {
      await saveMockExam(input, catalog, editing)
      setStep(0); setEditing(null); setInput(empty()); setNotice('Deneme kaydedildi.')
      window.dispatchEvent(new Event('performance_updated'))
      setExams(await loadMockExams([user!.id]))
    } catch { setError('Deneme kaydedilemedi. Bilgilerini kontrol edip tekrar dene.') } finally { setBusy(false) }
  }
  async function remove(exam: MockExam) {
    if (!window.confirm('Bu denemeyi silmek istiyor musun?')) return
    setBusy(true); setError('')
    try {
      await deleteMockExam(exam.id)
      setExams(rows => rows.filter(r => r.id !== exam.id))
      window.dispatchEvent(new Event('performance_updated'))
    } catch { setError('Deneme silinemedi. Lütfen tekrar deneyin.') } finally { setBusy(false) }
  }
  return <div className="space-y-6 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Denemelerim</h1>
      <p className="text-gray-500">Sonuçlarını kaydet, net gelişimini takip et.</p></div>
      {!step && <button type="button" className={button} disabled={loading || busy || !catalog.subjects.length} onClick={() => { setInput(empty()); setEditing(null); setStep(1); setError(''); setNotice('') }}>Deneme ekle</button>}</header>
    {error && <div role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>Yeniden yükle</button></div>}
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    {loading ? <p role="status">Yükleniyor...</p> : <>
      {step > 0 && <form className="mx-auto max-w-3xl rounded-2xl border bg-white p-4 sm:p-5 space-y-5" onSubmit={e => { e.preventDefault(); if (step < 3) next(); else void save() }}>
        <h2 className="font-bold">Adım {step} / 3 — {step === 1 ? 'Deneme bilgileri' : step === 2 ? 'Ders sonuçları' : 'Hatalarını incele (opsiyonel)'}</h2>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          {step === 1 && <div className="grid sm:grid-cols-2 gap-4">
            <label>Sınav türü<select className={field} value={input.exam_type} onChange={e => setInput({ ...input, exam_type: e.target.value as MockExamType, branch_subject_id: null, subject_results: [], topic_errors: [] })}>
              <option>TYT</option><option>AYT</option><option value="BRANCH">Branş</option></select></label>
            <label>Tarih<input required className={field} type="date" value={input.exam_date} onChange={e => setInput({ ...input, exam_date: e.target.value })} /></label>
            <label>Yayın / deneme adı (opsiyonel)<input className={field} maxLength={200} value={input.name ?? ''} onChange={e => setInput({ ...input, name: e.target.value || null })} /></label>
            <label>Zorluk (opsiyonel)<select className={field} value={input.difficulty ?? ''} onChange={e => setInput({ ...input, difficulty: (e.target.value || null) as MockExamInput['difficulty'] })}>
              <option value="">Seçilmedi</option><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></label>
            {input.exam_type === 'BRANCH' && <label>Ders<select required className={field} value={input.branch_subject_id ?? ''} onChange={e => setInput({ ...input, branch_subject_id: e.target.value || null, subject_results: [], topic_errors: [] })}>
              <option value="">Ders seç</option>{catalog.subjects.filter(s => s.is_active || s.id === input.branch_subject_id).map(s => <option key={s.id} value={s.id}>{s.exam_type} · {s.name}</option>)}</select></label>}
          </div>}
          {step === 2 && <><p className="text-sm text-gray-500">Sonucu olmayan dersi çıkar. Sıfır girilen ders 0 net olarak kaydedilir.</p>
            {input.subject_results.map((r, i) => <div key={r.subject_id} className="rounded-xl border p-3 space-y-2"><h3 className="font-semibold">{name(r.subject_id)}</h3>
              <div className="grid min-w-0 grid-cols-3 gap-2">{(['correct_count', 'wrong_count', 'blank_count'] as const).map((key, k) => <label key={key}>{['Doğru', 'Yanlış', 'Boş'][k]}
                <input required className={field} type="number" min={0} max={2147483647} step={1} value={Number.isNaN(r[key]) ? '' : r[key]} onChange={e => setInput({ ...input, subject_results: input.subject_results.map((row, index) => index === i ? { ...row, [key]: e.target.valueAsNumber } : row) })} /></label>)}</div>
              <p>Net: {Number.isFinite(examNet(r.correct_count, r.wrong_count)) ? formatNumber(examNet(r.correct_count, r.wrong_count)) : '—'}</p>
              {input.exam_type !== 'BRANCH' && <button type="button" className="text-sm text-red-700" onClick={() => setInput({ ...input, subject_results: input.subject_results.filter(row => row.subject_id !== r.subject_id), topic_errors: input.topic_errors.filter(t => t.subject_id !== r.subject_id) })}>Dersi çıkar</button>}
            </div>)}
            {available.filter(s => !input.subject_results.some(r => r.subject_id === s.id)).map(s => <button key={s.id} type="button" className="mr-3 text-indigo-700" onClick={() => setInput({ ...input, subject_results: [...input.subject_results, { subject_id: s.id, correct_count: 0, wrong_count: 0, blank_count: 0 }] })}>{s.name} ekle</button>)}
            <p className="font-bold">Toplam net: {formatNumber(examTotal(input.subject_results))}</p></>}
          {step === 3 && <><p className="text-sm text-gray-500">Yalnız yanlış ve boş sorularını etiketle. Konu etiketlemek zorunlu değil.</p>
            {input.subject_results.filter(r => r.wrong_count + r.blank_count > 0).map(r => <div key={r.subject_id} className="border rounded-xl p-3 space-y-3"><h3 className="font-semibold">{name(r.subject_id)} — {r.wrong_count} yanlış, {r.blank_count} boş</h3>
              {input.topic_errors.filter(t => t.subject_id === r.subject_id).map(t => <div key={t.topic_id} className="space-y-2"><p>{catalog.topics.find(c => c.id === t.topic_id)?.name}</p><div className="grid grid-cols-2 gap-2">
                {(['wrong_count', 'blank_count'] as const).map((key, k) => <label key={key}>{k === 0 ? 'Yanlış' : 'Boş'}<input required type="number" min={0} step={1} max={r[key]} className={field} value={Number.isNaN(t[key]) ? '' : t[key]} onChange={e => setInput({ ...input, topic_errors: input.topic_errors.map(row => row.topic_id === t.topic_id ? { ...row, [key]: e.target.valueAsNumber } : row) })} /></label>)}</div>
                <button type="button" className="text-red-700 text-sm" onClick={() => setInput({ ...input, topic_errors: input.topic_errors.filter(row => row.topic_id !== t.topic_id) })}>Etiketi kaldır</button></div>)}
              <label>Konu ekle<select className={field} value="" onChange={e => { if (e.target.value) setInput({ ...input, topic_errors: [...input.topic_errors, { subject_id: r.subject_id, topic_id: e.target.value, wrong_count: 0, blank_count: 0 }] }) }}>
                <option value="">Konu seç</option>{catalog.topics.filter(t => t.is_active && t.subject_id === r.subject_id && !input.topic_errors.some(row => row.topic_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            </div>)}<p className="font-bold">Toplam net: {formatNumber(examTotal(input.subject_results))}</p></>}
          <div className="flex flex-wrap gap-3"><button type="button" className="px-3 py-2" onClick={() => { setStep(0); setError('') }}>İptal</button>
            {step > 1 && <button type="button" className="px-3 py-2" onClick={() => { setStep(step - 1); setError('') }}>Geri</button>}
            <button className={button} type="submit" aria-busy={busy}>{busy ? 'Kaydediliyor...' : step < 3 ? 'Devam' : 'Kaydet'}</button></div>
        </fieldset>
      </form>}
      <div className="grid lg:grid-cols-2 gap-4">{(['TYT', 'AYT'] as const).map(type => {
        const points = [...exams].reverse().filter(e => e.exam_type === type).map(e => ({ date: e.exam_date, net: examTotal(e.subject_results) }))
        return <section key={type} className="rounded-2xl bg-white border p-4"><h2 className="font-bold mb-3">{type} Net Trendi</h2>
          {points.length < 2 ? <p className="text-sm text-gray-500">{points.length ? 'İkinci denemeden sonra trend burada görünecek.' : `Henüz ${type} denemesi yok.`}</p> :
            <div className="h-56" role="img" aria-label={`${type} netleri: ${points.map(p => `${formatDate(p.date, { dateStyle: 'medium' })}: ${formatNumber(p.net)}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={value => formatDate(value, { day: 'numeric', month: 'short' })} /><YAxis tickFormatter={value => formatNumber(Number(value), 0)} /><Tooltip formatter={value => formatNumber(Number(value))} labelFormatter={value => formatDate(String(value), { dateStyle: 'medium' })} /><Line dataKey="net" name="Net" stroke="#4f46e5" strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}</section>
      })}</div>
      <section className="space-y-3"><h2 className="text-xl font-bold">Geçmiş denemeler</h2>{!exams.length && <p>Henüz deneme yok. Deneme ekleyerek ilerleme trendini görebilirsin.</p>}
        {exams.map(exam => { const delta = previousExamDelta(exam, exams); return <article key={exam.id} className="rounded-2xl bg-white border p-5 space-y-3">
          <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><h3 className="font-bold">{exam.exam_type === 'BRANCH' ? `Branş · ${name(exam.branch_subject_id!)}` : exam.exam_type} · {exam.name || 'İsimsiz deneme'}</h3><time dateTime={exam.exam_date}>{formatDate(exam.exam_date, { dateStyle: 'medium' })}</time></div><strong className="tabular-nums">{formatNumber(examTotal(exam.subject_results))} net</strong></div>
          <p className="text-sm text-gray-500">{delta === null ? 'Önceki aynı tür deneme yok.' : `Önceki aynı tür denemeye göre ${delta > 0 ? '+' : ''}${formatNumber(delta)} net`}</p>
          <ul className="text-sm space-y-1">{exam.subject_results.map(r => <li key={r.subject_id}>{name(r.subject_id)}: {r.correct_count} D / {r.wrong_count} Y / {r.blank_count} B · {formatNumber(examNet(r.correct_count, r.wrong_count))} net</li>)}</ul>
          <div className="flex gap-4"><button type="button" disabled={busy || step > 0} className="text-indigo-700 disabled:opacity-50" onClick={() => { setInput({ ...exam, subject_results: exam.subject_results.map(r => ({ ...r })), topic_errors: exam.topic_errors.map(t => ({ ...t })) }); setEditing(exam.id); setStep(1); setError(''); setNotice(''); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }}>Düzenle</button>
            <button type="button" disabled={busy || step > 0} className="text-red-700 disabled:opacity-50" onClick={() => void remove(exam)}>Sil</button></div>
        </article> })}
      </section>
    </>}
  </div>
}
