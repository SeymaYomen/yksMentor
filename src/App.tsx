import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from './components/Layout/AuthLayout'
import DashboardLayout from './components/Layout/DashboardLayout'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
import TeacherDashboard from './pages/Teacher/Dashboard'
import StudentDashboard from './pages/Student/Dashboard'
import Meetings from './pages/Meetings'
import NotFound from './pages/NotFound'
import { PublicRoute, ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './hooks/useAuth'
import AIHelper from './components/AIHelper/AIHelper'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen text-gray-900">
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={user ? (user.role === 'teacher' ? '/teacher' : '/student') : '/login'}
              replace
            />
          }
        />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        </Route>

        <Route element={<DashboardLayout />}>
          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/meetings" element={<ProtectedRoute requiredRole="teacher"><Meetings /></ProtectedRoute>} />
          
          <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/meetings" element={<ProtectedRoute requiredRole="student"><Meetings /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <AIHelper />
    </div>
  )
}
