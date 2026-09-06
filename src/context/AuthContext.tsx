import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type UserRole = 'teacher' | 'student'

export type User = {
  id: string
  username: string
  role: UserRole
  mentor_id?: string | null
  join_code?: string | null
}

type RegisterInput = {
  username: string
  email: string
  password: string
  role?: UserRole
  mentor_join_code?: string
  teacher_invite_code?: string
}

type AuthResult = {
  user?: User
  error?: Error
  warning?: string
  success?: boolean
  requiresEmailConfirmation?: boolean
  requiresTeacherInviteReentry?: boolean
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  authError: string | null
  login: (input: { email: string; password: string }) => Promise<AuthResult>
  register: (input: RegisterInput) => Promise<AuthResult>
  logout: () => Promise<void>
  retryAuth: () => Promise<void>
  joinTeacher: (joinCode: string) => Promise<AuthResult>
  getTeacherInfoByCode: (joinCode: string) => Promise<{ data?: any; error?: Error }>
  refreshJoinCode: () => Promise<{ data?: string; error?: Error }>
  redeemTeacherInvite: (inviteCode: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (typeof error === 'object' && error && 'message' in error) {
    return new Error(String((error as { message: unknown }).message))
  }
  return new Error(fallback)
}

function isUserRole(role: unknown): role is UserRole {
  return role === 'student' || role === 'teacher'
}

function mapTeacherInviteError(error: unknown) {
  const original = toError(error, 'Öğretmen davet kodu doğrulanamadı.')
  const message = original.message.toLocaleLowerCase('tr-TR')

  if (message.includes('could not find the function') || message.includes('schema cache')) {
    return new Error('Öğretmen davet sistemi veritabanında henüz etkinleştirilmemiş.')
  }

  return original
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const authMutationInProgress = useRef(false)
  const syncVersion = useRef(0)
  const supabaseClient = supabase

  async function readProfile(userId: string): Promise<User> {
    if (!supabaseClient) throw new Error('Supabase yapılandırılmamış.')

    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id, username, role, mentor_id, join_code')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    if (!profile) throw new Error('Kullanıcı profili bulunamadı.')
    if (!isUserRole(profile.role)) {
      throw new Error('Kullanıcı rolü geçersiz. Güvenliğiniz için oturum açılmadı.')
    }

    return {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      mentor_id: profile.mentor_id,
      join_code: profile.join_code,
    }
  }

  async function readProfileWithRetry(userId: string) {
    let lastError: unknown

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await readProfile(userId)
      } catch (error) {
        lastError = error
        if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, 150 * (attempt + 1)))
      }
    }

    throw lastError
  }

  async function readVerifiedCurrentProfile(session?: Session | null) {
    if (!supabaseClient) throw new Error('Supabase yapılandırılmamış.')
    if (!session) throw new Error('Doğrulanmış oturum bulunamadı.')

    const { data, error } = await supabaseClient.auth.getUser()
    if (error || !data.user) throw error || new Error('Oturum doğrulanamadı.')

    return readProfileWithRetry(data.user.id)
  }

  async function syncFromSession(session: Session | null) {
    const version = ++syncVersion.current
    setLoading(true)

    if (!session) {
      setUser(null)
      setAuthError(null)
      setLoading(false)
      return
    }

    try {
      const profile = await readVerifiedCurrentProfile(session)
      if (version !== syncVersion.current) return
      setUser(profile)
      setAuthError(null)
    } catch (error) {
      if (version !== syncVersion.current) return
      setUser(null)
      setAuthError(toError(error, 'Oturum profili okunamadı.').message)
    } finally {
      if (version === syncVersion.current) setLoading(false)
    }
  }

  useEffect(() => {
    localStorage.removeItem('yks_user')

    if (!isSupabaseConfigured || !supabaseClient) {
      setUser(null)
      setAuthError('Supabase yapılandırılmamış. Ortam ayarlarını kontrol edin.')
      setLoading(false)
      return
    }

    let active = true

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!active || authMutationInProgress.current) return
      window.setTimeout(() => {
        if (active && !authMutationInProgress.current) void syncFromSession(session)
      }, 0)
    })

    void supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setUser(null)
        setAuthError(error.message)
        setLoading(false)
        return
      }
      void syncFromSession(data.session)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
    // Supabase istemcisi uygulama boyunca tekil ve sabittir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function retryAuth() {
    if (!supabaseClient) {
      setUser(null)
      setAuthError('Supabase yapılandırılmamış.')
      setLoading(false)
      return
    }

    const { data, error } = await supabaseClient.auth.getSession()
    if (error) {
      setUser(null)
      setAuthError(error.message)
      setLoading(false)
      return
    }
    await syncFromSession(data.session)
  }

  async function register({ username, email, password, role = 'student', mentor_join_code, teacher_invite_code }: RegisterInput): Promise<AuthResult> {
    if (!isSupabaseConfigured || !supabaseClient) {
      return { error: new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.') }
    }

    authMutationInProgress.current = true
    setAuthError(null)

    try {
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })

      if (signUpError) throw signUpError
      if (!signUpData.user) throw new Error('Kullanıcı oluşturulamadı.')

      if (!signUpData.session) {
        setUser(null)
        return {
          success: true,
          requiresEmailConfirmation: true,
          requiresTeacherInviteReentry: role === 'teacher',
        }
      }

      let warning: string | undefined

      if (role === 'teacher') {
        if (!teacher_invite_code?.trim()) {
          throw new Error('Öğretmen hesabı için tek kullanımlık davet kodu gereklidir.')
        }
        const { error } = await supabaseClient.rpc('redeem_teacher_registration_invite', { p_code: teacher_invite_code.trim() })
        if (error) throw mapTeacherInviteError(error)
      } else if (mentor_join_code?.trim()) {
        const { error } = await supabaseClient.rpc('join_teacher_by_code', { p_code: mentor_join_code.trim() })
        if (error) warning = 'Hesabınız oluşturuldu ancak mentor katılım kodu uygulanamadı: ' + error.message
      }

      const profile = await readProfileWithRetry(signUpData.user.id)
      setUser(profile)
      return { user: profile, warning }
    } catch (error) {
      await supabaseClient.auth.signOut().catch(() => undefined)
      setUser(null)
      return { error: toError(error, 'Kayıt tamamlanamadı.') }
    } finally {
      authMutationInProgress.current = false
    }
  }

  async function login({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    if (!isSupabaseConfigured || !supabaseClient) {
      return { error: new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.') }
    }

    authMutationInProgress.current = true
    setAuthError(null)
    let signedIn = false

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.user || !data.session) throw new Error('Oturum doğrulanamadı.')
      signedIn = true
      const profile = await readProfileWithRetry(data.user.id)
      setUser(profile)
      return { user: profile }
    } catch (error) {
      if (signedIn) await supabaseClient.auth.signOut().catch(() => undefined)
      setUser(null)
      return { error: toError(error, 'Giriş yapılamadı.') }
    } finally {
      authMutationInProgress.current = false
    }
  }

  async function logout() {
    authMutationInProgress.current = true
    setLoading(true)

    try {
      if (supabaseClient) await supabaseClient.auth.signOut()
    } catch (error) {
      console.error('Supabase çıkış isteği tamamlanamadı; yerel oturum yine de temizlendi.')
    } finally {
      ++syncVersion.current
      localStorage.removeItem('yks_user')
      setUser(null)
      setAuthError(null)
      setLoading(false)
      authMutationInProgress.current = false
    }
  }

  async function joinTeacher(joinCode: string): Promise<AuthResult> {
    if (!supabaseClient) return { error: new Error('Supabase yapılandırılmamış.') }
    if (user?.role !== 'student') return { error: new Error('Mentor katılımı yalnızca öğrenci hesapları içindir.') }

    try {
      const { error } = await supabaseClient.rpc('join_teacher_by_code', { p_code: joinCode.trim() })
      if (error) throw error
      const profile = await readProfile(user.id)
      setUser(profile)
      return { success: true, user: profile }
    } catch (error) {
      return { error: toError(error, 'Mentor eşleşmesi tamamlanamadı.') }
    }
  }

  async function getTeacherInfoByCode(joinCode: string) {
    if (!supabaseClient) return { error: new Error('Supabase yapılandırılmamış.') }
    if (user?.role !== 'student') return { error: new Error('Mentor araması yalnızca öğrenci hesapları içindir.') }

    try {
      const { data, error } = await supabaseClient.rpc('get_teacher_info_by_code', { p_code: joinCode.trim() })
      if (error) throw error
      return { data }
    } catch (error) {
      return { error: toError(error, 'Mentor bilgisi alınamadı.') }
    }
  }

  async function refreshJoinCode() {
    if (!supabaseClient) return { error: new Error('Supabase yapılandırılmamış.') }
    if (user?.role !== 'teacher') return { error: new Error('Katılım kodunu yalnızca öğretmen yenileyebilir.') }

    try {
      const { data, error } = await supabaseClient.rpc('refresh_join_code')
      if (error) throw error
      const profile = await readProfile(user.id)
      setUser(profile)
      return { data: String(data), error: undefined }
    } catch (error) {
      return { error: toError(error, 'Katılım kodu yenilenemedi.') }
    }
  }

  async function redeemTeacherInvite(inviteCode: string): Promise<AuthResult> {
    if (!supabaseClient) return { error: new Error('Supabase yapılandırılmamış.') }
    if (!user) return { error: new Error('Önce giriş yapmalısınız.') }
    if (user.role === 'teacher') return { user, success: true }
    if (!inviteCode.trim()) return { error: new Error('Öğretmen davet kodu boş bırakılamaz.') }

    try {
      const { error } = await supabaseClient.rpc('redeem_teacher_registration_invite', { p_code: inviteCode.trim() })
      if (error) throw mapTeacherInviteError(error)
      const profile = await readProfile(user.id)
      setUser(profile)
      return { user: profile, success: true }
    } catch (error) {
      return { error: mapTeacherInviteError(error) }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, register, logout, retryAuth, joinTeacher, getTeacherInfoByCode, refreshJoinCode, redeemTeacherInvite }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.')
  return context
}
