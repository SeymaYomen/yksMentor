import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactElement; requiredRole?: 'teacher' | 'student' }) {
  const { user, loading, authError, logout, retryAuth } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
  }

  if (authError && !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-gray-800">Oturum doğrulanamadı</h2>
          <p className="mt-2 text-sm text-gray-600">{authError}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" onClick={() => void retryAuth()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              Tekrar Dene
            </button>
            <button type="button" onClick={() => void logout()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
              Güvenli Çıkış
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Rol koruğu: öğretmen öğrenci paneline, öğrenci öğretmen paneline giremesin
  if (requiredRole && user.role !== requiredRole) {
    const correctDest = user.role === 'teacher' ? '/teacher' : '/student'
    return <Navigate to={correctDest} replace />
  }

  return children
}

export function PublicRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
  }

  if (user) {
    const destination = user.role === 'teacher' ? '/teacher' : '/student'
    return <Navigate to={destination} replace />
  }

  return children
}
