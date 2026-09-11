import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadAssessmentData } from '../../lib/mockExamData'
import { examHistory, latestExamSummary } from '../../lib/mockExams'
import type { StudyPerformanceRow } from '../../lib/studySessions'
import { formatNumber } from '../../lib/format'

export default function MockExamSummary({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<StudyPerformanceRow[]>([])
  const [state, setState] = useState('loading')
  useEffect(() => {
    let active = true
    setState('loading')
    loadAssessmentData([studentId]).then(data => { if (active) { setRows(data.performance); setState('ready') } })
      .catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [studentId])
  return <section className="rounded-2xl bg-white border p-5 space-y-3" aria-label="Deneme özeti">
    <h3 className="font-bold">Denemelerim</h3>
    {state === 'loading' ? <p role="status">Yükleniyor...</p> : state === 'error' ? <p role="alert">Deneme özeti yüklenemedi.</p> :
      <div className="grid gap-4 sm:grid-cols-2">{(['TYT', 'AYT'] as const).map(type => {
        const { latest, delta } = latestExamSummary(examHistory(rows, type))
        return <div key={type} className="rounded-xl bg-slate-50 p-3"><h4 className="text-sm text-slate-600">Son {type}</h4>{latest ? <><strong className="text-xl tabular-nums">{formatNumber(latest.net)} net</strong>
          <p className="text-sm text-gray-500">{delta === null ? 'Karşılaştırma için ikinci deneme gerekli.' : `Öncekine göre ${delta > 0 ? '+' : ''}${formatNumber(delta)} net`}</p>
          {latest.source === 'legacy' && <small>Önceki performans kaydı</small>}</> : <p>Henüz {type} denemesi yok.</p>}</div>
      })}</div>}
    <Link className="inline-flex min-h-11 items-center font-semibold text-indigo-700" to="/student/exams">Denemeleri Aç →</Link>
  </section>
}
