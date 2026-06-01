import React from 'react'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Sayfa bulunamadı</h2>
        <p className="text-sm text-gray-500">Aradığınız sayfa mevcut değil.</p>
      </div>
    </div>
  )
}
