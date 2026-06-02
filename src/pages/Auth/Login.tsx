import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { showSuccess, showError } from '../../components/ui/ToastButton'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const auth = useAuth()

  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await auth.login({ email, password })
    setLoading(false)
    if (res.error) {
      showError('Giriş başarısız: ' + (res.error.message || res.error))
      return
    }
    showSuccess('Tekrar hoş geldiniz, ' + res.user?.username + '!')
    const destination = res.user?.role === 'teacher' ? '/teacher' : '/student'
    navigate(destination)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 p-4">
      <Card className="w-full max-w-md border-t-4 border-t-indigo-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">Giriş Yap</h2>
          <p className="text-sm text-gray-500">YKS yolculuğunda kaldığın yerden devam et!</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">E-posta</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@ogrenci.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Şifre</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="flex items-center justify-between pt-4">
            <Button type="submit" loading={loading} className="w-1/2">Giriş Yap</Button>
            <Link to="/register" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Yeni hesap oluştur</Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
