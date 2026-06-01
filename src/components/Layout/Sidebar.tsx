import React from 'react'
import { Link } from 'react-router-dom'

export default function Sidebar({ role = 'student' }: { role?: 'teacher' | 'student' }) {
  return (
    <>
      <aside className="w-64 hidden md:block">
        <div className="sticky top-6 space-y-3">
          <div className="p-3">
            <div className="text-sm font-medium text-gray-500">Hızlı Erişim</div>
            <nav className="mt-2 flex flex-col gap-2">
              {role === 'teacher' ? (
                <>
                  <Link to="/teacher" className="text-gray-700 hover:text-blue-600">Öğrenci Listesi</Link>
                  <Link to="/teacher" className="text-gray-700 hover:text-blue-600">Görev Atama</Link>
                  <Link to="/teacher/meetings" className="text-gray-700 hover:text-blue-600">Görüşmeler</Link>
                </>
              ) : (
                <>
                  <Link to="/student" className="text-gray-700 hover:text-blue-600">Görevlerim</Link>
                  <Link to="/student" className="text-gray-700 hover:text-blue-600">Performans</Link>
                  <Link to="/student/meetings" className="text-gray-700 hover:text-blue-600">Görüşmeler</Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </aside>

      {/* Mobile quick nav */}
      <nav className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-md px-4 py-2 flex gap-4 md:hidden">
        {role === 'teacher' ? (
          <>
            <Link to="/teacher" className="text-sm text-gray-700">Öğrenciler</Link>
            <Link to="/teacher" className="text-sm text-gray-700">Görev</Link>
            <Link to="/teacher/meetings" className="text-sm text-gray-700">Görüşme</Link>
          </>
        ) : (
          <>
            <Link to="/student" className="text-sm text-gray-700">Görevler</Link>
            <Link to="/student" className="text-sm text-gray-700">Performans</Link>
            <Link to="/student/meetings" className="text-sm text-gray-700">Görüşme</Link>
          </>
        )}
      </nav>
    </>
  )
}
