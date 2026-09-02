import React, { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import TaskList from '../../components/student/TaskList'
import PerformanceForm from '../../components/student/PerformanceForm'
import StudentPerformanceChart from '../../components/student/StudentPerformanceChart'
import GoalProgressCard from '../../components/goals/GoalProgressCard'
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* 1. Üst Karşılama Kahramanı */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 md:p-8 text-white shadow-xl">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 hidden md:block">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="currentColor">
            <polygon points="0,100 100,0 100,100" />
          </svg>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              🚀 YKS Hedefine Hazırlanıyor
            </span>
            <h2 className="text-3xl font-black tracking-tight">
              Selam, {user?.username || 'Geleceğin Üniversitelisi'} 👋
            </h2>
            <p className="text-blue-100/90 text-sm max-w-xl">
              "Başarı, her gün tekrarlanan küçük çabaların toplamıdır." Bugün hedeflerini tamamlamaya ve hayaline bir adım daha yaklaşmaya hazır mısın?
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 shrink-0 items-end md:items-center">
            {mentorName ? (
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">👨‍🏫</div>
                <div>
                  <div className="text-[10px] text-blue-200/90 font-bold uppercase tracking-wider">Rehber Mentorun</div>
                  <div className="font-bold text-sm">{mentorName}</div>
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
            <h3 className="text-xl font-bold text-gray-800 mb-2">Öğretmen Bulundu 🎉</h3>
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

      {/* 2. Grid Yapısı */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SOL BLOK: Sıradaki Görüşme & İstatistikler */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Sıradaki Görüşme Kartı */}
          <Card className="border-t-4 border-t-indigo-500 overflow-hidden relative">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              Sıradaki Mentor Görüşmen
            </h3>

            {nextMeeting ? (
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/30 border border-indigo-100/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-3">
                  <div className="font-bold text-indigo-900 text-lg">{nextMeeting.title}</div>
                  
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 shadow-sm">
                      📅 {nextMeeting.scheduled_at ? new Date(nextMeeting.scheduled_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 shadow-sm">
                      ⏰ {nextMeeting.scheduled_at ? new Date(nextMeeting.scheduled_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
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
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all"
                  >
                    🚀 Toplantıya Katıl
                  </a>
                ) : (
                  <span className="px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-xs font-medium self-start md:self-auto">Görüşme linki henüz eklenmemiş</span>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200">
                <p className="text-gray-500 font-medium text-sm">📅 Planlanmış yaklaşan bir görüşmeniz bulunmuyor.</p>
                <p className="text-gray-400 text-xs mt-1">Öğretmeniniz görüşme planladığında burada görünecektir.</p>
              </div>
            )}
          </Card>

          {/* Hızlı Net/Çalışma Giriş Formu */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                ✍️ Günlük Çalışma & Net Bildirimi
              </h3>
              <p className="text-xs text-gray-400">Çalıştığın süreyi ve deneme netlerini gir, rehber öğretmenin anlık görsün.</p>
            </div>
            {studentId ? <PerformanceForm studentId={studentId} /> : <div className="text-sm text-gray-400">Giriş yapınız.</div>}
          </Card>

          {/* Gelişim Grafiği */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              📈 TYT - AYT & Çalışma Saati Trendi
            </h3>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <StudentPerformanceChart studentId={studentId} />
            </div>
          </Card>

        </div>

        {/* SAĞ BLOK: Görev Listesi & Hedefler */}
        <div className="lg:col-span-4 space-y-6">
          
          <GoalProgressCard
            studentId={studentId}
            progress={goalProgress}
            loading={goalLoading}
            error={goalError}
          />

          {/* Görev Listesi Kartı */}
          <Card className="p-6">
            <TaskList studentId={studentId} />
          </Card>

        </div>

      </div>
    </div>
  )
}
