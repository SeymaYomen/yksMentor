import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { showSuccess, showError } from '../ui/ToastButton'

export default function PerformanceForm({ studentId }: { studentId: string }) {
  const [dailyHours, setDailyHours] = useState('')
  const [tytNet, setTytNet] = useState('')
  const [aytNet, setAytNet] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!supabase) {
      showError('Supabase yapılandırılmamış.')
      return
    }
    
    const dHours = Number(dailyHours)
    const tNet = Number(tytNet)
    const aNet = Number(aytNet)

    if (isNaN(dHours) || isNaN(tNet) || isNaN(aNet)) {
      showError('Lütfen geçerli sayılar girin.')
      return
    }
    if (tNet < 0 || tNet > 120) {
      showError('TYT neti 0 ile 120 arasında olmalıdır.')
      return
    }
    if (aNet < 0 || aNet > 80) {
      showError('AYT neti 0 ile 80 arasında olmalıdır.')
      return
    }
    if (dHours < 0 || dHours > 24) {
      showError('Çalışma saati 0 ile 24 arasında olmalıdır.')
      return
    }

    setLoading(true)
    const payload = {
      student_id: studentId,
      daily_hours: dHours || 0,
      tyt_net: tNet || 0,
      ayt_net: aNet || 0,
    }
    const { error } = await supabase.from('performance').insert([payload])
    setLoading(false)
    if (error) {
      showError('Kayıt sırasında hata oluştu: ' + error.message)
      return
    }
    
    // YENİ KAYIT EKLENİNCE GRAFİĞİ TETİKLEMEK İÇİN BİR OLAY (EVENT) FIRLATABİLİRİZ
    window.dispatchEvent(new Event('performance_updated'))

    setDailyHours('')
    setTytNet('')
    setAytNet('')
    showSuccess('Performans kaydı başarıyla eklendi 🎉')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            ⏱ Çalışma Saati
          </label>
          <Input 
            type="number" 
            step="0.5"
            min="0"
            max="24"
            value={dailyHours} 
            onChange={e => setDailyHours(e.target.value)} 
            placeholder="Örn: 4.5" 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            🎯 TYT Net
          </label>
          <Input 
            type="number" 
            step="0.25"
            min="0"
            max="120"
            value={tytNet} 
            onChange={e => setTytNet(e.target.value)} 
            placeholder="Maks: 120" 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            🚀 AYT Net
          </label>
          <Input 
            type="number" 
            step="0.25"
            min="0"
            max="80"
            value={aytNet} 
            onChange={e => setAytNet(e.target.value)} 
            placeholder="Maks: 80" 
          />
        </div>
      </div>
      <div className="pt-2">
        <Button type="submit" loading={loading} className="w-full !from-green-500 !to-emerald-600 hover:!from-green-400 hover:!to-emerald-500">
          Bugünkü Verileri Kaydet
        </Button>
      </div>
    </form>
  )
}
