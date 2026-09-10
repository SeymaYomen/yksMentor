import React from 'react'
const styles = {
  neutral: 'bg-slate-100 text-slate-600', success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200', danger: 'bg-red-50 text-red-700 border border-red-200',
  tyt: 'bg-indigo-50 text-indigo-700', ayt: 'bg-violet-50 text-violet-700',
}
export default function Badge({ tone = 'neutral', children }: { tone?: keyof typeof styles; children: React.ReactNode }) {
  return <span className={`inline-flex max-w-full items-center rounded-lg px-2 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>
}
