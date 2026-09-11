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
    <div className="dashboard-shell min-h-screen bg-slate-50 text-gray-900">
      <Navbar />
      <div className="dashboard-content container-max mx-auto px-4 pt-5 lg:pt-6 flex flex-col lg:flex-row gap-6">
        <Sidebar role={user.role} />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
