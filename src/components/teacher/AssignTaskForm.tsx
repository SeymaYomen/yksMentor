import React, { useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { useTasks } from '../../hooks/useTasks'
import { showSuccess, showError } from '../ui/ToastButton'

type Student = {
  id: string
  username: string
}

type Props = {
  students: Student[]
  selectedStudent: string | null
}

export default function AssignTaskForm({ students, selectedStudent }: Props) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const { createTask } = useTasks()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudent) {
      showError('Lütfen listeden bir öğrenci seçin')
      return
    }
    if (!title.trim()) {
      showError('Görev başlığı boş bırakılamaz')
      return
    }

    setLoading(true)
    try {
      await createTask(selectedStudent, title, dueDate || undefined)
      setTitle('')
      setDueDate('')
      showSuccess('Görev başarıyla atandı')
    } catch (err: any) {
      showError('Hata: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const selectedName = students.find(s => s.id === selectedStudent)?.username

  return (
    <Card className="border-t-4 border-t-purple-500">
      <div className="mb-4">
        <h3 className="font-semibold text-lg text-gray-800">Yeni Görev Ata</h3>
        <p className="text-sm text-gray-500">
          {selectedName ? (
            <span>Seçili Öğrenci: <span className="font-semibold text-purple-600">{selectedName}</span></span>
          ) : (
            'Listeden bir öğrenci seçin'
          )}
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Görev Başlığı / Açıklaması</label>
          <Input 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="Örn: TYT Matematik ilk 3 konu denemesi çözülecek" 
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Son Tarih <span className="text-gray-400 font-normal">(isteğe bağlı)</span></label>
          <Input 
            type="date" 
            value={dueDate} 
            onChange={e => setDueDate(e.target.value)} 
          />
        </div>
        <div className="pt-2">
          <Button type="submit" loading={loading} disabled={!selectedStudent} className="w-full !from-purple-600 !to-pink-600 hover:!from-purple-500 hover:!to-pink-500">
            Görevi Gönder
          </Button>
        </div>
      </form>
    </Card>
  )
}
