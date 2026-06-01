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
  const { meetings, loading, scheduleMeeting, updateMeetingStatus, reload } = useMeetings(user?.role || 'student', user?.id)
  
  const [students, setStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  
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
      setLoadingStudents(true)
      getStudentsByTeacher(user.id)
        .then(s => setStudents(s || []))
        .catch(err => {
          console.error('Öğrenciler yüklenirken hata:', err)
          setStudents([])
        })
        .finally(() => setLoadingStudents(false))
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
      // Formu temizle
      setTitle('')
      setDescription('')
      setUrl('')
      setDate('')
      setTime('')
      setStudentId('')
      // Listeyi yenile
      await reload()
    } catch (err: any) {
      showError('Hata oluştu: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const now = new Date()
  // Sadece gelecek tarihli ve 'scheduled' olan görüşmeler
  const upcomingMeetings = meetings
    .filter(m => m.status === 'scheduled' && m.scheduled_at && new Date(m.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  // Geçmiş tarihli veya tamamlanan/iptal edilen görüşmeler
  const pastMeetings = meetings.filter(
    m => m.status !== 'scheduled' || (m.scheduled_at && new Date(m.scheduled_at) < now)
  ).sort((a, b) => new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime())

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
                    disabled={loadingStudents}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingStudents ? (
                      <option value="" disabled>Yükleniyor...</option>
                    ) : students.length === 0 ? (
                      <option value="" disabled>Henüz kayıtlı öğrenciniz bulunmuyor</option>
                    ) : (
                      <>
                        <option value="">Seçiniz...</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.username}</option>
                        ))}
                      </>
                    )}
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
              <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">Yaklaşan görüşme bulunmuyor.</p>
                {isTeacher && <p className="text-gray-400 text-xs">Sol taraftaki formu kullanarak görüşme planlayabilirsiniz.</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map(m => {
                  const meetingDate = m.scheduled_at ? new Date(m.scheduled_at) : null
                  const diffMs = meetingDate ? meetingDate.getTime() - Date.now() : null
                  const diffHours = diffMs ? Math.floor(diffMs / 3_600_000) : null
                  const isUrgent = diffHours !== null && diffHours <= 24

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border shadow-sm bg-white transition-all hover:shadow-md ${
                        isUrgent ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'
                      }`}
                    >
                      {/* Üst satır: başlık + katıl butonu */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-800 truncate">{m.title}</h4>

                          {/* Kişi rozeti */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                              {(m.profiles?.username || '?')[0].toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-600 font-medium">
                              {isTeacher
                                ? `Öğrenci: ${m.profiles?.username || 'Bilinmiyor'}`
                                : `Öğretmen: ${m.profiles?.username || 'Bilinmiyor'}`}
                            </span>
                          </div>
                        </div>

                        {/* Toplantıya Katıl — birincil CTA */}
                        {m.meeting_url ? (
                          <a
                            href={m.meeting_url.startsWith('http') ? m.meeting_url : `https://${m.meeting_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md hover:opacity-90 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Toplantıya Katıl
                          </a>
                        ) : (
                          <span className="shrink-0 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-xl text-xs font-medium">Link yok</span>
                        )}
                      </div>

                      {/* Tarih / saat chip */}
                      {meetingDate && (
                        <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          isUrgent
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {meetingDate.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}
                          {isUrgent && diffHours !== null && (
                            <span className="ml-1 bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-md text-[10px]">
                              {diffHours === 0 ? 'Az kaldı!' : `${diffHours} saat kaldı`}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Açıklama */}
                      {m.description && (
                        <p className="text-sm text-gray-500 mt-2 pl-1 border-l-2 border-gray-200">{m.description}</p>
                      )}

                      {/* Öğretmen aksiyonları */}
                      {isTeacher && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => updateMeetingStatus(m.id, 'completed')}
                            className="flex-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-semibold transition-colors border border-green-200"
                          >
                            ✓ Tamamlandı
                          </button>
                          <button
                            onClick={() => updateMeetingStatus(m.id, 'cancelled')}
                            className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold transition-colors border border-red-200"
                          >
                            ✕ İptal Et
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {pastMeetings.length > 0 && (
            <Card>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                Geçmiş Görüşmeler
              </h3>
              <div className="space-y-3 opacity-90">
                {pastMeetings.map(m => (
                  <div key={m.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex flex-col gap-2 transition-all hover:bg-gray-100/50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-700">{m.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {m.scheduled_at && new Date(m.scheduled_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-600 font-medium">
                            {isTeacher ? `Öğrenci: ${m.profiles?.username || 'Bilinmiyor'}` : `Öğretmen: ${m.profiles?.username || 'Bilinmiyor'}`}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${m.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {m.status === 'completed' ? 'Tamamlandı' : 'İptal Edildi'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Görüşme Notu / Ödev ve Değerlendirmeler */}
                    {m.description && (
                      <div className="mt-2 text-sm bg-white p-3 rounded-lg border border-gray-200/60 shadow-inner">
                        <div className="text-[10px] uppercase font-bold text-indigo-500 mb-1 tracking-wider">Değerlendirme Notu & Hedefler</div>
                        <p className="text-gray-600 leading-relaxed font-medium">{m.description}</p>
                      </div>
                    )}
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
