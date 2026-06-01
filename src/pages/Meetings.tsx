import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useMeetings } from '../hooks/useMeetings'
import { getStudentsByTeacher } from '../hooks/useTasks'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { showSuccess, showError } from '../components/ui/ToastButton'
import Spinner from '../components/ui/Spinner'

export default function Meetings() {
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const { meetings, loading, scheduleMeeting, updateMeetingStatus } = useMeetings(user?.role || 'student', user?.id)
  
  const [students, setStudents] = useState<any[]>([])
  
  // Form states for Teacher
  const [studentId, setStudentId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isTeacher && user?.id) {
      getStudentsByTeacher(user.id).then(s => setStudents(s || []))
    }
  }, [isTeacher, user?.id])

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId || !title || !date || !time) {
      showError('Lütfen gerekli alanları doldurun.')
      return
    }

    const scheduled_at = new Date(`${date}T${time}`).toISOString()

    try {
      setSubmitting(true)
      await scheduleMeeting({
        teacher_id: user!.id,
        student_id: studentId,
        title,
        description,
        meeting_url: url,
        scheduled_at,
        status: 'scheduled'
      })
      showSuccess('Görüşme planlandı!')
      setTitle('')
      setDescription('')
      setUrl('')
      setDate('')
      setTime('')
      setStudentId('')
    } catch (err: any) {
      showError('Hata oluştu: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled')
  const pastMeetings = meetings.filter(m => m.status !== 'scheduled')

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Görüşmeler</h2>
          <p className="text-gray-500 text-sm mt-1">Birebir değerlendirme görüşmelerini planla ve takip et.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {isTeacher && (
          <div className="lg:col-span-4">
            <Card className="border-t-4 border-t-blue-500">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Yeni Görüşme Planla</h3>
              <form onSubmit={handleSchedule} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Öğrenci Seç</label>
                  <select 
                    value={studentId} 
                    onChange={e => setStudentId(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all text-gray-700"
                  >
                    <option value="">Seçiniz...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.username}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Konu / Başlık</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn: Haftalık Değerlendirme" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tarih</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Saat</label>
                  <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Toplantı Linki <span className="text-xs text-gray-400 font-normal">(İsteğe bağlı)</span></label>
                  <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Zoom, Meet vb." />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Açıklama <span className="text-xs text-gray-400 font-normal">(İsteğe bağlı)</span></label>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all text-gray-700"
                    rows={2}
                  />
                </div>

                <Button type="submit" loading={submitting} className="w-full !from-blue-600 !to-cyan-600">Planla</Button>
              </form>
            </Card>
          </div>
        )}

        <div className={`lg:col-span-${isTeacher ? '8' : '12'} space-y-6`}>
          <Card>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Yaklaşan Görüşmeler
            </h3>
            
            {loading ? (
              <div className="flex justify-center p-8"><Spinner /></div>
            ) : upcomingMeetings.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">Planlanmış yaklaşan görüşme yok.</div>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map(m => (
                  <div key={m.id} className="p-4 border border-gray-100 rounded-xl shadow-sm bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-800">{m.title}</h4>
                      <p className="text-sm text-gray-500">
                        {isTeacher ? `Öğrenci: ${m.profiles?.username || 'Bilinmiyor'}` : `Öğretmen: ${m.profiles?.username || 'Bilinmiyor'}`}
                      </p>
                      {m.scheduled_at && (
                        <div className="flex items-center gap-2 mt-2 text-sm font-medium text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-md">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(m.scheduled_at).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}
                        </div>
                      )}
                      {m.description && <p className="text-sm mt-2 text-gray-600">{m.description}</p>}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      {m.meeting_url && (
                        <a href={m.meeting_url.startsWith('http') ? m.meeting_url : `https://${m.meeting_url}`} target="_blank" rel="noreferrer" className="w-full text-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors">
                          Katıl
                        </a>
                      )}
                      {isTeacher && (
                        <>
                          <button onClick={() => updateMeetingStatus(m.id, 'completed')} className="w-full px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors">Tamamlandı</button>
                          <button onClick={() => updateMeetingStatus(m.id, 'cancelled')} className="w-full px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors">İptal Et</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {pastMeetings.length > 0 && (
            <Card>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                Geçmiş Görüşmeler
              </h3>
              <div className="space-y-3 opacity-75">
                {pastMeetings.map(m => (
                  <div key={m.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-700">{m.title}</h4>
                      <p className="text-xs text-gray-500">
                        {m.scheduled_at && new Date(m.scheduled_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${m.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {m.status === 'completed' ? 'Tamamlandı' : 'İptal Edildi'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  )
}
