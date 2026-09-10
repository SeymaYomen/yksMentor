import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function loadIntentModule() {
  const source = readFileSync(new URL('../src/lib/teacherActivationIntent.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const loaded = { exports: {} }
  new Function('exports', 'module', compiled.outputText)(loaded.exports, loaded)
  return loaded.exports
}

function sessionStorageMock() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

const originalWindow = globalThis.window
const storage = sessionStorageMock()
globalThis.window = { sessionStorage: storage }
const intent = loadIntentModule()

test.after(() => {
  globalThis.window = originalWindow
})

test.beforeEach(() => {
  storage.removeItem(intent.TEACHER_ACTIVATION_INTENT)
})

test('student normal login /student hedefine gider', () => {
  assert.equal(intent.authenticatedDestination('student'), '/student')
})

test('student teacher activation intent ile aktivasyon ekranına gider', () => {
  intent.setTeacherActivationIntent()
  assert.equal(intent.authenticatedDestination('student'), '/student/activate-teacher')
})

test('aktivasyon intenti sayfa yenilemesini temsil eden tekrar okumada korunur', () => {
  intent.setTeacherActivationIntent()
  assert.equal(intent.hasTeacherActivationIntent(), true)
  assert.equal(intent.authenticatedDestination('student'), '/student/activate-teacher')
  assert.equal(intent.hasTeacherActivationIntent(), true)
})

test('mevcut teacher login /teacher hedefine gider ve eski intenti temizler', () => {
  intent.setTeacherActivationIntent()
  assert.equal(intent.authenticatedDestination('teacher'), '/teacher')
  assert.equal(intent.hasTeacherActivationIntent(), false)
})

test('tamamlanan veya iptal edilen akıştan sonra normal student login etkilenmez', () => {
  intent.setTeacherActivationIntent()
  intent.clearTeacherActivationIntent()
  assert.equal(intent.authenticatedDestination('student'), '/student')
})

test('login intenti auth çağrısından önce yazar ve bağımsız navigate sahibi değildir', () => {
  const login = readFileSync(new URL('../src/pages/Auth/Login.tsx', import.meta.url), 'utf8')
  assert.ok(login.indexOf('setTeacherActivationIntent()') < login.indexOf('await auth.login'))
  assert.ok(login.indexOf('clearTeacherActivationIntent()') < login.indexOf('await auth.login'))
  assert.doesNotMatch(login, /useNavigate|navigate\(/)
})

test('PublicRoute authenticated yönlendirmeyi ortak helper üzerinden sahiplenir', () => {
  const guard = readFileSync(new URL('../src/components/ProtectedRoute.tsx', import.meta.url), 'utf8')
  assert.match(guard, /authenticatedDestination\(user\.role\)/)
})

test('valid redeem yalnız refreshed teacher rolünde intenti temizleyip yönlendirir', () => {
  const activation = readFileSync(new URL('../src/pages/Auth/TeacherInviteActivation.tsx', import.meta.url), 'utf8')
  const redeem = activation.indexOf('await redeemTeacherInvite(inviteCode)')
  const roleCheck = activation.indexOf("result.user?.role !== 'teacher'")
  const clear = activation.indexOf('clearTeacherActivationIntent()', roleCheck)
  const redirect = activation.indexOf("navigate('/teacher'", clear)
  assert.ok(redeem >= 0 && roleCheck > redeem && clear > roleCheck && redirect > clear)
})

test('invalid redeem hata dalında ekranda kalır ve intenti temizlemez', () => {
  const activation = readFileSync(new URL('../src/pages/Auth/TeacherInviteActivation.tsx', import.meta.url), 'utf8')
  const errorStart = activation.indexOf('if (result.error)')
  const roleCheck = activation.indexOf("result.user?.role !== 'teacher'")
  const errorBranch = activation.slice(errorStart, roleCheck)
  assert.match(errorBranch, /showError\(result\.error\.message\)/)
  assert.doesNotMatch(errorBranch, /clearTeacherActivationIntent|navigate\('/)
})
