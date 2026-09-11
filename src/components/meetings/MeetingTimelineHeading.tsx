import React from 'react'
import { meetingCountdown } from '../../lib/format'

export function meetingDayLabel(scheduledAt: string | null, status: string, now = new Date()) {
  if (status === 'completed') return 'Tamamlandı'
  if (status === 'cancelled') return 'İptal edildi'
  if (!scheduledAt) return 'Tarih bekleniyor'
  return meetingCountdown(scheduledAt, now)
}

export default function MeetingTimelineHeading({ title, person, scheduledAt, status, isTeacher }: {
  title: string
  person?: string
  scheduledAt: string | null
  status: string
  isTeacher: boolean
}) {
  const date = scheduledAt ? new Date(scheduledAt) : null
  const valid = date && Number.isFinite(date.getTime())
  return <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
    <div className={`rounded-xl border p-2 text-center tabular-nums ${status === 'scheduled' ? 'border-indigo-100 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
      {valid ? <time dateTime={scheduledAt!}>
        <span className="block text-xl font-semibold">{date.getDate()}</span>
        <span className="block text-xs">{date.toLocaleDateString('tr-TR', { month: 'short' })}</span>
        <span className="block text-[10px]">{date.getFullYear()}</span>
      </time> : <span className="text-xs">Tarih yok</span>}
    </div>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {valid && <time dateTime={scheduledAt!} className="tabular-nums">{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</time>}
        <span className="rounded-full bg-slate-100 px-2 py-1">{meetingDayLabel(scheduledAt, status)}</span>
      </div>
      <h4 className="mt-1 break-words font-semibold text-slate-800">{title}</h4>
      <p className="mt-1 text-sm text-slate-600">{isTeacher ? 'Öğrenci' : 'Öğretmen'}: {person || 'Bilgi bekleniyor'}</p>
    </div>
  </div>
}
