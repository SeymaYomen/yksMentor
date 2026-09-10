import React from 'react'

export default function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`ui-card min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgb(15,23,42,0.03)] transition-shadow hover:shadow-[0_4px_14px_rgb(15,23,42,0.05)] ${className}`}>
      {children}
    </div>
  )
}
