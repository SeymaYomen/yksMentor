import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import Spinner from '../ui/Spinner'
import usePerformance from '../../hooks/usePerformance'

export default function StudentPerformanceChart({ studentId }: { studentId: string }) {
  const { data, loading, error } = usePerformance(studentId)

  if (!studentId) return <div className="text-sm text-gray-500">Lütfen giriş yapın.</div>
  if (loading) return <div className="flex items-center justify-center py-8"><Spinner /></div>
  if (error) return <div className="text-sm text-red-500">Veri alınırken hata oluştu: {error.message || String(error)}</div>
  if (!data || data.length === 0) return <div className="text-sm text-gray-500 p-4 text-center">Henüz performans verisi yok. Üstteki formdan ilk verinizi girin!</div>

  const chartData = data.map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '',
    'Günlük Saat': d.daily_hours ?? null,
    'TYT Net': d.tyt_net ?? null,
    'AYT Net': d.ayt_net ?? null,
  }))

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
          <Legend />
          <Line type="monotone" dataKey="Günlük Saat" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          <Line type="monotone" dataKey="TYT Net" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          <Line type="monotone" dataKey="AYT Net" stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
