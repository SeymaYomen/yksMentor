import MeetingTimelineHeading from '../components/meetings/MeetingTimelineHeading'
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMeetings } from '../hooks/useMeetings'
import { useMeetingGuidance } from '../hooks/useMeetingGuidance'
import { getStudentsByTeacher } from '../hooks/useTasks'
import MeetingBriefingPanel from '../components/meetings/MeetingBriefingPanel'
import MeetingOutcomePanel from '../components/meetings/MeetingOutcomePanel'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { showSuccess, showError } from '../components/ui/ToastButton'
import Spinner from '../components/ui/Spinner'

export default function Meetings() {
  const [searchParams] = useSearchParams()
  const requestedStudentId = searchParams.get('studentId')
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const { meetings, loading, error: meetingsError, scheduleMeeting, updateMeetingStatus, reload } = useMeetings(user?.role, user?.id)
  const {
    briefingsByMeeting,
    actionItemsByMeeting,
    loading: guidanceLoading,
    error: guidanceError,
    saveOutcomeSummary,
    createActionItem,
    updateActionItemStatus,
  } = useMeetingGuidance(user?.role, user?.id, meetings)

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
          console.error('Öğrenciler yüklenirken hata:')
          setStudents([])
        })
        .finally(() => setLoadingStudents(false))
    }
  }, [isTeacher, user?.id])

  useEffect(() => {
    if (requestedStudentId && students.some(student => student.id === requestedStudentId)) {
      setStudentId(requestedStudentId)
    }
  }, [requestedStudentId, students])

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
        student_id: studentId,
        title,
        description,
        meeting_url: url,
        scheduled_at,
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
          <h1 className="text-2xl font-semibold text-gray-800">Görüşmeler</h1>
          <p className="text-gray-500 text-sm mt-1">Birebir değerlendirme görüşmelerini planla ve takip et.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {isTeacher && (
          <div className="min-w-0 xl:col-span-4">
            <Card className="border-t-4 border-t-indigo-500">
              <h3 id="meeting-form-title" tabIndex={-1} className="text-lg font-bold text-gray-800 mb-4">Yeni Görüşme Planla</h3>
              <form onSubmit={handleSchedule} className="space-y-4">
                <div>
                  <label htmlFor="meetings-field-1" className="block text-sm font-semibold text-gray-700 mb-1">Öğrenci Seç</label>
                  <select id="meetings-field-1"
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
                  <label htmlFor="meetings-field-2" className="block text-sm font-semibold text-gray-700 mb-1">Konu / Başlık</label>
                  <Input id="meetings-field-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn: Haftalık Değerlendirme" />
                </div>

                <div>
                  <label htmlFor="meetings-field-3" className="block text-sm font-semibold text-gray-700 mb-1">Tarih</label>
                  <Input id="meetings-field-3" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>

                <div>
                  <label htmlFor="meetings-field-4" className="block text-sm font-semibold text-gray-700 mb-1">Saat</label>
                  <Input id="meetings-field-4" type="time" value={time} onChange={e => setTime(e.target.value)} />
                </div>

                <div>
                  <label htmlFor="meetings-field-5" className="block text-sm font-semibold text-gray-700 mb-1">Toplantı Linki <span className="text-xs text-gray-500 font-normal">(İsteğe bağlı)</span></label>
                  <Input id="meetings-field-5" value={url} onChange={e => setUrl(e.target.value)} placeholder="Zoom, Meet vb." />
                </div>

                <div>
                  <label htmlFor="meetings-field-6" className="block text-sm font-semibold text-gray-700 mb-1">Açıklama <span className="text-xs text-gray-500 font-normal">(İsteğe bağlı)</span></label>
                  <textarea id="meetings-field-6"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all text-gray-700"
                    rows={2}
                  />
                </div>

                <Button type="submit" loading={submitting} className="w-full">Planla</Button>
              </form>
            </Card>
          </div>
        )}

        <div className={`${isTeacher ? 'min-w-0 xl:col-span-8' : 'min-w-0 xl:col-span-12'} space-y-6`}>
          {meetingsError && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Görüşmeler yüklenemedi. Lütfen tekrar deneyin.
            </div>
          )}
          {guidanceError && !loading && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Görüşme brifingi ve takip maddeleri yüklenemedi. Lütfen tekrar deneyin.
            </div>
          )}
          <Card>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Yaklaşan Görüşmeler
            </h3>

            {loading ? (
              <div role="status" aria-label="Görüşmeler yükleniyor" className="flex justify-center p-4"><Spinner /></div>
            ) : meetingsError ? <Button variant="secondary" onClick={() => void reload()}>Tekrar Dene</Button> : upcomingMeetings.length === 0 ? (
              <div className="flex flex-col items-center gap-3 bg-slate-50 rounded-xl p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">Yaklaşan görüşme bulunmuyor.</p>
                {isTeacher && <a href="#meeting-form-title" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-indigo-700">Görüşme Planla</a>}
              </div>
            ) : (
              <div className="space-y-3 border-l-2 border-indigo-100 pl-3">
                {upcomingMeetings.map(m => {
                  return (
                    <article key={m.id} className="relative min-w-0 rounded-xl border border-slate-200 bg-white p-4 motion-safe:transition-shadow hover:shadow-sm">
                      <MeetingTimelineHeading title={m.title} person={m.profiles?.username} scheduledAt={m.scheduled_at} status={m.status} isTeacher={isTeacher} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.meeting_url ? <a href={m.meeting_url.startsWith('http') ? m.meeting_url : `https://${m.meeting_url}`}
                          target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Toplantıya Katıl</a>
                          : <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Bağlantı henüz eklenmedi</p>}
                      </div>

                      {/* Açıklama */}
                      {m.description && (
                        <p className="text-sm text-gray-500 mt-2 pl-1 border-l-2 border-gray-200">{m.description}</p>
                      )}

                      {isTeacher && (guidanceLoading ? <p role="status" className="mt-3 text-xs text-slate-500">Brifing hazırlanıyor…</p> : !guidanceError && briefingsByMeeting[m.id] ? (
                        <details className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
                          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-indigo-800">
                            Brifingi Aç <span className="ml-2 inline-block text-xs font-normal text-slate-600">Brifing hazır</span>
                          </summary>
                          <MeetingBriefingPanel briefing={briefingsByMeeting[m.id]} loading={guidanceLoading} error={null} />
                        </details>
                      ) : null)}

                      {/* Öğretmen aksiyonları */}
                      {isTeacher && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          <button type="button"
                            onClick={() => updateMeetingStatus(m.id, 'completed')}
                            className="min-h-11 flex-1 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors border border-emerald-200"
                          >
                            Tamamlandı
                          </button>
                          <button type="button"
                            onClick={() => updateMeetingStatus(m.id, 'cancelled')}
                            className="min-h-11 flex-1 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold transition-colors border border-red-200"
                          >
                            İptal Et
                          </button>
                        </div>
                      )}
                    </article>
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
              <div className="space-y-3 border-l-2 border-slate-200 pl-3">
                {pastMeetings.map(m => (
                  <div key={m.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex flex-col gap-2 transition-all hover:bg-gray-100/50">
                    <MeetingTimelineHeading title={m.title} person={m.profiles?.username} scheduledAt={m.scheduled_at} status={m.status} isTeacher={isTeacher} />

                    {/* Görüşme Notu / Ödev ve Değerlendirmeler */}
                    {m.description && (
                      <div className="mt-2 text-sm bg-white p-3 rounded-lg border border-gray-200/60 shadow-inner">
                        <div className="text-[10px] uppercase font-bold text-indigo-500 mb-1 tracking-wider">Görüşme Gündemi</div>
                        <p className="text-gray-600 leading-relaxed font-medium">{m.description}</p>
                      </div>
                    )}

                    {m.status === 'completed' && (
                      <MeetingOutcomePanel
                        meeting={m}
                        items={actionItemsByMeeting[m.id] ?? []}
                        isTeacher={isTeacher}
                        loading={guidanceLoading}
                        onSaveSummary={saveOutcomeSummary}
                        onCreateItem={createActionItem}
                        onUpdateItemStatus={updateActionItemStatus}
                      />
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
