import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL var mı?', !!SUPABASE_URL)
console.log('Supabase KEY var mı?', !!SUPABASE_ANON_KEY)

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (supabase) {
  console.log('Supabase istemcisi başarıyla oluşturuldu.')
} else {
  console.error('Supabase ayarları eksik. Lütfen .env dosyanızı kontrol edin.')
}
