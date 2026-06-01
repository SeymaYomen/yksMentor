import React from 'react'
import Card from '../../components/ui/Card'
import TaskList from '../../components/student/TaskList'
import PerformanceForm from '../../components/student/PerformanceForm'
import StudentPerformanceChart from '../../components/student/StudentPerformanceChart'
import { useAuth } from '../../hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function StudentDashboard() {
  const { user } = useAuth()
  const studentId = user?.id || ''
  const [mentorName, setMentorName] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (user?.mentor_id && isSupabaseConfigured && supabase) {
      supabase.from('profiles').select('username').eq('id', user.mentor_id).single()
        .then(({ data }) => {
          if (data) setMentorName(data.username)
        })
    }
  }, [user])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Merhaba, <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">{user?.username || 'Öğrenci'}</span> 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">Günün hedeflerini tamamla, netlerini takip et ve sınava hazırlan!</p>
        </div>
        {mentorName && (
          <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
            <span className="text-2xl">👨‍🏫</span>
            <div>
              <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Danışman Öğretmen</div>
              <div className="text-lg font-bold text-blue-900">{mentorName}</div>
            </div>
          </div>
        )}
      </div>

      {!isSupabaseConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Supabase yapılandırılmadığı için veriler yüklenemiyor. <span className="font-semibold underline">.env</span> dosyasına gerekli anahtarları ekleyin.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sol Kolon: Görevler */}
        <div className="lg:col-span-4">
          <Card className="h-full p-6">
            <TaskList studentId={studentId} />
          </Card>
        </div>

        {/* Sağ Kolon: Performans ve Grafik */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                Bugün Neler Yaptın?
              </h3>
              <p className="text-sm text-gray-500">Çalışma süreni ve çözdüğün deneme netlerini buraya girerek gelişimini grafiğe yansıt.</p>
            </div>
            
            {studentId ? <PerformanceForm studentId={studentId} /> : <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">Lütfen giriş yapın.</div>}
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Gelişim Grafiği
              </h3>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <StudentPerformanceChart studentId={studentId} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
