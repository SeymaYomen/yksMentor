import React from 'react'
import { AcademicCapIcon } from '@heroicons/react/24/outline'
export default function EmptyState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
    <AcademicCapIcon aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-indigo-500" />
    <p className="font-semibold text-slate-800">{title}</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>{children}
  </div>
}
