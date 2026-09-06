import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useAuth } from '../../hooks/useAuth'

export default function DashboardLayout() {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50/50 to-pink-50 text-gray-900">
      <Navbar />
      <div className="container container-max mx-auto px-4 pt-8 pb-28 md:pb-8 flex flex-col md:flex-row gap-6">
        <Sidebar role={user.role} />
        <main className="min-w-0 flex-1 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
