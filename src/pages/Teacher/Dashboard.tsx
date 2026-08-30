import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getStudentsByTeacher } from '../../hooks/useTasks'
import StudentList from '../../components/teacher/StudentList'
import AssignTaskForm from '../../components/teacher/AssignTaskForm'
import StudentPerformanceChart from '../../components/student/StudentPerformanceChart'
import TaskList from '../../components/student/TaskList'
import Card from '../../components/ui/Card'

export default function TeacherDashboard() {
  const { user, refreshJoinCode } = useAuth()
  const teacherId = user?.id
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isRefreshingCode, setIsRefreshingCode] = useState(false)

  useEffect(() => {
    if (!teacherId) return
    ;(async () => {
      try {
        const s = await getStudentsByTeacher(teacherId)
        setStudents(s || [])
        if (s && s.length > 0) setSelectedStudent(s[0].id)
      } catch (err) {
        console.error(err)
      }
    })()
  }, [teacherId])

  const selectedStudentData = students.find(s => s.id === selectedStudent)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Öğretmen Paneli</h2>
          <p className="text-gray-500 text-sm mt-1">Hoş geldiniz, {user?.username}. Tüm öğrencilerinizi buradan takip edebilirsiniz.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Katılım Kodu */}
          {user?.join_code && (
            <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
              <div>
                <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Katılım Kodunuz</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-mono font-bold text-indigo-900 tracking-widest">{user.join_code}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(user.join_code || '')
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="text-indigo-400 hover:text-indigo-700 transition-colors"
                    title="Kopyala"
                  >
                    {copied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isRefreshingCode}
                    onClick={async () => {
                      if (window.confirm('Mevcut kodunuz iptal edilecek ve yeni bir kod üretilecektir. Onaylıyor musunuz?')) {
                        setIsRefreshingCode(true)
                        const res = await refreshJoinCode()
                        setIsRefreshingCode(false)
                        if (res.error) alert('Kod yenilenemedi.')
                      }
                    }}
                    className="text-indigo-400 hover:text-indigo-700 transition-colors ml-1 disabled:opacity-50"
                    title="Kodu Yenile / Değiştir"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isRefreshingCode ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 bg-purple-50 px-4 py-2 rounded-xl border border-purple-100">
            <span className="text-2xl">👨‍🏫</span>
            <div>
              <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Öğrenci Sayısı</div>
              <div className="text-xl font-bold text-purple-900">{students.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Kolon: Öğrenci Listesi */}
        <div className="lg:col-span-1 space-y-6">
          <StudentList 
            students={students} 
            selectedStudent={selectedStudent} 
            onSelectStudent={setSelectedStudent} 
          />
          <AssignTaskForm 
            students={students} 
            selectedStudent={selectedStudent} 
          />
        </div>

        {/* Sağ Kolon: Öğrenci Detayları */}
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6">
              <Card className="border-t-4 border-t-indigo-500">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-inner">
                    {selectedStudentData?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{selectedStudentData?.username}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Aktif Öğrenci
                      </span>
                      <span className="text-xs text-gray-400 self-center">ID: {selectedStudent?.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Performans Grafiği
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">Son günlerdeki çalışma saatleri ve net gelişimleri.</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border">
                  <StudentPerformanceChart studentId={selectedStudent} />
                </div>

                <div className="mt-8 mb-2">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Görev Listesi
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">Öğrenciye atadığınız görevler ve durumları.</p>
                </div>

                <div className="bg-gray-50 rounded-xl border overflow-hidden">
                  <TaskList studentId={selectedStudent} isTeacherView={true} />
                </div>
              </Card>
            </div>
          ) : (
            <Card className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white/40 border-dashed border-2">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Öğrenci Seçilmedi</h3>
              <p className="text-gray-500 max-w-sm">
                Öğrencinin detaylarını, net grafiklerini ve çalışma saatlerini görmek için sol taraftaki listeden bir öğrenci seçin.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
