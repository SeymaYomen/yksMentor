import React from 'react'
import type { BriefingMetricChange, MeetingBriefing } from '../../lib/meetingBriefing'
import { selectCompetencyHighlights } from '../../lib/competencyMap'
import Spinner from '../ui/Spinner'
import StudentStatusBadge from '../teacher/StudentStatusBadge'

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)
}

function MetricChange({ label, metric, suffix = '' }: { label: string; metric: BriefingMetricChange; suffix?: string }) {
  if (!metric.hasData || metric.previous === null || metric.current === null || metric.delta === null) {
    return (
      <div className="rounded-lg bg-white/70 px-3 py-2">
        <div className="text-xs font-semibold text-gray-500">{label}</div>
        <div className="mt-1 text-sm text-gray-600">{metric.current === null ? (suffix ? 'Henüz veri yok.' : `Henüz ${label.slice(0, 3)} denemesi yok.`) : <>{formatNumber(metric.current)}{suffix}<small className="block">{suffix ? 'Karşılaştırma için yeterli çalışma geçmişi yok.' : 'Trend için bir deneme daha gerekli.'}</small></>}</div>
      </div>
    )
  }

  const deltaClass = metric.delta > 0 ? 'text-emerald-600' : metric.delta < 0 ? 'text-red-600' : 'text-gray-500'
  const deltaPrefix = metric.delta > 0 ? '+' : ''

  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-700">
        {formatNumber(metric.previous)} → {formatNumber(metric.current)}{suffix}{' '}
        <span className={deltaClass}>({deltaPrefix}{formatNumber(metric.delta)})</span>
      </div>
    </div>
  )
}

type Props = {
  briefing?: MeetingBriefing
  loading: boolean
  error: Error | null
}

export default function MeetingBriefingPanel({ briefing, loading, error }: Props) {
  if (loading && !briefing) {
    return <div className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-700"><Spinner /> Brifing hazırlanıyor...</div>
  }

  if (error) {
    return <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Brifing yüklenemedi: {error.message}</div>
  }

  if (!briefing) return null

  const competencyHighlights = briefing.competencyMap
    ? selectCompetencyHighlights(briefing.competencyMap, 2)
    : { strong: [], developing: [], attention: [] }
  const academicItems = [
    ...competencyHighlights.attention.map(topic => `${topic.examType} ${topic.topicName} ${topic.trend === 'declining' ? 'son ölçümlerde düşüyor.' : 'dikkat gerektiriyor.'}`),
    ...competencyHighlights.developing
      .filter(topic => topic.trend === 'improving')
      .map(topic => `${topic.examType} ${topic.topicName} gelişiyor.`),
  ].slice(0, 2)

  return (
    <section className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4" aria-label="Görüşme öncesi brifing">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="font-bold text-gray-800">Görüşme Öncesi Brifing</h5>
          <p className="mt-0.5 text-xs text-gray-500">
            {briefing.period.label} · {new Date(briefing.period.start).toLocaleDateString('tr-TR')} – {new Date(briefing.period.end).toLocaleDateString('tr-TR')}
          </p>
        </div>
        <StudentStatusBadge status={briefing.studentStatus} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MetricChange label="TYT değişimi" metric={briefing.performance.tyt} />
        <MetricChange label="AYT değişimi" metric={briefing.performance.ayt} />
        <MetricChange label="Haftalık çalışma" metric={briefing.performance.weeklyStudyHours} suffix=" saat" />
      </div>

      <div className="mt-3 rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Görev uyumu</div>
        {briefing.tasks.hasData ? (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            <span><strong>{briefing.tasks.total}</strong> verildi</span>
            <span><strong>{briefing.tasks.completed}</strong> tamamlandı</span>
            <span><strong>{briefing.tasks.open}</strong> açık</span>
            <span className={briefing.tasks.overdue > 0 ? 'text-red-600' : ''}><strong>{briefing.tasks.overdue}</strong> gecikti</span>
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-400">Bu dönemde atanmış görev yok.</p>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">Hedef durumu</div>
        {!briefing.goalProgress?.hasGoal ? (
          <p className="mt-1 text-sm text-gray-500">Henüz ana hedef belirlenmedi.</p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {typeof briefing.goalProgress.goal?.target_rank === 'number' && (
              <p><strong>Hedef sıralama:</strong> {new Intl.NumberFormat('tr-TR').format(briefing.goalProgress.goal?.target_rank ?? 0)}</p>
            )}
            {(['tyt', 'ayt'] as const).map(key => {
              const metric = briefing.goalProgress?.metrics[key]
              if (!metric || metric.target === null) return null
              const periodChange = briefing.performance[key]
              return (
                <p key={key}>
                  <strong>{key.toUpperCase()}:</strong>{' '}
                  {metric.current === null
                    ? 'Performans verisi bekleniyor.'
                    : metric.reached
                      ? 'Hedef seviyesi aşıldı veya karşılandı.'
                      : `Hedefin ${formatNumber(metric.remaining ?? 0)} net gerisinde.`}
                  {periodChange.hasData && periodChange.delta !== null && (
                    <span className="text-gray-500"> Son iki deneme: {periodChange.delta > 0 ? '+' : ''}{formatNumber(periodChange.delta)} net.</span>
                  )}
                </p>
              )
            })}
            <p className="pt-1 text-xs font-semibold text-indigo-700">{briefing.goalProgress.label}</p>
            {briefing.goalProgress.roadmap.slice(0, 2).map(item => <p key={item} className="text-xs text-gray-600">• {item}</p>)}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-purple-600">Akademik dikkat</div>
        {!briefing.competencyMap?.hasReliableData ? (
          <p className="mt-1 text-sm text-gray-500">Henüz yeterli konu verisi yok.</p>
        ) : academicItems.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {academicItems.map(item => <li key={item}>• {item}</li>)}
          </ul>
        ) : <p className="mt-1 text-sm text-gray-500">Belirgin akademik dikkat sinyali yok.</p>}
      </div>

      {!briefing.hasPeriodActivity && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bu dönem için henüz yeni performans veya görev verisi oluşmadı.
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h6 className="text-xs font-bold uppercase tracking-wider text-red-600">Dikkat</h6>
          {briefing.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-red-700">
              {briefing.warnings.map(warning => <li key={warning}>• {warning}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-gray-400">Belirgin bir uyarı yok.</p>}
        </div>
        <div>
          <h6 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Olumlu</h6>
          {briefing.positives.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-emerald-700">
              {briefing.positives.map(positive => <li key={positive}>• {positive}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-gray-400">Henüz doğrulanmış olumlu sinyal yok.</p>}
        </div>
      </div>

      <div className="mt-4 border-t border-indigo-100 pt-4">
        <h6 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Önceki görüşmelerden kalanlar</h6>
        {briefing.previousOpenItems.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {briefing.previousOpenItems.map(item => (
              <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                <span>{item.item_text}</span>
                {item.isOverdue && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Süresi geçti</span>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-gray-400">Açık karar veya takip maddesi yok.</p>}
      </div>
    </section>
  )
}
