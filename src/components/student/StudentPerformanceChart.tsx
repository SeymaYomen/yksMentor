import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import Spinner from '../ui/Spinner'
import usePerformance from '../../hooks/usePerformance'
import { formatNumber } from '../../lib/format'

export default function StudentPerformanceChart({ studentId }: { studentId: string }) {
  const { data, loading, error } = usePerformance(studentId)

  if (!studentId) return <div className="text-sm text-gray-500">Lütfen giriş yapın.</div>
  if (loading) return <div role="status" aria-label="Çalışma süresi yükleniyor" className="flex items-center justify-center py-4"><Spinner /></div>
  if (error) return <div role="alert" className="text-sm text-red-700">Çalışma süresi yüklenemedi. Lütfen tekrar deneyin.</div>
  const studyRows = (data ?? []).filter(row => typeof row.daily_hours === 'number' && Number.isFinite(row.daily_hours))
  if (!studyRows.length) return <div className="text-sm text-gray-500 p-3">Henüz çalışma kaydı yok. Çalışmalar eklendikçe süre trendi burada görünecek.</div>
  if (studyRows.length === 1) return <p className="text-sm text-slate-600">Son çalışma: {formatNumber(studyRows[0].daily_hours)} saat. İkinci kayıttan sonra trend burada görünecek.</p>

  const chartData = studyRows.map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '',
    'Günlük Saat': d.daily_hours ?? null,
  }))

  return (
    <div role="img" aria-label={`Çalışma süresi: ${chartData.map(row => `${row.date}: ${formatNumber(row['Günlük Saat'])} saat`).join('; ')}`} style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={value => formatNumber(Number(value), 1)} />
          <Tooltip formatter={value => formatNumber(Number(value))} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
          <Legend />
          <Line type="monotone" dataKey="Günlük Saat" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
