import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { showError, showSuccess } from '../../components/ui/ToastButton'

export default function TeacherInviteActivation() {
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, redeemTeacherInvite } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteCode.trim()) {
      showError('Öğretmen davet kodunu girin.')
      return
    }

    setSubmitting(true)
    const result = await redeemTeacherInvite(inviteCode)
    setSubmitting(false)

    if (result.error) {
      showError(result.error.message)
      return
    }

    showSuccess('Öğretmen hesabınız güvenli biçimde etkinleştirildi.')
    navigate('/teacher', { replace: true })
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <Card className="border-t-4 border-t-indigo-500">
        <h2 className="text-2xl font-bold text-gray-800">Öğretmen Hesabını Etkinleştir</h2>
        <p className="mt-2 text-sm text-gray-600">
          {user?.username}, bu kod yalnızca öğretmen hesabını etkinleştirmek içindir. Öğrencilerin mentorlarına
          bağlanmak için kullandığı katılım kodundan farklıdır.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="teacherinviteactivation-field-1" className="mb-1 ml-1 block text-sm font-semibold text-gray-700">Tek Kullanımlık Öğretmen Davet Kodu</label>
            <Input id="teacherinviteactivation-field-1"
              value={inviteCode}
              onChange={event => setInviteCode(event.target.value)}
              placeholder="Size iletilen özel davet kodu"
              autoComplete="one-time-code"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" loading={submitting} className="flex-1">
              Kodu Doğrula ve Etkinleştir
            </Button>
            <button
              type="button"
              onClick={() => navigate('/student', { replace: true })}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Öğrenci Paneline Devam Et
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
