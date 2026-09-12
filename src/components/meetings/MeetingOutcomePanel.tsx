import React, { useEffect, useState } from 'react'
import type { MeetingActionItem } from '../../lib/meetingBriefing'
import type { Meeting } from '../../hooks/useMeetings'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { showError, showSuccess } from '../ui/ToastButton'

type Props = {
  meeting: Meeting
  items: MeetingActionItem[]
  isTeacher: boolean
  loading?: boolean
  onSaveSummary: (meetingId: string, summary: string) => Promise<void>
  onCreateItem: (input: { meetingId: string; text: string; kind: MeetingActionItem['kind']; dueDate?: string | null }) => Promise<void>
  onUpdateItemStatus: (itemId: string, status: MeetingActionItem['status']) => Promise<void>
}

const itemStatusLabel: Record<MeetingActionItem['status'], string> = {
  open: 'Açık',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}

export default function MeetingOutcomePanel({ meeting, items, isTeacher, loading, onSaveSummary, onCreateItem, onUpdateItemStatus }: Props) {
  const [summary, setSummary] = useState(meeting.private_note ?? '')
  const [itemText, setItemText] = useState('')
  const [kind, setKind] = useState<MeetingActionItem['kind']>('action')
  const [dueDate, setDueDate] = useState('')
  const [savingSummary, setSavingSummary] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)

  useEffect(() => setSummary(meeting.private_note ?? ''), [meeting.id, meeting.private_note])

  async function saveSummary() {
    setSavingSummary(true)
    try {
      await onSaveSummary(meeting.id, summary)
      showSuccess('Görüşme özeti kaydedildi.')
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error))
    } finally {
      setSavingSummary(false)
    }
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault()
    if (!itemText.trim()) {
      showError('Karar veya takip maddesi boş bırakılamaz.')
      return
    }

    setAddingItem(true)
    try {
      await onCreateItem({ meetingId: meeting.id, text: itemText, kind, dueDate: dueDate || null })
      setItemText('')
      setDueDate('')
      showSuccess(kind === 'action' ? 'Karar eklendi.' : 'Kontrol maddesi eklendi.')
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error))
    } finally {
      setAddingItem(false)
    }
  }

  async function updateStatus(itemId: string, status: MeetingActionItem['status']) {
    setUpdatingItemId(itemId)
    try {
      await onUpdateItemStatus(itemId, status)
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error))
    } finally {
      setUpdatingItemId(null)
    }
  }

  return (
    <section className="mt-3 rounded-xl border border-indigo-100 bg-white p-4" aria-label="Görüşme sonucu">
      <h5 className="font-bold text-gray-800">Görüşme Sonucu</h5>

      {isTeacher && (
        <div className="mt-3">
          <label htmlFor={`meeting-summary-${meeting.id}`} className="text-xs font-bold uppercase tracking-wider text-gray-500">Özel değerlendirme — yalnız öğretmen görebilir</label>
          <textarea id={`meeting-summary-${meeting.id}`}
            value={summary}
            onChange={event => setSummary(event.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="Görüşmede öne çıkan değerlendirmeleri kısaca yazın."
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <Button type="button" loading={savingSummary} onClick={() => void saveSummary()} className="mt-2 !px-4 !py-2 text-sm">
            Özeti Kaydet
          </Button>
        </div>
      )}

      <div className="mt-5">
        <h6 className="text-xs font-bold uppercase tracking-wider text-gray-500">Kararlar ve kontrol maddeleri</h6>
        {loading ? (
          <p className="mt-2 text-sm text-indigo-500">Takip maddeleri yükleniyor...</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Henüz yapılandırılmış karar veya takip maddesi yok.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map(item => {
              const today = new Date()
              const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              const isOverdue = item.status === 'open' && !!item.due_date && item.due_date.slice(0, 10) < todayKey

              return (
                <li key={item.id} className={`rounded-lg border p-3 ${isOverdue ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.kind === 'action' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                        {item.kind === 'action' ? 'Karar' : 'Sonraki görüşmede kontrol'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === 'open' ? 'bg-amber-100 text-amber-700' : item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {itemStatusLabel[item.status]}
                      </span>
                      {isOverdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Süresi geçti</span>}
                    </div>
                    <p className={`mt-1.5 text-sm ${item.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.item_text}</p>
                    {item.due_date && <p className="mt-1 text-xs text-gray-500">Son tarih: {new Date(`${item.due_date}T00:00:00`).toLocaleDateString('tr-TR')}</p>}
                  </div>
                  {isTeacher && (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {item.status !== 'completed' && (
                        <button type="button" disabled={updatingItemId === item.id} onClick={() => void updateStatus(item.id, 'completed')} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                          Tamamla
                        </button>
                      )}
                      {item.status !== 'open' && (
                        <button type="button" disabled={updatingItemId === item.id} onClick={() => void updateStatus(item.id, 'open')} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                          Yeniden aç
                        </button>
                      )}
                      {item.status !== 'cancelled' && (
                        <button type="button" disabled={updatingItemId === item.id} onClick={() => void updateStatus(item.id, 'cancelled')} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                          İptal
                        </button>
                      )}
                    </div>
                  )}
                </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {isTeacher && (
        <form onSubmit={addItem} className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <select aria-label="Madde türü" value={kind} onChange={event => setKind(event.target.value as MeetingActionItem['kind'])} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-indigo-400">
              <option value="action">Alınan karar / aksiyon</option>
              <option value="followup">Sonraki görüşmede kontrol</option>
            </select>
            <Input aria-label="İsteğe bağlı son tarih" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
          </div>
          <textarea
            aria-label="Karar veya takip maddesi"
            value={itemText}
            onChange={event => setItemText(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={kind === 'action' ? 'Örn: Her gün 30 problem sorusu çözülecek.' : 'Örn: Günlük çalışma düzeni oluştu mu?'}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-indigo-400"
          />
          <Button type="submit" loading={addingItem} className="mt-2 !px-4 !py-2 text-sm">Madde Ekle</Button>
        </form>
      )}
    </section>
  )
}
