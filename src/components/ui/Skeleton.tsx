import React, { useEffect, useState } from 'react'
export default function Skeleton({ rows = 3 }: { rows?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setVisible(true), 250); return () => window.clearTimeout(timer) }, [])
  return <div role="status" aria-label="Yükleniyor" className="min-h-24 space-y-3 py-4" aria-busy="true">
    {visible && Array.from({ length: rows }, (_, i) => <div key={i} aria-hidden="true" className={`h-10 animate-pulse rounded-xl bg-slate-100 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`} />)}
  </div>
}
