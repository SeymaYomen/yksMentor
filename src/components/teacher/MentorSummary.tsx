import React from 'react'
import type { MetricComparison, StudentStatusResult, TrendDirection } from '../../lib/studentStatus'
import type { GoalMetricProgress, GoalProgressResult } from '../../lib/goalProgress'
import StudentStatusBadge from './StudentStatusBadge'

function formatNumber(value: number | null, suffix = '') {
  if (value === null) return 'Henüz yeterli veri yok'
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)}${suffix}`
}

function trendArrow(trend: TrendDirection) {
  if (trend === 'up') return <span className="font-bold text-emerald-600" aria-label="artıyor">↑</span>
  if (trend === 'down') return <span className="font-bold text-red-600" aria-label="azalıyor">↓</span>
  if (trend === 'stable') return <span className="font-bold text-gray-500" aria-label="durağan">→</span>
  return null
}

function comparisonText(comparison: MetricComparison, suffix = '') {
  if (comparison.previous === null || comparison.current === null) {
    return <span className="text-gray-400">Henüz yeterli veri yok</span>
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {formatNumber(comparison.previous, suffix)}
      <span className="text-gray-400">→</span>
      {formatNumber(comparison.current, suffix)}
      {trendArrow(comparison.trend)}
    </span>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-gray-700">{children}</dd>
    </div>
  )
}

function GoalMetricRow({ label, metric }: { label: string; metric: GoalMetricProgress }) {
  if (metric.target === null) return null
  return (
    <div className="rounded-xl border border-indigo-100 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-indigo-700">
          {metric.current === null ? 'Performans verisi yok' : `${formatNumber(metric.current)} / ${formatNumber(metric.target)}`}
        </span>
      </div>
      {metric.current !== null && (
        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
          <span>{metric.reached ? 'Hedef seviyesi aşıldı veya karşılandı' : `Kalan: ${formatNumber(metric.remaining)}`}</span>
          {metric.change30Days !== null && <span>Son dönem: {metric.change30Days > 0 ? '+' : ''}{formatNumber(metric.change30Days)}</span>}
        </div>
      )}
    </div>
  )
}

export default function MentorSummary({ status, goalProgress }: { status: StudentStatusResult; goalProgress: GoalProgressResult }) {
  const { metrics } = status

  return (
    <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5" aria-labelledby="mentor-summary-title">
      <div className="flex flex-col gap-3 border-b border-indigo-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 id="mentor-summary-title" className="text-lg font-bold text-gray-800">Mentor Özeti</h4>
          <p className="mt-1 text-sm text-gray-500">Mevcut öğrenci verilerinden kural tabanlı olarak hesaplanır.</p>
        </div>
        <StudentStatusBadge status={status} />
      </div>

      {!status.hasEnoughData && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Henüz güvenilir bir değerlendirme için yeterli performans, görev veya tamamlanmış görüşme verisi yok.
        </div>
      )}

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">Son dönem</h5>
          <dl className="mt-2">
            <SummaryRow label="TYT">{comparisonText(metrics.tyt)}</SummaryRow>
            <SummaryRow label="AYT">{comparisonText(metrics.ayt)}</SummaryRow>
            <SummaryRow label="Çalışma">{comparisonText(metrics.studyHours, ' saat')}</SummaryRow>
            <SummaryRow label="Görev uyumu">
              {metrics.taskCompletionRate === null ? 'Henüz görev yok' : formatNumber(metrics.taskCompletionRate, '%')}
            </SummaryRow>
            <SummaryRow label="Açık / geciken görev">
              {metrics.totalTasks === 0 ? 'Henüz görev yok' : `${metrics.openTasks} / ${metrics.overdueTasks}`}
            </SummaryRow>
            <SummaryRow label="Son görüşme">
              {metrics.lastMeetingDays === null
                ? 'Henüz tamamlanmış görüşme yok'
                : metrics.lastMeetingDays === 0
                  ? 'Bugün'
                  : `${metrics.lastMeetingDays} gün önce`}
            </SummaryRow>
            {metrics.nextMeetingAt && (
              <SummaryRow label="Yaklaşan görüşme">
                {new Date(metrics.nextMeetingAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
              </SummaryRow>
            )}
          </dl>
        </div>

        <div className="space-y-4">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">Değerlendirme nedeni</h5>
            <ul className="mt-2 space-y-2">
              {status.reasons.map(reason => (
                <li key={reason} className="rounded-lg bg-white/80 px-3 py-2 text-sm text-gray-700 shadow-sm">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {status.warnings.length > 0 && (
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-red-600">Dikkat</h5>
              <ul className="mt-2 space-y-1.5 text-sm text-red-700">
                {status.warnings.map(warning => <li key={warning}>• {warning}</li>)}
              </ul>
            </div>
          )}

          {status.positives.length > 0 && (
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Olumlu</h5>
              <ul className="mt-2 space-y-1.5 text-sm text-emerald-700">
                {status.positives.map(positive => <li key={positive}>• {positive}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-indigo-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-600">🎯 Hedefe İlerleme</h5>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">{goalProgress.label}</span>
        </div>
        {!goalProgress.hasGoal ? (
          <p className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-white/60 p-3 text-sm text-gray-500">Henüz ana hedef belirlenmedi.</p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {(goalProgress.goal?.university_name || goalProgress.goal?.program_name || typeof goalProgress.goal?.target_rank === 'number') && (
                <div className="rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm text-gray-700">
                  {[goalProgress.goal?.university_name, goalProgress.goal?.program_name].filter(Boolean).join(' — ')}
                  {goalProgress.goal?.target_rank !== null && goalProgress.goal?.target_rank !== undefined && (
                    <div className="mt-1 text-xs font-semibold text-indigo-700">Hedef sıralama: {new Intl.NumberFormat('tr-TR').format(goalProgress.goal.target_rank)}</div>
                  )}
                </div>
              )}
              <GoalMetricRow label="TYT" metric={goalProgress.metrics.tyt} />
              <GoalMetricRow label="AYT" metric={goalProgress.metrics.ayt} />
              {goalProgress.rankEstimateMessage && <p className="text-xs leading-relaxed text-gray-500">{goalProgress.rankEstimateMessage}</p>}
            </div>
            <div>
              <h6 className="text-xs font-bold uppercase tracking-wider text-gray-500">Kısa yol haritası</h6>
              <ul className="mt-2 space-y-2 text-sm text-gray-700">
                {goalProgress.roadmap.map(item => <li key={item} className="rounded-lg bg-white/80 px-3 py-2 shadow-sm">• {item}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
