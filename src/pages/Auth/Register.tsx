import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { showSuccess, showError } from '../../components/ui/ToastButton'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [role, setRole] = useState('student') // YENİ: Varsayılan olarak öğrenci seçili
  const navigate = useNavigate()
  const auth = useAuth()

  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Ön yüz doğrulamaları
    if (!username.trim()) {
      showError('Kullanıcı adı boş bırakılamaz.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      showError('Geçerli bir e-posta adresi girin.')
      return
    }
    if (password.length < 6) {
      showError('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setLoading(true)
    
    // YENİ: role bilgisini auth.register fonksiyonuna ekledik.
    // Eğer öğretmen seçiliyse join_code'u null gönderiyoruz.
    const res = await auth.register({ 
      username, 
      email, 
      password, 
      role, 
      join_code: role === 'student' ? joinCode : null 
    })
    
    setLoading(false)
    if ((res as any).requiresEmailConfirmation) {
      showSuccess('Kayıt başarılı! Lütfen e-posta adresinizi onaylayın, ardından giriş yapabilirsiniz.')
      navigate('/login')
      return
    }
    if (res.error) {
      showError('Kayıt başarısız: ' + (res.error.message || res.error))
      return
    }
    showSuccess('Hoş geldiniz! Hesabınız oluşturuldu.')
    const destination = res.user?.role === 'teacher' ? '/teacher' : '/student'
    navigate(destination)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
      <Card className="w-full max-w-md border-t-4 border-t-purple-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 mb-2">Aramıza Katıl</h2>
          <p className="text-sm text-gray-500">YKS hedeflerine ulaşmak için ilk adımı at.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* YENİ: Rol Seçim Butonları */}
          <div className="flex gap-4 p-2 bg-purple-50/50 rounded-xl border border-purple-100/50">
            <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-2 rounded-lg transition-all ${role === 'student' ? 'bg-white shadow-sm text-purple-700 font-semibold' : 'text-gray-500 hover:bg-white/50'}`}>
              <input 
                type="radio" 
                name="role" 
                value="student" 
                checked={role === 'student'} 
                onChange={() => setRole('student')} 
                className="hidden"
              />
              <span className="text-sm">👨‍🎓 Öğrenci</span>
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-2 rounded-lg transition-all ${role === 'teacher' ? 'bg-white shadow-sm text-purple-700 font-semibold' : 'text-gray-500 hover:bg-white/50'}`}>
              <input 
                type="radio" 
                name="role" 
                value="teacher" 
                checked={role === 'teacher'} 
                onChange={() => setRole('teacher')} 
                className="hidden"
              />
              <span className="text-sm">👨‍🏫 Öğretmen</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Kullanıcı Adı</label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="ornek_kullanici" />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">E-posta</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@ogrenci.com" />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Şifre</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="En az 6 karakter" />
            {password.length > 0 && (
              <div className="mt-1 ml-1 flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 w-8 rounded-full transition-colors ${
                      password.length >= 6 && i === 0 ? 'bg-red-400' :
                      password.length >= 8 && i <= 1 ? 'bg-yellow-400' :
                      password.length >= 10 && i <= 2 ? 'bg-blue-400' :
                      password.length >= 12 && i <= 3 ? 'bg-green-500' :
                      i === 0 && password.length >= 6 ? 'bg-red-400' :
                      'bg-gray-200'
                    }`} />
                  ))}
                </div>
                <span className={`text-xs ${password.length < 6 ? 'text-red-500' : password.length < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {password.length < 6 ? `${6 - password.length} karakter daha gerekli` : password.length < 10 ? 'Yeterli' : 'Güçlü şifre'}
                </span>
              </div>
            )}
          </div>

          
          {/* YENİ: Sadece "Öğrenci" seçiliyse bu kutuyu göster */}
          {role === 'student' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Öğretmen Katılım Kodu <span className="text-gray-400 font-normal">(isteğe bağlı)</span></label>
              <Input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Örn: a1b2c3d4" />
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button type="submit" loading={loading} className="w-1/2 !from-purple-600 !to-pink-600 hover:!from-purple-500 hover:!to-pink-500 focus:!ring-purple-300">Kayıt Ol</Button>
            <Link to="/login" className="text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors">Zaten hesabım var</Link>
          </div>
        </form>
      </Card>
    </div>
  )
}