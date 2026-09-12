import { UsersIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMentorStudentSummaries } from '../../hooks/useMentorStudentSummaries'
import StudentList from '../../components/teacher/StudentList'
import AssignTaskForm from '../../components/teacher/AssignTaskForm'
import MentorSummary from '../../components/teacher/MentorSummary'
import EarlyWarningCenter from '../../components/teacher/EarlyWarningCenter'
import GoalForm from '../../components/goals/GoalForm'
import StudentPerformanceChart from '../../components/student/StudentPerformanceChart'
import TaskList from '../../components/student/TaskList'
import Card from '../../components/ui/Card'

export default function TeacherDashboard() {
  const { user, refreshJoinCode } = useAuth()
  const teacherId = user?.id
  const { students, loading: studentsLoading, error: studentsError, reload } = useMentorStudentSummaries(teacherId)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isRefreshingCode, setIsRefreshingCode] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(false)
  function selectStudent(id: string) { setSelectedStudent(id); setMobileDetail(true) }

  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudent(null)
      return
    }

    if (!selectedStudent || !students.some(student => student.id === selectedStudent)) {
      setSelectedStudent(students[0].id)
    }
  }, [selectedStudent, students])

  useEffect(() => setShowGoalForm(false), [selectedStudent])

  const selectedStudentData = students.find(s => s.id === selectedStudent)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Öğretmen Paneli</h1>
          <p className="text-gray-500 text-sm mt-1">Hoş geldiniz, {user?.username}. Önce dikkat gereken öğrencileri ve yaklaşan görüşmeleri inceleyin.</p>
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
            <UsersIcon aria-hidden="true" className="h-6 w-6 text-violet-600" />
            <div>
              <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Öğrenci Sayısı</div>
              <div className="text-xl font-bold text-purple-900">{students.length}</div>
            </div>
          </div>
        </div>
      </div>

      <EarlyWarningCenter
        students={students}
        loading={studentsLoading}
        error={studentsError}
        onSelectStudent={selectStudent}
        onRetry={() => void reload()}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-800">Yaklaşan görüşmeler</h3>
          <Link to="/teacher/meetings" className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700">Görüşmeleri Aç</Link>
        </div>
        {studentsLoading ? <p role="status" className="mt-2 text-sm text-slate-500">Görüşmeler yükleniyor…</p> : studentsError ?
          <p className="mt-2 text-sm text-slate-500">Görüşme özeti yüklenemedi.</p> :
          students.some(student => student.status.metrics.nextMeetingAt) ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {students.filter(student => student.status.metrics.nextMeetingAt)
                .sort((a, b) => new Date(a.status.metrics.nextMeetingAt!).getTime() - new Date(b.status.metrics.nextMeetingAt!).getTime())
                .slice(0, 3).map(student => <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <button type="button" onClick={() => selectStudent(student.id)} className="font-semibold text-indigo-700">{student.username}</button>
                  <time dateTime={student.status.metrics.nextMeetingAt!} className="tabular-nums text-slate-600">{new Date(student.status.metrics.nextMeetingAt!).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-500">Henüz yaklaşan görüşme yok. Görüşmeler ekranından planlayabilirsiniz.</p>}
      </Card>

      <div className="grid min-w-0 grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Sol Kolon: Öğrenci Listesi */}
        <div className={`min-w-0 xl:col-span-1 space-y-5 ${mobileDetail ? 'hidden xl:block' : ''}`}>
          <StudentList 
            students={students} 
            selectedStudent={selectedStudent} 
            onSelectStudent={selectStudent}
            loading={studentsLoading}
            error={studentsError}
            onRetry={() => void reload()}
          />
          {students.length > 0 && <AssignTaskForm
            students={students} 
            selectedStudent={selectedStudent} 
          />}
        </div>

        {/* Sağ Kolon: Öğrenci Detayları */}
        <div className={`min-w-0 xl:col-span-2 ${!mobileDetail ? 'hidden xl:block' : ''}`}>
          <button type="button" onClick={() => setMobileDetail(false)} className="mb-3 min-h-11 rounded-lg px-3 text-indigo-700 xl:hidden">← Öğrenci listesine dön</button>
          {selectedStudent ? (
            <div className="space-y-6">
              <Card className="border-t-4 border-t-indigo-500">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-inner">
                    {selectedStudentData?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-gray-800">{selectedStudentData?.username}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Aktif Öğrenci
                      </span>
                      
                    </div>
                  </div>
                </div>

                {selectedStudentData && (
                  <>
                    <MentorSummary
                      displayName={selectedStudentData.username}
                      status={selectedStudentData.status}
                      goalProgress={selectedStudentData.goalProgress}
                      competencyMap={selectedStudentData.competencyMap}
                      alerts={selectedStudentData.alerts}
                    />
                    <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-gray-700">Ana hedef</h4>
                          <p className="text-xs text-gray-500">Öğrencinin eğitim ve performans hedefleri.</p>
                        </div>
                        <button type="button" onClick={() => setShowGoalForm(value => !value)} className="rounded-xl bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-200">
                          {showGoalForm ? 'Kapat' : selectedStudentData.goalProgress.hasGoal ? 'Hedefi değiştir' : 'Hedef belirle'}
                        </button>
                      </div>
                      {showGoalForm && (
                        <div className="mt-4 border-t border-gray-200 pt-4">
                          <GoalForm
                            studentId={selectedStudentData.id}
                            goal={selectedStudentData.goalProgress.goal}
                            onCancel={() => setShowGoalForm(false)}
                            onSaved={() => setShowGoalForm(false)}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="mb-2">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Performans Grafiği
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">Son günlerdeki çalışma saatleri.</p>
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
          ) : students.length > 0 && !studentsLoading && !studentsError ? (
            <Card className="flex flex-col items-center justify-center text-center p-5 border-dashed">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Öğrenci Seçilmedi</h3>
              <p className="text-gray-500 max-w-sm">
                Detayları görmek için öğrenci listesinden bir öğrenci seçin.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
