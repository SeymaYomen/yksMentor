import React from 'react'
import type { StudentStatusResult } from '../../lib/studentStatus'

const styles: Record<StudentStatusResult['level'], string> = {
  neutral: 'border-gray-200 bg-gray-50 text-gray-600',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  yellow: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
}

const dots: Record<StudentStatusResult['level'], string> = {
  neutral: 'bg-gray-400',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export default function StudentStatusBadge({ status }: { status: StudentStatusResult }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status.level]}`}>
      <span className={`h-2 w-2 rounded-full ${dots[status.level]}`} aria-hidden="true" />
      {status.label}
    </span>
  )
}
