import { CalendarDaysIcon, ClockIcon, UserCircleIcon, ArrowTopRightOnSquareIcon, ChartBarIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import React, { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import TaskList from '../../components/student/TaskList'
import PerformanceForm from '../../components/student/PerformanceForm'
import StudentPerformanceChart from '../../components/student/StudentPerformanceChart'
import MockExamSummary from '../../components/student/MockExamSummary'
import GoalProgressCard from '../../components/goals/GoalProgressCard'
import TopicCompetencyMap from '../../components/student/TopicCompetencyMap'
import { useAuth } from '../../hooks/useAuth'
import { useGoalProgress } from '../../hooks/useGoalProgress'
import { useMeetings, Meeting } from '../../hooks/useMeetings'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function StudentDashboard() {
  const { user, joinTeacher, getTeacherInfoByCode } = useAuth()
  const studentId = user?.id || ''
  const { progress: goalProgress, loading: goalLoading, error: goalError } = useGoalProgress(studentId)
  const [mentorName, setMentorName] = useState<string | null>(null)
  
  // Görüşmeleri yükle
  const { meetings } = useMeetings('student', studentId)
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null)
  
  // Katılım Kodu State'leri
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [foundTeacher, setFoundTeacher] = useState<any>(null)
  useEffect(() => {
    if (user?.mentor_id && isSupabaseConfigured && supabase) {
      supabase.from('profiles').select('username').eq('id', user.mentor_id).single()
        .then(({ data }) => {
          if (data) setMentorName(data.username)
        })
    }
  }, [user])

  // Gelecek tarihli en yakın görüşmeyi bul
  useEffect(() => {
    if (meetings && meetings.length > 0) {
      const now = new Date()
      const future = meetings
        .filter(m => m.status === 'scheduled' && m.scheduled_at && new Date(m.scheduled_at) >= now)
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      
      if (future.length > 0) {
        setNextMeeting(future[0])
      } else {
        setNextMeeting(null)
      }
    } else {
      setNextMeeting(null)
    }
  }, [meetings])

  return (
    <div className="space-y-5">
      {/* 1. Üst Karşılama Kahramanı */}
      <div className="relative overflow-hidden bg-indigo-700 rounded-2xl p-5 sm:p-6 text-white">
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ClipboardDocumentCheckIcon aria-hidden="true" className="h-4 w-4" /> Bugünün planı
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Selam, {user?.username || 'Öğrenci'}
            </h1>
            <p className="text-blue-100/90 text-sm max-w-xl">
              {nextMeeting ? `Sıradaki görüşmen: ${nextMeeting.title}. Açık görevlerini aşağıdan takip edebilirsin.` : 'Açık görevlerini aşağıdan takip et; tamamladığın çalışmaları gününe ekle.'}
            </p>
          </div>

          <div className="flex min-w-0 max-w-full flex-col md:flex-row gap-3 items-start md:items-center">
            {mentorName ? (
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-lg"><UserCircleIcon aria-hidden="true" className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <div className="text-[10px] text-blue-200/90 font-bold uppercase tracking-wider">Rehber Mentorun</div>
                  <div className="break-words font-bold text-sm">{mentorName}</div>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex flex-col gap-2">
                <div className="text-[10px] text-blue-200/90 font-bold uppercase tracking-wider">Henüz Mentorun Yok</div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Katılım Kodu..." 
                    className="px-3 py-1.5 rounded-lg bg-white/20 border border-white/30 text-white placeholder-blue-200/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 w-32"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                  <button 
                    disabled={joinLoading || !joinCode}
                    onClick={async () => {
                      setJoinLoading(true);
                      const res = await getTeacherInfoByCode(joinCode);
                      setJoinLoading(false);
                      if (res.data) {
                        setFoundTeacher(res.data);
                      } else {
                        alert("Hata: Bu koda ait bir öğretmen bulunamadı.");
                      }
                    }}
                    className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    {joinLoading ? '...' : 'Ara'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onay Modalı */}
      {foundTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Öğretmen Bulundu</h3>
            <p className="text-gray-600 text-sm mb-4">
              <span className="font-semibold text-indigo-600">{foundTeacher.username}</span> adlı öğretmenin sınıfına katılmak üzeresiniz. Bu işlemi onaylıyor musunuz?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setFoundTeacher(null)}
                className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 text-sm font-medium transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={async () => {
                  setJoinLoading(true)
                  const res = await joinTeacher(joinCode)
                  setJoinLoading(false)
                  if (res.success) {
                    setFoundTeacher(null)
                    alert("Başarıyla bağlandın! Sayfayı yeniliyoruz...")
                    window.location.reload()
                  } else {
                    alert("Bir hata oluştu.")
                  }
                }}
                disabled={joinLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Evet, Katıl
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card><TaskList studentId={studentId} /></Card>
          <Card className="border-t-4 border-t-indigo-500 overflow-hidden relative">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 "></span>
              Sıradaki Mentor Görüşmen
            </h3>

            {nextMeeting ? (
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/30 border border-indigo-100/60 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="space-y-3">
                  <div className="font-bold text-indigo-900 text-lg">{nextMeeting.title}</div>
                  
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 shadow-sm">
                      <CalendarDaysIcon aria-hidden="true" className="inline h-4 w-4 shrink-0" /> {nextMeeting.scheduled_at ? new Date(nextMeeting.scheduled_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 shadow-sm">
                      <ClockIcon aria-hidden="true" className="h-4 w-4 shrink-0" /> {nextMeeting.scheduled_at ? new Date(nextMeeting.scheduled_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  {nextMeeting.description && (
                    <p className="text-sm text-gray-500 italic">" {nextMeeting.description} "</p>
                  )}
                </div>

                {nextMeeting.meeting_url ? (
                  <a
                    href={nextMeeting.meeting_url.startsWith('http') ? nextMeeting.meeting_url : `https://${nextMeeting.meeting_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all"
                  >
                    <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-4 w-4" /> Toplantıya Katıl
                  </a>
                ) : (
                  <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium self-start md:self-auto">Görüşme linki henüz eklenmemiş</span>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-200">
                <p className="text-gray-500 font-medium text-sm"><CalendarDaysIcon aria-hidden="true" className="inline h-4 w-4 shrink-0" /> Planlanmış yaklaşan bir görüşmeniz bulunmuyor.</p>
                <p className="text-gray-500 text-xs mt-1">Öğretmeniniz görüşme planladığında burada görünecektir.</p>
              </div>
            )}
          </Card>
        <MockExamSummary studentId={studentId} />
        <GoalProgressCard studentId={studentId} progress={goalProgress} loading={goalLoading} error={goalError} />
          {/* Günlük çalışma kayıtları */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                Çalışma Kaydı
              </h3>
              <p className="text-xs text-gray-500">Çalıştığın ders ve konuyu ekle; günlük süren otomatik hesaplansın.</p>
            </div>
            {studentId ? <PerformanceForm studentId={studentId} /> : <div className="text-sm text-gray-400">Giriş yapınız.</div>}
          </Card>          {/* Gelişim Grafiği */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ChartBarIcon aria-hidden="true" className="h-5 w-5" /> Çalışma Saati Trendi
            </h3>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <StudentPerformanceChart studentId={studentId} />
            </div>
          </Card>
        <div className="min-w-0 xl:col-span-2"><TopicCompetencyMap studentId={studentId} /></div>
      </div>
    </div>
  )
}
