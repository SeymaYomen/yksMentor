import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactElement; requiredRole?: 'teacher' | 'student' }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
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
