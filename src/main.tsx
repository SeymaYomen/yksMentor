import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import ToastProvider from './components/ui/ToastProvider'
import { AuthProvider } from './context/AuthContext'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <ToastProvider />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
