import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  UsersIcon, 
  ClipboardDocumentCheckIcon, 
  CalendarDaysIcon,
  PresentationChartLineIcon 
} from '@heroicons/react/24/outline'
import type { UserRole } from '../../hooks/useAuth'

export default function Sidebar({ role }: { role: UserRole }) {
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
    { to: '/student/exams', label: 'Denemelerim', icon: PresentationChartLineIcon },
    {
      to: '/student/meetings',
      label: 'Görüşmelerim',
      icon: CalendarDaysIcon
    }
  ]

  const links = role === 'teacher' ? teacherLinks : studentLinks

  return (
    <>
      <aside className="hidden w-52 shrink-0 lg:block xl:w-60">
        <div className="sticky top-6 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3">Hızlı Erişim</div>
          <nav aria-label="Ana menü" className="flex flex-col gap-1.5">
            {links.map((link) => {
              const Icon = link.icon
              const active = isActive(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  <Icon aria-hidden="true" className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile quick nav */}
      <nav aria-label="Alt menü" className="dashboard-bottom-nav fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-0 flex-1 max-w-40 flex-col justify-center items-center gap-1 px-2 text-xs font-semibold transition-colors ${
                active ? 'text-indigo-700 bg-indigo-50' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              {link.label.split(' ')[0]}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
