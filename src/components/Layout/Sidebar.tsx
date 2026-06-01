import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  UsersIcon, 
  ClipboardDocumentCheckIcon, 
  CalendarDaysIcon,
  PresentationChartLineIcon 
} from '@heroicons/react/24/outline'

export default function Sidebar({ role = 'student' }: { role?: 'teacher' | 'student' }) {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  const teacherLinks = [
    {
      to: '/teacher',
      label: 'Öğrenci Listesi & Takip',
      icon: UsersIcon
    },
    {
      to: '/teacher/meetings',
      label: 'Görüşmeler',
      icon: CalendarDaysIcon
    }
  ]

  const studentLinks = [
    {
      to: '/student',
      label: 'Görevlerim & Çalışma',
      icon: ClipboardDocumentCheckIcon
    },
    {
      to: '/student/meetings',
      label: 'Görüşmelerim',
      icon: CalendarDaysIcon
    }
  ]

  const links = role === 'teacher' ? teacherLinks : studentLinks

  return (
    <>
      <aside className="w-64 hidden md:block">
        <div className="sticky top-6 bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3">Hızlı Erişim</div>
          <nav className="flex flex-col gap-1.5">
            {links.map((link) => {
              const Icon = link.icon
              const active = isActive(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10'
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile quick nav */}
      <nav className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 px-5 py-2.5 flex gap-6 md:hidden z-50">
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
                active ? 'text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <Icon className="w-5.5 h-5.5" />
              {link.label.split(' ')[0]}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
