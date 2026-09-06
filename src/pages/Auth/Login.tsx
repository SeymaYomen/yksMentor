import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { showSuccess, showError } from '../../components/ui/ToastButton'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [searchParams] = useSearchParams()
  const teacherInviteRequired = searchParams.get('teacherInvite') === 'required'
  const [activateTeacherAfterLogin, setActivateTeacherAfterLogin] = useState(teacherInviteRequired)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const auth = useAuth()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    const result = await auth.login({ email, password })
    setLoading(false)

    if (result.error) {
      showError('Giriş başarısız: ' + result.error.message)
      return
    }
    if (!result.user) {
      showError('Doğrulanmış kullanıcı profili alınamadı.')
      return
    }

    showSuccess('Tekrar hoş geldiniz, ' + result.user.username + '!')

    if (result.user.role === 'teacher') {
      navigate('/teacher', { replace: true })
      return
    }

    navigate(activateTeacherAfterLogin ? '/student/activate-teacher' : '/student', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 p-4">
      <Card className="w-full max-w-md border-t-4 border-t-indigo-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">Giriş Yap</h2>
          <p className="text-sm text-gray-500">YKS yolculuğunda kaldığın yerden devam et!</p>
        </div>

        {teacherInviteRequired && (
          <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
            E-posta onayından sonra giriş yapın. Ardından tek kullanımlık öğretmen davet kodunuz yeniden istenecektir.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-field-1" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">E-posta</label>
            <Input id="login-field-1" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="ornek@ogrenci.com" />
          </div>
          <div>
            <label htmlFor="login-field-2" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Şifre</label>
            <Input id="login-field-2" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={activateTeacherAfterLogin}
              onChange={event => setActivateTeacherAfterLogin(event.target.checked)}
              className="mt-1"
            />
            <span>
              Tek kullanımlık <strong>öğretmen kayıt davet kodum</strong> var. Girişten sonra kodu girmek istiyorum.
            </span>
          </label>

          <div className="flex items-center justify-between pt-4">
            <Button type="submit" loading={loading} className="w-1/2">Giriş Yap</Button>
            <Link to="/register" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Yeni hesap oluştur</Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
