import React, { useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { useTasks } from '../../hooks/useTasks'
import { showSuccess, showError } from '../ui/ToastButton'
import { useAcademicCatalog } from '../../hooks/useAcademicCatalog'
import type { ExamType } from '../../lib/competencyMap'

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
  const [examType, setExamType] = useState<ExamType | ''>('')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const { createTask } = useTasks()
  const { subjects, topics, loading: catalogLoading, error: catalogError } = useAcademicCatalog()

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
      await createTask(selectedStudent, title, dueDate || undefined, {
        examType: examType || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
      })
      setTitle('')
      setDueDate('')
      setExamType('')
      setSubjectId('')
      setTopicId('')
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
          <label htmlFor="assigntaskform-field-1" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Görev Başlığı / Açıklaması</label>
          <Input id="assigntaskform-field-1"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Örn: TYT Matematik ilk 3 konu denemesi çözülecek"
          />
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3">
          <div className="mb-2 text-sm font-semibold text-gray-700">Akademik bağlantı <span className="font-normal text-gray-400">(isteğe bağlı)</span></div>
          {catalogError ? <p className="text-xs text-red-600">Ders ve konu kataloğu yüklenemedi.</p> : (
            <div className="grid gap-2">
              <select aria-label="Sınav türü"
                value={examType}
                disabled={catalogLoading}
                onChange={event => {
                  setExamType(event.target.value as ExamType | '')
                  setSubjectId('')
                  setTopicId('')
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Sınav türü yok</option>
                <option value="TYT">TYT</option>
                <option value="AYT">AYT</option>
              </select>
              {examType && (
                <select aria-label="Ders"
                  value={subjectId}
                  onChange={event => { setSubjectId(event.target.value); setTopicId('') }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">Yalnız sınav türü</option>
                  {subjects.filter(subject => subject.exam_type === examType).map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              )}
              {subjectId && (
                <select aria-label="Konu" value={topicId} onChange={event => setTopicId(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                  <option value="">Yalnız ders</option>
                  {topics.filter(topic => topic.subject_id === subjectId).map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="assigntaskform-field-2" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Son Tarih <span className="text-gray-400 font-normal">(isteğe bağlı)</span></label>
          <Input id="assigntaskform-field-2"
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
