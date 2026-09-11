import React, { useState } from 'react'
import type { GoalMetricProgress, GoalProgressResult } from '../../lib/goalProgress'
import Card from '../ui/Card'
import { goalReaction, GOAL_REACTION_LABELS, netProgressPercent } from '../../lib/goalPresentation'
import GoalForm from './GoalForm'

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)
}

function formatNet(value: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function scoreTypeLabel(value: string | null) {
  return ({ sayisal: 'SAY', esit_agirlik: 'EA', sozel: 'SÖZ', dil: 'DİL', tyt: 'TYT' } as Record<string, string>)[value ?? ''] ?? null
}

function Metric({ name, metric }: { name: string; metric: GoalMetricProgress }) {
  if (metric.target === null) return null
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-slate-600">{name}</span>
        <span className="font-bold text-slate-900">
          {metric.current !== null && `${formatNet(metric.current)} / ${formatNumber(metric.target)}`}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-600">
        {metric.current === null
          ? `Henüz ${name} denemesi yok.`
          : metric.reached
            ? 'Hedef seviyesi aşıldı veya karşılandı.'
            : `${formatNet(metric.remaining ?? 0)} net kaldı`}
      </div>
      {metric.current !== null && (
        <div role="progressbar" aria-label={`${name} net hedefi`} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(netProgressPercent(metric) ?? 0)}
          aria-valuetext={`${formatNet(metric.current)} / ${formatNumber(metric.target)} net`}
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 ${metric.reached ? 'bg-emerald-600' : 'bg-indigo-500'}`}
            style={{ width: `${netProgressPercent(metric) ?? 0}%` }} />
        </div>
      )}
      {metric.change30Days !== null && (
        <div className={`mt-1 text-xs font-semibold ${metric.change30Days > 0 ? 'text-emerald-700' : metric.change30Days < 0 ? 'text-red-700' : 'text-slate-600'}`}>
          Son 30 gün: {metric.change30Days > 0 ? '+' : ''}{formatNet(metric.change30Days)}
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
  const reaction = goalReaction(progress)
  const reactionLabel = GOAL_REACTION_LABELS[reaction]
  const emphasis = !loading && !error && !editing && goal
    ? reaction === 'achieved' ? 'border-emerald-300' : reaction === 'near' ? 'border-indigo-300' : ''
    : ''

  return (
    <Card className={`text-slate-900 motion-reduce:transition-none ${emphasis}`}>
      <h3 className="text-sm font-bold text-slate-500">Hedefim</h3>

      {loading ? <p className="mt-4 text-sm text-slate-600">Hedef yükleniyor...</p> : error ? (
        <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-700">Hedef yüklenemedi: {error.message}</p>
      ) : editing ? (
        <div className="mt-4 rounded-xl bg-white p-4 text-gray-800">
          <GoalForm studentId={studentId} goal={goal} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        </div>
      ) : !goal ? (
        <div className="mt-4 rounded-xl border border-dashed border-indigo-400/50 bg-white/5 p-4 text-sm text-slate-600">
          Henüz ana hedef belirlenmedi.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(goal.university_name || goal.program_name) && (
            <div>
              <div className="break-words text-lg font-bold">{[goal.university_name, goal.program_name].filter(Boolean).join(' · ')}</div>
            </div>
          )}
          {(scoreTypeLabel(goal.score_type) || goal.target_rank !== null || goal.target_score !== null) && (
            <div className="text-sm text-slate-600">
              {[scoreTypeLabel(goal.score_type), goal.target_rank !== null ? `İlk ${formatNumber(goal.target_rank)}` : null, goal.target_score !== null ? `${formatNumber(goal.target_score)} puan` : null].filter(Boolean).join(' · ')}
            </div>
          )}
          <Metric name="TYT" metric={progress.metrics.tyt} />
          <Metric name="AYT" metric={progress.metrics.ayt} />
          {reactionLabel && (
            <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${reaction === 'achieved' ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800'}`}>
              {reactionLabel}
              {reaction === 'achieved' && <span className="mt-1 block text-xs font-normal">Tanımlı net hedeflerin karşılandı.</span>}
            </div>
          )}
          {progress.rankEstimateMessage && <p className="text-xs leading-relaxed text-slate-600">{progress.rankEstimateMessage}</p>}
        </div>
      )}
      {!loading && !error && !editing && (
        <button type="button" onClick={() => setEditing(true)}
          className="mt-4 min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {goal ? 'Hedefi Değiştir' : 'Hedef belirle'}
        </button>
      )}
    </Card>
  )
}
