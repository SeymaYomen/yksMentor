import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const read = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
function component(path, mocks = {}) {
  const module = { exports: {} }
  const result = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } })
  new Function('require', 'module', 'exports', result.outputText)(id => id in mocks ? mocks[id] : require(id), module, module.exports)
  return module.exports.default
}
test('loading button cannot be enabled by disabled=false', () => {
  const Button = component('src/components/ui/Button.tsx', { './Spinner': () => React.createElement('span') })
  const html = renderToStaticMarkup(React.createElement(Button, { type: 'submit', loading: true, disabled: false }, 'Save'))
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-busy="true"/)
})
test('error boundary fallback contains no exception payload', () => {
  const Boundary = component('src/components/ErrorBoundary.tsx')
  const instance = new Boundary({ children: React.createElement('p', null, 'normal') })
  instance.state = Boundary.getDerivedStateFromError(new Error('private data'))
  const html = renderToStaticMarkup(instance.render())
  assert.match(html, /role="alert"/); assert.match(html, /type="button"/)
  assert.doesNotMatch(html, /private data|normal/)
})
test('migration chain creates base tables before dependent alterations', () => {
  execFileSync(process.execPath, ['scripts/prepare-migrations.mjs'])
  const files = readdirSync('sql/migrations').filter(name => name.endsWith('.sql')).sort()
  assert.equal(files[0], '202608300001_base_tables.sql')
  assert.equal(new Set(files.map(name => name.split('_')[0])).size, files.length)
  const base = read('sql/migrations/' + files[0])
  for (const table of ['profiles', 'tasks', 'performance', 'meetings']) {
    assert.ok(base.includes('create table if not exists public.' + table))
    assert.ok(base.includes('alter table public.' + table + ' enable row level security'))
  }
  assert.doesNotMatch(base, /drop table|truncate|delete from/i)
  assert.ok(files.indexOf('202608310001_role_auth_foundation.sql') < files.indexOf('202608310002_meeting_briefing_followup.sql'))
  for (const file of files) assert.equal(read('supabase/migrations/' + file), read('sql/migrations/' + file))
})
test('route split preserves protected destinations and has a loading fallback', () => {
  const app = read('src/App.tsx')
  for (const route of ['/teacher', '/student', '/teacher/meetings', '/student/meetings', '/student/activate-teacher']) assert.ok(app.includes('path="' + route + '"'))
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/Teacher\/Dashboard'\)\)/)
  assert.match(app, /<Suspense fallback=/)
  assert.match(app, /requiredRole="teacher"/)
  assert.match(app, /requiredRole="student"/)
})
test('environment template contains only empty public settings', () => {
  assert.equal(read('.env.example').replaceAll('\r\n', '\n').trim(), 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=')
  assert.match(read('.gitignore'), /\.env\.\*\n!\.env\.example/)
})
test('staging scripts require explicit target and keep optional paid calls gated', () => {
  const staging = read('scripts/verify-staging.mjs')
  assert.match(staging, /CONFIRM_STAGING_PROJECT_REF/)
  assert.match(staging, /RUN_OPENAI === 'yes'/)
  assert.match(staging, /RUN_RATE_LIMIT === 'yes'/)
  assert.doesNotMatch(staging, /service\.from\(/)
  assert.match(read('supabase/config.toml'), /verify_jwt = true/)
})

test('task query failure renders an alert rather than the completed/empty state', () => {
  const TaskList = component('src/components/student/TaskList.tsx', {
    '../../hooks/useAuth': { useAuth: () => ({ user: { id: 'student' } }) },
    '../../hooks/useTasks': { useTasks: () => ({ tasks: [], loading: false, error: 'Safe failure', fetchTasks() {}, toggleTaskStatus() {} }) },
  })
  const html = renderToStaticMarkup(React.createElement(TaskList))
  assert.match(html, /role="alert"/)
  assert.match(html, /Safe failure/)
  assert.doesNotMatch(html, /Harika!/)
})
function taskHook(queryResults) {
  const states = []
  let stateIndex = 0
  const react = {
    useState(initial) { const i = stateIndex++; states[i] = initial; return [initial, value => { states[i] = value }] },
    useRef(value) { return { current: value } }, useEffect() {},
  }
  const supabase = { from() { return { select() { return this }, eq() { return this }, order() { return queryResults.shift() } } } }
  const module = { exports: {} }
  const code = ts.transpileModule(read('src/hooks/useTasks.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(id => id === 'react' ? react : { supabase }, module, module.exports)
  return { hook: module.exports.useTasks('student'), states }
}
test('task loader handles null success data', async () => {
  const { hook, states } = taskHook([Promise.resolve({ data: null, error: null })])
  await hook.fetchTasks()
  assert.deepEqual(states[0], [])
  assert.equal(states[1], false)
  assert.equal(states[2], null)
})
test('late task response cannot overwrite newer refresh', async () => {
  let finishOld
  const old = new Promise(resolve => { finishOld = resolve })
  const { hook, states } = taskHook([old, Promise.resolve({ data: [{ id: 'new' }], error: null })])
  const first = hook.fetchTasks()
  await hook.fetchTasks()
  finishOld({ data: [{ id: 'old' }], error: null })
  await first
  assert.deepEqual(states[0], [{ id: 'new' }])
})
test('task loader exposes safe error and clears loading after rejection', async () => {
  const { hook, states } = taskHook([Promise.reject(new Error('private payload'))])
  await hook.fetchTasks()
  assert.deepEqual(states[0], [])
  assert.equal(states[1], false)
  assert.ok(states[2]); assert.doesNotMatch(states[2], /private payload/)
})
