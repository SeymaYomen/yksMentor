import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, loading, logout } = useAuth()

  if (loading || !user) return null

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container container-max mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center rounded-md font-bold">Y</div>
          <div className="text-lg font-semibold">YKS Mentor</div>
        </Link>

        <nav className="flex items-center gap-3">
          <>
              <span className="text-sm text-gray-700">Merhaba, {user.username}</span>
              <Link
                to={user.role === 'teacher' ? '/teacher' : '/student'}
                className="text-sm text-gray-700 hover:text-blue-600"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 hover:border-red-300 hover:text-red-600"
              >
                <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                Çıkış Yap
              </button>
          </>
        </nav>
      </div>
    </header>
  )
}
