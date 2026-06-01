import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type User = {
  id: string
  username: string
  role: 'teacher' | 'student'
  mentor_id?: string | null
  join_code?: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseClient = supabase

  useEffect(() => {
    async function initializeAuth() {
      try {
        const raw = localStorage.getItem('yks_user')
        if (raw) setUser(JSON.parse(raw))

        if (!isSupabaseConfigured || !supabaseClient) {
          setLoading(false)
          return
        }

        const { data, error: sessionError } = await supabaseClient.auth.getSession()
        if (sessionError) {
          console.error("Supabase getSession hatası:", sessionError)
          return
        }
        
        const authUser = data.session?.user
        if (authUser) {
          const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
          if (error) {
            console.error("Supabase profile çekme hatası:", error)
          }
          if (!error && profile) {
            const u: User = { id: profile.id, username: profile.username, role: profile.role, mentor_id: profile.mentor_id, join_code: profile.join_code }
            localStorage.setItem('yks_user', JSON.stringify(u))
            setUser(u)
          }
        }
      } catch (err) {
        console.error("initializeAuth beklenmeyen hata:", err)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    if (!isSupabaseConfigured || !supabaseClient) return

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user
      if (authUser) {
        const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
        if (!error && profile) {
          const u: User = { id: profile.id, username: profile.username, role: profile.role, mentor_id: profile.mentor_id, join_code: profile.join_code }
          localStorage.setItem('yks_user', JSON.stringify(u))
          setUser(u)
        }
      } else {
        localStorage.removeItem('yks_user')
        setUser(null)
      }
    })

    return () => {
      // unsubscribe if available
      // @ts-ignore
      authListener?.subscription?.unsubscribe?.()
    }
  }, [])

  async function register({ username, email, password, join_code, role = 'student' }: { username: string; email: string; password: string; join_code?: string; role?: 'teacher' | 'student' }) {
    try {
      if (!isSupabaseConfigured || !supabaseClient) {
        throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
      }

      let mentor_id: string | null = null
      if (join_code) {
        const { data: mentorData, error: mentorErr } = await supabaseClient.from('profiles').select('id').eq('join_code', join_code).maybeSingle()
        if (mentorErr) throw mentorErr
        if (mentorData && (mentorData as any).id) mentor_id = (mentorData as any).id
      }

      // signUp'a user_metadata ekle; trigger'ın username ve role'ü metadata'dan okuması için
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            role
          }
        }
      })
      if (signUpError) throw signUpError

      const authUser = signUpData.user
      if (!authUser) return { error: new Error('Kullanıcı oluşturulamadı.') }

      // Eğer e-posta doğrulaması açıksa, session null döner.
      if (!signUpData.session) {
        return { success: true, requiresEmailConfirmation: true }
      }

      // Trigger tarafından profiles satırı otomatik oluşturulacağı için, buraya sadece admin
      // değerleri (rol, mentor_id) gönderelim ve trigger bunları tamamlasın.
      const { data, error } = await supabaseClient.from('profiles').upsert([{ id: authUser.id, username, role, mentor_id }], { onConflict: 'id' }).select().maybeSingle()
      
      if (error) {
        console.error('Profile upsert error:', error)
        // RLS hatası (42501) alırsak ama kullanıcı oluştuysa, trigger profili yaratmış olabilir.
        // Bu durumda mevcut profili çekmeyi deneyebiliriz.
        if (error.code === '42501') {
           const { data: existingProfile } = await supabaseClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
           if (existingProfile) {
              const u: User = { id: existingProfile.id, username: existingProfile.username, role: existingProfile.role, mentor_id: existingProfile.mentor_id, join_code: existingProfile.join_code }
              localStorage.setItem('yks_user', JSON.stringify(u))
              setUser(u)
              return { user: u }
           }
        }
        throw error
      }
      
      const created: any = data
      const u: User = { id: created.id, username: created.username, role: created.role, mentor_id: created.mentor_id, join_code: created.join_code }
      localStorage.setItem('yks_user', JSON.stringify(u))
      setUser(u)
      return { user: u }
    } catch (err: any) {
      return { error: err }
    }
  }

  async function login({ email, password }: { email: string; password: string }) {
    try {
      if (!isSupabaseConfigured || !supabaseClient) {
        throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
      }
      const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      const authUser = signInData.user
      if (!authUser) return { error: new Error('Giriş yapılamadı') }

      let { data: profile, error: profileErr } = await supabaseClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
      
      if (profileErr) {
         console.error("Profil çekme hatası:", profileErr)
         return { error: new Error('Veritabanına erişim sağlanamadı. RLS ayarları veya tablolar eksik olabilir.') }
      }
      
      if (!profile) {
        // Profil yoksa client üzerinden oluşturmayı deneyelim (Eğer insert yetkisi varsa)
        const fallbackUsername = authUser.user_metadata?.username || email.split('@')[0]
        const fallbackRole = authUser.user_metadata?.role || 'student'
        const { data: newProfile, error: insertErr } = await supabaseClient.from('profiles').insert([{ id: authUser.id, username: fallbackUsername, role: fallbackRole }]).select().maybeSingle()
        
        if (insertErr) {
          console.error("Profil oluşturma hatası:", insertErr)
          return { error: new Error('Profil bulunamadı. Lütfen Supabase SQL Editor üzerinden "sql/schema.sql" ve "sql/auth_triggers.sql" dosyalarındaki kodları çalıştırdığınızdan emin olun!') }
        }
        profile = newProfile
      }
      const u: User = { id: profile.id, username: profile.username, role: profile.role, mentor_id: profile.mentor_id, join_code: profile.join_code }
      localStorage.setItem('yks_user', JSON.stringify(u))
      setUser(u)
      return { user: u }
    } catch (err: any) {
      return { error: err }
    }
  }

  async function logout() {
    if (isSupabaseConfigured && supabaseClient) {
      await supabaseClient.auth.signOut()
    }
    localStorage.removeItem('yks_user')
    setUser(null)
  }

  return { user, loading, register, login, logout }
}

