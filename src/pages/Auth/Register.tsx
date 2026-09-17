import React, { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../hooks/useAuth'
import { showSuccess, showError } from '../../components/ui/ToastButton'
import { authMessage } from '../../lib/authMessages'
import { supabase } from '../../lib/supabase'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mentorJoinCode, setMentorJoinCode] = useState('')
  const [teacherInviteCode, setTeacherInviteCode] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<{ email: string; teacher: boolean; mentor: boolean } | null>(null)
  const [resent, setResent] = useState(false)
  const submitting = useRef(false)
  const navigate = useNavigate()
  const auth = useAuth()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return

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
    if (role === 'teacher' && !teacherInviteCode.trim()) {
      showError('Öğretmen hesabı için tek kullanımlık öğretmen davet kodunu girin.')
      return
    }

    submitting.current = true
    setLoading(true)
    try {
      const result = await auth.register({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
        mentor_join_code: role === 'student' ? mentorJoinCode : undefined,
        teacher_invite_code: role === 'teacher' ? teacherInviteCode : undefined,
      })

      if (result.error) {
        showError(authMessage(result.error))
        return
      }
      if (result.requiresEmailConfirmation) {
        setConfirmation({ email: email.trim(), teacher: !!result.requiresTeacherInviteReentry, mentor: !!mentorJoinCode.trim() })
        setPassword('')
        return
      }

      if (!result.user) {
        showError('Doğrulanmış kullanıcı profili alınamadı.')
        return
      }

      if (result.warning) showError(result.warning)
      showSuccess('Hoş geldiniz! Hesabınız oluşturuldu.')
      navigate(result.user.role === 'teacher' ? '/teacher' : '/student', { replace: true })
    } catch (error) {
      showError(authMessage(error))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  if (confirmation) return <section role="status" className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
    <h2 className="text-xl font-bold">Hesabın oluşturuldu.</h2>
    <p>Devam etmek için e-posta adresini doğrula.</p>
    <p>Hesabınızı etkinleştirmek için e-posta adresinize gönderilen doğrulama bağlantısını açın.</p>
    <p>{confirmation.email} adresindeki gelen kutunu ve spam klasörünü kontrol et.</p>
    {confirmation.teacher && <p>Doğrulama sonrası giriş yaptığında öğretmen davet kodunu yeniden gir.</p>}
    {confirmation.mentor && <p>Doğrulama sonrası mentor katılım kodunu öğrenci panelinden yeniden gir.</p>}
    <Button type="button" loading={loading} disabled={resent} onClick={async () => {
      if (!supabase || submitting.current || resent) return
      submitting.current = true
      setLoading(true)
      try {
        const { error } = await supabase.auth.resend({ type: 'signup', email: confirmation.email })
        if (error) showError(authMessage(error))
        else { setResent(true); showSuccess('Doğrulama e-postası tekrar gönderildi.') }
      } catch (error) { showError(authMessage(error)) } finally { submitting.current = false; setLoading(false) }
    }}>{resent ? 'Doğrulama e-postası gönderildi' : 'Doğrulama e-postasını tekrar gönder'}</Button>
    <Link className="block font-semibold text-indigo-700" to={confirmation.teacher ? '/login?teacherInvite=required' : '/login'}>Doğruladım, giriş yap</Link>
  </section>

  return (
    <div>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 mb-2">Aramıza Katıl</h2>
          <p className="text-sm text-gray-500">YKS hedeflerine ulaşmak için ilk adımı at.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-4 p-2 bg-purple-50/50 rounded-xl border border-purple-100/50">
            {(['student', 'teacher'] as UserRole[]).map(option => (
              <label key={option} className={`flex-1 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-purple-500 py-2 rounded-lg transition-all ${role === option ? 'bg-white shadow-sm text-purple-700 font-semibold' : 'text-gray-500 hover:bg-white/50'}`}>
                <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} className="sr-only" />
                <span className="text-sm">{option === 'student' ? 'Öğrenci' : 'Öğretmen'}</span>
              </label>
            ))}
          </div>

          <div>
            <label htmlFor="register-field-1" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Kullanıcı Adı</label>
            <Input id="register-field-1" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="ornek_kullanici" />
          </div>
          <div>
            <label htmlFor="register-field-2" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">E-posta</label>
            <Input id="register-field-2" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="ornek@ogrenci.com" />
          </div>
          <div>
            <label htmlFor="register-field-3" className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Şifre</label>
            <Input id="register-field-3" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="En az 6 karakter" />
          </div>

          {role === 'student' ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <label htmlFor="register-field-4" className="block text-sm font-semibold text-gray-700 mb-1">Mentor Katılım Kodu <span className="font-normal text-gray-400">(isteğe bağlı)</span></label>
              <p className="mb-2 text-xs text-gray-500">Mevcut bir mentora/öğretmene bağlanmak içindir; hesap rolünüzü değiştirmez.</p>
              <Input id="register-field-4" value={mentorJoinCode} onChange={event => setMentorJoinCode(event.target.value)} placeholder="Mentorunuzun katılım kodu" />
            </div>
          ) : (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <label htmlFor="register-field-5" className="block text-sm font-semibold text-purple-900 mb-1">Tek Kullanımlık Öğretmen Kayıt Davet Kodu</label>
              <p className="mb-2 text-xs text-purple-700">Yalnızca yetkili tarafından verilen, süreli öğretmen etkinleştirme kodudur. Mentor katılım kodundan ayrıdır.</p>
              <Input id="register-field-5" autoComplete="one-time-code" value={teacherInviteCode} onChange={event => setTeacherInviteCode(event.target.value)} placeholder="Özel öğretmen davet kodu" />
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button type="submit" loading={loading} className="w-1/2 !from-purple-600 !to-pink-600">Kayıt Ol</Button>
            <Link to="/login" className="text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors">Zaten hesabım var</Link>
          </div>
        </form>
    </div>
  )
}
