import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env dosyasından oku
const env = readFileSync('.env', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=')
    if (key && val.length) acc[key.trim()] = val.join('=').trim()
    return acc
  }, {})

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ .env dosyasında Supabase bilgileri eksik')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function runChecks() {
  console.log('🔍 Supabase bağlantı ve tablo kontrolleri başlıyor...\n')
  let allOk = true

  // 1. Bağlantı kontrolü
  console.log('1️⃣  Supabase bağlantısı...')
  const { error: pingErr } = await supabase.from('profiles').select('count').limit(0)
  if (pingErr && pingErr.code !== 'PGRST116') {
    console.error('   ❌ Bağlantı hatası:', pingErr.message)
    allOk = false
  } else {
    console.log('   ✅ Bağlantı başarılı')
  }

  // 2. profiles tablosu var mı?
  console.log('\n2️⃣  "profiles" tablosu...')
  const { error: profErr } = await supabase.from('profiles').select('id').limit(1)
  if (profErr && profErr.code === '42P01') {
    console.error('   ❌ "profiles" tablosu bulunamadı! sql/schema.sql çalıştırılmamış.')
    allOk = false
  } else if (profErr && profErr.code !== 'PGRST301') {
    console.error('   ⚠️  Tablo mevcut ama erişim hatası:', profErr.message, `(kod: ${profErr.code})`)
  } else {
    console.log('   ✅ "profiles" tablosu mevcut')
  }

  // 3. tasks tablosu var mı?
  console.log('\n3️⃣  "tasks" tablosu...')
  const { error: tasksErr } = await supabase.from('tasks').select('id').limit(1)
  if (tasksErr && tasksErr.code === '42P01') {
    console.error('   ❌ "tasks" tablosu bulunamadı! sql/schema.sql çalıştırılmamış.')
    allOk = false
  } else if (tasksErr && tasksErr.code !== 'PGRST301') {
    console.error('   ⚠️  Tablo mevcut ama erişim hatası:', tasksErr.message, `(kod: ${tasksErr.code})`)
  } else {
    console.log('   ✅ "tasks" tablosu mevcut')
  }

  // 4. performance tablosu var mı?
  console.log('\n4️⃣  "performance" tablosu...')
  const { error: perfErr } = await supabase.from('performance').select('id').limit(1)
  if (perfErr && perfErr.code === '42P01') {
    console.error('   ❌ "performance" tablosu bulunamadı! sql/schema.sql çalıştırılmamış.')
    allOk = false
  } else if (perfErr && perfErr.code !== 'PGRST301') {
    console.error('   ⚠️  Tablo mevcut ama erişim hatası:', perfErr.message, `(kod: ${perfErr.code})`)
  } else {
    console.log('   ✅ "performance" tablosu mevcut')
  }

  // 5. RLS aktif mi? (anonim kullanıcı profiles görmemeli)
  console.log('\n5️⃣  RLS koruması (profiles tablosu anonim erişim engeliyor mu?)...')
  const { data: anonData, error: anonErr } = await supabase.from('profiles').select('*')
  if (anonErr && (anonErr.code === 'PGRST301' || anonErr.message?.includes('row-level security'))) {
    console.log('   ✅ RLS aktif — anonim erişim engelleniyor')
  } else if (!anonData || anonData.length === 0) {
    console.log('   ✅ RLS aktif — anonim sorgu boş döndü (veri görünmüyor)')
  } else {
    console.warn('   ⚠️  RLS devre dışı olabilir — anonim kullanıcı', anonData.length, 'profil görebiliyor!')
  }

  // 6. Auth trigger kontrolü (auth.users'a yeni kayıt → profiles'a satır gelmeli)
  console.log('\n6️⃣  Auth trigger kontrolü...')
  const testEmail = `_check_${Date.now()}@test.invalid`
  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
    email: testEmail,
    password: 'Tes1Pass!x9',
    options: { data: { username: 'triggercheck', role: 'student' } }
  })
  if (signUpErr) {
    console.error('   ⚠️  Test kaydı oluşturulamadı:', signUpErr.message)
  } else if (signUp?.user) {
    await new Promise(r => setTimeout(r, 1200)) // trigger'ın çalışması için bekle
    // Session ile profili oku
    const { data: pRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signUp.user.id)
      .maybeSingle()
    if (pRow) {
      console.log('   ✅ Auth trigger çalışıyor — profil otomatik oluşturuldu')
      console.log('   📋 Profil:', JSON.stringify(pRow))
    } else {
      console.error('   ❌ Auth trigger çalışmıyor — profil oluşturulmadı!')
      console.error('      → Supabase SQL Editor\'da sql/auth_triggers.sql dosyasını çalıştırın.')
      allOk = false
    }
  }

  console.log('\n' + '─'.repeat(50))
  if (allOk) {
    console.log('🎉 Tüm kontroller başarılı! Uygulama hazır.')
  } else {
    console.log('⚠️  Bazı sorunlar tespit edildi. Yukarıdaki hatalara göre işlem yapın.')
  }
}

runChecks().catch(console.error)
