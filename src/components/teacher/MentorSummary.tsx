import React, { useEffect, useMemo, useState } from 'react'
import type { MetricComparison, StudentStatusResult, TrendDirection } from '../../lib/studentStatus'
import type { GoalMetricProgress, GoalProgressResult } from '../../lib/goalProgress'
import { selectCompetencyHighlights, type CompetencyMapResult, type TopicCompetencyResult } from '../../lib/competencyMap'
import type { MentorAlertResult } from '../../lib/mentorAlerts'
import StudentStatusBadge from './StudentStatusBadge'
import AIMentorInsightPanel from './AIMentorInsightPanel'
import { formatNumber as formatValue } from '../../lib/format'
import {
  buildAIMentorContext,
  createAIMentorContextFingerprint,
} from '../../lib/aiMentorContext'
function formatNumber(value: number | null, suffix = '') {
  if (value === null) return 'Henüz yeterli veri yok'
  if (suffix === ' saat') {
    const minutes = Math.round(value * 60)
    return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`
  }
  return `${formatValue(value)}${suffix}`
}

function formatNet(value: number) {
  return formatValue(value)
}

function trendArrow(trend: TrendDirection) {
  if (trend === 'up') return <span className="font-bold text-emerald-600" aria-label="artıyor">↑</span>
  if (trend === 'down') return <span className="font-bold text-red-600" aria-label="azalıyor">↓</span>
  if (trend === 'stable') return <span className="font-bold text-gray-500" aria-label="durağan">→</span>
  return null
}

function comparisonText(comparison: MetricComparison, suffix = '') {
  if (comparison.previous === null || comparison.current === null) {
    return <span className="text-gray-500">Henüz yeterli veri yok</span>
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      {suffix ? formatNumber(comparison.previous, suffix) : formatNet(comparison.previous)}
      <span className="text-gray-500">→</span>
      {suffix ? formatNumber(comparison.current, suffix) : formatNet(comparison.current)}
      {trendArrow(comparison.trend)}
    </span>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 py-2.5 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-gray-700">{children}</dd>
    </div>
  )
}

function GoalMetricRow({ label, metric }: { label: string; metric: GoalMetricProgress }) {
  if (metric.target === null) return null
  return (
    <div className="rounded-xl border border-indigo-100 bg-white/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-bold text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-indigo-700">
          {metric.current === null ? `Henüz ${label} denemesi yok.` : `${formatNet(metric.current)} / ${formatNumber(metric.target)}`}
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

function CompetencyList({ title, topics, className }: { title: string; topics: TopicCompetencyResult[]; className: string }) {
  if (topics.length === 0) return null
  return (
    <div>
      <h6 className={`text-xs font-bold uppercase tracking-wider ${className}`}>{title}</h6>
      <ul className="mt-1.5 space-y-1 text-sm text-gray-700">
        {topics.slice(0, 3).map(topic => (
          <li key={topic.topicId}>• {topic.examType} {topic.subjectName} / {topic.topicName} {topic.trend === 'improving' ? '↑' : topic.trend === 'declining' ? '↓' : ''}</li>
        ))}
      </ul>
    </div>
  )
}

export default function MentorSummary({
  displayName,
  status,
  goalProgress,
  competencyMap,
  alerts,
}: {
  displayName: string
  status: StudentStatusResult
  goalProgress: GoalProgressResult
  competencyMap: CompetencyMapResult
  alerts: MentorAlertResult
}) {
  const context = useMemo(() => buildAIMentorContext({
    displayName, studentStatus: status, goalProgress, competencyMap, mentorAlerts: alerts,
  }), [displayName, status, goalProgress, competencyMap, alerts])
  const [fingerprint, setFingerprint] = useState<{ context: typeof context; value: string } | null>(null)
  const currentFingerprint = fingerprint?.context === context ? fingerprint.value : null
  useEffect(() => {
    let active = true
    void createAIMentorContextFingerprint(context).then(value => {
      if (active) setFingerprint({ context, value })
    }).catch(() => { if (active) setFingerprint(null) })
    return () => { active = false }
  }, [context])
  const { metrics } = status
  const competencyHighlights = selectCompetencyHighlights(competencyMap)

  return (
    <section className="mb-5 rounded-2xl border border-indigo-100 bg-slate-50/70 p-4 sm:p-5" aria-labelledby="mentor-summary-title">
      <div className="flex flex-col gap-3 border-b border-indigo-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 id="mentor-summary-title" className="text-lg font-bold text-gray-800">Mentor Özeti</h4>
          <p className="mt-1 text-sm text-gray-500">Öğrencinin son durumu, hedefleri ve takip öncelikleri.</p>
        </div>
        <StudentStatusBadge status={status} />
      </div>

      {!status.hasEnoughData && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {status.warnings.length > 0 || alerts.alerts.length > 0
            ? 'Genel değerlendirme için veri sınırlı. Mevcut uyarılar gözlenen gecikme veya risklere dayanıyor.'
            : 'Henüz güvenilir bir değerlendirme için yeterli performans, çalışma veya değerlendirilebilir görev verisi yok.'}
        </div>
      )}

      {alerts.alerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-amber-700">Aktif Uyarılar</h5>
            <span className="text-xs font-medium text-gray-500">{alerts.summary}</span>
          </div>
          <ul className="mt-3 grid gap-2 2xl:grid-cols-2">
            {alerts.alerts.map(alert => (
              <li key={alert.type} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${alert.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-sm font-bold text-gray-800">{alert.title}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-600">{alert.reason}</p>
              </li>
            ))}
          </ul>
          {alerts.suggestedAction && (
            <p className="mt-3 border-t border-amber-100 pt-3 text-sm font-semibold text-indigo-700">Öneri: {alerts.suggestedAction}</p>
          )}
        </div>
      )}

      <AIMentorInsightPanel studentId={alerts.studentId} currentFingerprint={currentFingerprint} />

      <div className="mt-4 grid gap-5 2xl:grid-cols-2">
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">Son dönem</h5>
          <dl className="mt-2">
            <SummaryRow label="TYT">{comparisonText(metrics.tyt)}</SummaryRow>
            <SummaryRow label="AYT">{comparisonText(metrics.ayt)}</SummaryRow>
            <SummaryRow label="Çalışma">{comparisonText(metrics.studyHours, ' saat')}</SummaryRow>
            <SummaryRow label="Görev uyumu">
              {metrics.taskCompletionRate === null ? 'Henüz değerlendirilebilir görev yok' : `%${formatNumber(metrics.taskCompletionRate)}`}
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
          <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Hedefe İlerleme</h5>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">{goalProgress.label}</span>
        </div>
        {!goalProgress.hasGoal ? (
          <p className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-white/60 p-3 text-sm text-gray-500">Henüz ana hedef belirlenmedi.</p>
        ) : (
          <div className="mt-3 grid gap-4 2xl:grid-cols-2">
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

      <div className="mt-5 border-t border-indigo-100 pt-5">
        <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">Akademik Yetkinlik</h5>
        {!competencyMap.hasReliableData ? (
          <p className="mt-3 rounded-xl border border-dashed border-purple-200 bg-white/60 p-3 text-sm text-gray-500">Henüz yeterli konu verisi yok.</p>
        ) : (
          <div className="mt-3 grid gap-4 2xl:grid-cols-3">
            <CompetencyList title="Güçlü alanlar" topics={competencyHighlights.strong} className="text-emerald-600" />
            <CompetencyList
              title="Gelişen alanlar"
              topics={competencyHighlights.developing}
              className="text-blue-600"
            />
            <CompetencyList
              title="Dikkat gerekenler"
              topics={competencyHighlights.attention}
              className="text-red-600"
            />
          </div>
        )}
      </div>
    </section>
  )
}
