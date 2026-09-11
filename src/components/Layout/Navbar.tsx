import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, loading, logout } = useAuth()

  if (loading || !user) return null

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">İçeriğe geç</a>
      <div className="container-max mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3">
          <div aria-hidden="true" className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center rounded-xl font-bold">Y</div>
          <div className="text-lg font-semibold">YKS Mentor</div>
        </Link>

        <nav aria-label="Hesap menüsü" className="flex items-center gap-3">
          <>
              <span className="hidden max-w-48 truncate text-sm text-gray-700 lg:block">Merhaba, {user.username}</span>
              <Link
                to={user.role === 'teacher' ? '/teacher' : '/student'}
                className="hidden text-sm text-gray-700 hover:text-indigo-600 sm:block"
              >
                Panelim
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-red-300 hover:text-red-600"
              >
                <ArrowLeftOnRectangleIcon aria-hidden="true" className="w-4 h-4" />
                Çıkış Yap
              </button>
          </>
        </nav>
      </div>
    </header>
  )
}
