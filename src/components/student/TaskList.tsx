import React from 'react'
import { useTasks, Task } from '../../hooks/useTasks'
import { useAuth } from '../../hooks/useAuth'

export default function TaskList({ studentId, isTeacherView = false }: { studentId?: string, isTeacherView?: boolean }) {
  const auth = useAuth()
  const id = studentId || auth.user?.id
  const { tasks, loading, toggleTaskStatus } = useTasks(id)

  if (!id) return <div className="text-sm text-gray-500">Kullanıcı bulunamadı.</div>

  const pendingTasks = tasks.filter(t => !t.status)
  const completedTasks = tasks.filter(t => !!t.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-bold text-gray-800">{isTeacherView ? 'Öğrencinin Görevleri' : 'Görevlerim'}</h3>
        <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
          {tasks.length} Görev
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-gray-500 font-medium">Harika! Tüm görevleri tamamladın.</div>
          <div className="text-sm text-gray-400">Şu an için atanan yeni bir görev yok.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bekleyen Görevler */}
          {pendingTasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Bekleyenler ({pendingTasks.length})
              </h4>
              <ul className="space-y-2">
                {pendingTasks.map((t: Task) => (
                  <TaskItem key={t.id} task={t} toggle={toggleTaskStatus} readOnly={isTeacherView} />
                ))}
              </ul>
            </div>
          )}

          {/* Tamamlanan Görevler */}
          {completedTasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Tamamlananlar ({completedTasks.length})
              </h4>
              <ul className="space-y-2 opacity-70">
                {completedTasks.map((t: Task) => (
                  <TaskItem key={t.id} task={t} toggle={toggleTaskStatus} readOnly={isTeacherView} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskItem({ task, toggle, readOnly = false }: { task: Task; toggle: (id: string, status: boolean) => Promise<void>, readOnly?: boolean }) {
  const isCompleted = !!task.status

  return (
    <li className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
      isCompleted ? 'bg-gray-50 border-gray-200' : 'bg-white border-indigo-100 shadow-sm hover:shadow-md'
    }`}>
      <div className="flex-shrink-0 pt-0.5">
        <label className={`relative flex items-center rounded-full p-1 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`} htmlFor={`checkbox-${task.id}`}>
          <input
            type="checkbox"
            className={`peer relative h-6 w-6 appearance-none rounded-md border border-gray-300 transition-all checked:border-green-500 checked:bg-green-500 hover:scale-105 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            id={`checkbox-${task.id}`}
            checked={isCompleted}
            disabled={readOnly}
            onChange={async (e) => {
              if (readOnly) return
              await toggle(task.id, e.target.checked)
            }}
          />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
            </svg>
          </div>
        </label>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-base ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-4 mt-1">
          {(task.exam_type || task.subject || task.topic) && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              {[task.exam_type, task.subject?.name, task.topic?.name].filter(Boolean).join(' / ')}
            </span>
          )}
          {task.due_date && (
            <div className={`text-xs flex items-center gap-1 ${
              isCompleted ? 'text-gray-400' : 
              new Date(task.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-indigo-500'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(task.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
