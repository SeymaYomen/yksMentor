import React, { useState } from 'react'
import type { GoalMetricProgress, GoalProgressResult } from '../../lib/goalProgress'
import Card from '../ui/Card'
import GoalForm from './GoalForm'

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)
}

function scoreTypeLabel(value: string | null) {
  return ({ sayisal: 'SAY', esit_agirlik: 'EA', sozel: 'SÖZ', dil: 'DİL', tyt: 'TYT' } as Record<string, string>)[value ?? ''] ?? null
}

function Metric({ name, metric }: { name: string; metric: GoalMetricProgress }) {
  if (metric.target === null) return null
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-300">{name}</span>
        <span className="font-bold text-white">
          {metric.current === null ? 'Veri yok' : `${formatNumber(metric.current)} / ${formatNumber(metric.target)}`}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-300">
        {metric.current === null
          ? 'Performans girişi bekleniyor.'
          : metric.reached
            ? 'Hedef seviyesi aşıldı veya karşılandı.'
            : `${formatNumber(metric.remaining ?? 0)} net kaldı`}
      </div>
      {metric.change30Days !== null && (
        <div className={`mt-1 text-xs font-semibold ${metric.change30Days > 0 ? 'text-emerald-300' : metric.change30Days < 0 ? 'text-red-300' : 'text-slate-300'}`}>
          Son 30 gün: {metric.change30Days > 0 ? '+' : ''}{formatNumber(metric.change30Days)}
        </div>
      )}
    </div>
  )
}

type Props = {
  studentId: string
  progress: GoalProgressResult
  loading?: boolean
  error?: Error | null
}

export default function GoalProgressCard({ studentId, progress, loading, error }: Props) {
  const [editing, setEditing] = useState(false)
  const goal = progress.goal

  return (
    <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-md font-bold uppercase tracking-wider text-indigo-300">🎯 Hedefim</h3>
        {!loading && (
          <button type="button" onClick={() => setEditing(value => !value)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
            {editing ? 'Kapat' : goal ? 'Değiştir' : 'Hedef belirle'}
          </button>
        )}
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-300">Hedef yükleniyor...</p> : error ? (
        <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">Hedef yüklenemedi: {error.message}</p>
      ) : editing ? (
        <div className="mt-4 rounded-xl bg-white p-4 text-gray-800">
          <GoalForm studentId={studentId} goal={goal} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        </div>
      ) : !goal ? (
        <div className="mt-4 rounded-xl border border-dashed border-indigo-400/50 bg-white/5 p-4 text-sm text-slate-200">
          Henüz ana hedef belirlenmedi.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(goal.university_name || goal.program_name) && (
            <div>
              {goal.university_name && <div className="text-lg font-bold">{goal.university_name}</div>}
              {goal.program_name && <div className="text-sm text-slate-200">{goal.program_name}</div>}
            </div>
          )}
          {(scoreTypeLabel(goal.score_type) || goal.target_rank !== null || goal.target_score !== null) && (
            <div className="text-sm text-indigo-200">
              {[scoreTypeLabel(goal.score_type), goal.target_rank !== null ? `İlk ${formatNumber(goal.target_rank)}` : null, goal.target_score !== null ? `${formatNumber(goal.target_score)} puan` : null].filter(Boolean).join(' — ')}
            </div>
          )}
          <Metric name="TYT" metric={progress.metrics.tyt} />
          <Metric name="AYT" metric={progress.metrics.ayt} />
          <div className="rounded-xl bg-white/10 px-3 py-2 text-sm"><span className="text-slate-300">Durum: </span><strong>{progress.label}</strong></div>
          {progress.rankEstimateMessage && <p className="text-xs leading-relaxed text-slate-300">{progress.rankEstimateMessage}</p>}
        </div>
      )}
    </Card>
  )
}
