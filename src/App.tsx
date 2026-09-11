import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from './components/Layout/AuthLayout'
import DashboardLayout from './components/Layout/DashboardLayout'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
const TeacherDashboard = lazy(() => import('./pages/Teacher/Dashboard'))
const StudentDashboard = lazy(() => import('./pages/Student/Dashboard'))
const MockExams = lazy(() => import('./pages/Student/MockExams'))
const Meetings = lazy(() => import('./pages/Meetings'))
import NotFound from './pages/NotFound'
const TeacherInviteActivation = lazy(() => import('./pages/Auth/TeacherInviteActivation'))
import { PublicRoute, ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
  }

  return (
    <div className="min-h-screen text-gray-900">
      <Suspense fallback={<div role="status" className="p-6 text-center">Yükleniyor...</div>}>
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
          <Route path="/student/activate-teacher" element={<ProtectedRoute requiredRole="student"><TeacherInviteActivation /></ProtectedRoute>} />
          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/meetings" element={<ProtectedRoute requiredRole="teacher"><Meetings /></ProtectedRoute>} />

          <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/exams" element={<ProtectedRoute requiredRole="student"><MockExams /></ProtectedRoute>} />
          <Route path="/student/meetings" element={<ProtectedRoute requiredRole="student"><Meetings /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </div>
  )
}
