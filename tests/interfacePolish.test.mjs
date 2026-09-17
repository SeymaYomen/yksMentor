import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import tailwind from 'tailwindcss'

const require = createRequire(import.meta.url)
const read = path => readFileSync(path, 'utf8')
function moduleAt(path, mocks = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  new Function('require', 'module', 'exports', compiled.outputText)(id => id in mocks ? mocks[id] : require(id), module, module.exports)
  return module.exports
}
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const format = moduleAt('src/lib/format.ts')
const Card = moduleAt('src/components/ui/Card.tsx').default
const Spinner = () => React.createElement('span', null, 'Loading')
const Link = ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children)
const router = { Link, useLocation: () => ({ pathname: '/student' }) }

test('mobile and desktop menus expose the current page and daily work first', () => {
  const Sidebar = moduleAt('src/components/Layout/Sidebar.tsx', { 'react-router-dom': router }).default
  const html = render(Sidebar, { role: 'student' })
  assert.match(html, /aria-label="Ana menü"/)
  assert.match(html, /aria-label="Alt menü"/)
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 2)
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(links, ['/student', '/student/exams', '/student/meetings', '/student', '/student/exams', '/student/meetings'])
})

test('compiled responsive CSS matches bottom navigation and content clearance at lg', async () => {
  const result = await postcss([tailwind({ content: [
    { raw: read('src/components/Layout/Sidebar.tsx'), extension: 'tsx' },
    { raw: read('src/components/Layout/DashboardLayout.tsx'), extension: 'tsx' },
  ] })]).process(read('src/index.css'), { from: undefined })
  const rules = []
  result.root.walkRules(rule => rules.push(rule))
  const nav = rules.find(rule => rule.selector === '.dashboard-bottom-nav')
  assert.match(nav.toString(), /height: calc\(var\(--bottom-nav-height\) \+ env\(safe-area-inset-bottom, 0px\)\)/)
  const content = rules.filter(rule => rule.selector === '.dashboard-content')
  assert.ok(content.some(rule => /padding-bottom: calc\(var\(--bottom-nav-height\) \+ env\(safe-area-inset-bottom, 0px\) \+ 1.5rem\)/.test(rule.toString())))
  assert.ok(rules.some(rule => rule.selector === '.lg\\:hidden' && rule.parent.params === '(min-width: 1024px)' && /display: none/.test(rule.toString())))
  assert.ok(rules.some(rule => rule.selector === '.lg\\:block' && rule.parent.params === '(min-width: 1024px)' && /display: block/.test(rule.toString())))
  assert.ok(content.some(rule => rule.parent.params === '(min-width: 1024px)' && /padding-bottom: 2rem/.test(rule.toString())))
})

test('keyboard skip target, focus and reduced motion remain available', () => {
  assert.match(read('src/components/Layout/Navbar.tsx'), /href="#main-content"/)
  assert.match(read('src/components/Layout/DashboardLayout.tsx'), /id="main-content" tabIndex=\{-1\}/)
  const css = read('src/index.css')
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /scroll-margin-block/)
  assert.match(css, /font-variant-numeric: tabular-nums/)
})

const timeline = moduleAt('src/components/meetings/MeetingTimelineHeading.tsx', { '../../lib/format': format })
test('timeline labels distinguish today, remaining days, completion and missing dates', () => {
  const now = new Date(2026, 8, 12, 12)
  assert.equal(timeline.meetingDayLabel(new Date(2026, 8, 12, 18).toISOString(), 'scheduled', now), 'Bugün')
  assert.equal(timeline.meetingDayLabel(new Date(2026, 8, 15, 18).toISOString(), 'scheduled', now), '3 gün kaldı')
  assert.equal(timeline.meetingDayLabel(null, 'completed', now), 'Tamamlandı')
  assert.equal(timeline.meetingDayLabel(null, 'cancelled', now), 'İptal edildi')
  assert.equal(timeline.meetingDayLabel(null, 'scheduled', now), 'Tarih bekleniyor')
})
test('timeline renders semantic date/time and a muted completed heading', () => {
  const html = render(timeline.default, { title: 'Görüşme', person: 'Öğrenci', scheduledAt: '2026-09-12T12:00:00Z', status: 'completed', isTeacher: true })
  assert.match(html, /dateTime="2026-09-12T12:00:00Z"/i)
  assert.match(html, /Tamamlandı/)
  assert.match(html, /bg-slate-100 text-slate-600/)
  assert.match(html, /Öğrenci: Öğrenci/)
})
test('meeting view never labels loading or failed briefing as ready', () => {
  const source = read('src/pages/Meetings.tsx')
  assert.match(source, /guidanceLoading \? <p role="status"/)
  assert.match(source, /!guidanceError && briefingsByMeeting\[m.id\]/)
  assert.match(source, /Brifingi Aç/)
  assert.match(source, /Bağlantı henüz eklenmedi/)
  assert.doesNotMatch(source, /\{meetingsError.message\}|\{guidanceError.message\}/)
})

function tasksHtml(tasks, extra = {}) {
  const TaskList = moduleAt('src/components/student/TaskList.tsx', {
    '../../hooks/useAuth': { useAuth: () => ({ user: { id: 'student' } }) },
    '../../hooks/useTasks': { useTasks: () => ({ tasks, loading: false, error: null, fetchTasks() {}, toggleTaskStatus() {}, ...extra }) },
  }).default
  return render(TaskList, { studentId: 'student' })
}
test('tasks emphasize today without styling today as overdue', () => {
  const today = new Date()
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const html = tasksHtml([{ id: 't', title: 'Paragraf', status: false, due_date: date }])
  assert.match(html, /Bugün ne yapmalıyım\?/)
  assert.match(html, />Bugün</)
  assert.doesNotMatch(html, /text-red-700 font-medium/)
})
test('task loading does not claim zero open tasks; completed tasks stay collapsed', () => {
  const loading = tasksHtml([], { loading: true })
  assert.match(loading, /role="status"/)
  assert.doesNotMatch(loading, /0 açık|Henüz görev yok/)
  const completed = tasksHtml([{ id: 'done', title: 'Tamamlanan', status: true }])
  assert.match(completed, /Açık görevin yok/)
  assert.match(completed, /<details/)
  assert.doesNotMatch(completed, /<details[^>]+open/)
})

function chartHtml(data, error = null) {
  const Chart = moduleAt('src/components/student/StudentPerformanceChart.tsx', {
    '../ui/Spinner': Spinner,
    '../../hooks/usePerformance': () => ({ data, loading: false, error }),
    '../../lib/format': format,
  }).default
  return render(Chart, { studentId: 'student' })
}
test('study chart is compact for absent or single duration and preserves real zero', () => {
  assert.match(chartHtml([{ daily_hours: null, tyt_net: 70 }]), /Henüz çalışma kaydı yok/)
  const one = chartHtml([{ daily_hours: 0, date: '2026-09-12' }])
  assert.match(one, /0,00 saat/)
  assert.match(one, /İkinci kayıttan sonra/)
  assert.doesNotMatch(one, /recharts/)
})
test('study chart error is safe and is not an empty success state', () => {
  const html = chartHtml([], new Error('private connection payload'))
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /private connection|Henüz çalışma kaydı yok/)
})

test('insufficient students without observed alerts do not appear in attention cards', () => {
  const Center = moduleAt('src/components/teacher/EarlyWarningCenter.tsx', {
    'react-router-dom': router, '../ui/Card': Card, '../ui/Spinner': Spinner,
    '../../lib/mentorAlerts': { MENTOR_PRIORITY_ORDER: { critical: 0, high: 1, medium: 2, low: 3 } },
    '../../lib/teacherOverview': moduleAt('src/lib/teacherOverview.ts'),
  }).default
  const html = render(Center, { students: [{ id: 'a', username: 'Yetersiz veri', alerts: { priority: 'low', alerts: [] }, status: { hasEnoughData: false, metrics: { nextMeetingAt: null } } }], loading: false, error: null })
  assert.match(html, /Veri birikiyor/)
  assert.doesNotMatch(html, /<article|Kritik|Yetersiz veri/)
})
test('neutral student status retains its neutral visual treatment', () => {
  const Badge = moduleAt('src/components/teacher/StudentStatusBadge.tsx').default
  const html = render(Badge, { status: { level: 'neutral', label: 'Veri bekleniyor' } })
  assert.match(html, /bg-gray-50 text-gray-600/)
  assert.doesNotMatch(html, /bg-red|bg-amber/)
})

function aiPanel(initial = {}, generated = async () => { throw new Error('private backend payload') }) {
  const states = [initial.results ?? {}, initial.loading ?? {}, initial.errors ?? {}]
  let index = 0, refIndex = 0
  const refs = []
  const react = { ...React, useId: () => 'ai-test', useRef: initial => refs[refIndex++] ??= { current: initial }, useState: () => {
    const i = index++
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
  } }
  const errors = moduleAt('src/lib/aiMentorErrors.ts')
  const Panel = moduleAt('src/components/teacher/AIMentorInsightPanel.tsx', {
    react,
    '../../services/aiMentorService': { aiMentorInsightService: { generateMentorInsight: generated } },
    '../../lib/aiMentorErrors': errors,
    '../../lib/aiMentorContext': moduleAt('src/lib/aiMentorContext.ts'),
  }).default
  return { tree(props = {}) { index = 0; refIndex = 0; return Panel({ studentId: 'student', currentFingerprint: 'fresh', ...props }) }, states, errors }
}
const insight = { contextFingerprint: 'fresh', generatedAt: new Date().toISOString(), insight: { summary: 'Özet metni', meetingTopics: [], mentorActions: [], studentFeedback: 'Geri bildirim' } }
const markup = tree => renderToStaticMarkup(tree)
function buttons(tree) {
  if (!React.isValidElement(tree)) return []
  return [ ...(tree.type === 'button' ? [tree] : []), ...React.Children.toArray(tree.props.children).flatMap(buttons) ]
}
test('AI freshness, stale refresh and transparency are visible without backend details', () => {
  const panel = aiPanel({ results: { student: insight } })
  assert.match(markup(panel.tree()), /Güncel/)
  const stale = markup(panel.tree({ currentFingerprint: 'changed' }))
  assert.match(stale, /Hafta veya öğrenci verileri değişti\./)
  assert.match(stale, /Haftalık AI Değerlendirmesi/)
  assert.doesNotMatch(stale, />Güncel</)
  assert.match(stale, /Bu yorum öğrencinin hedef, performans, görev, konu yeterliliği ve aktif uyarı verilerine dayanır\./)
  assert.doesNotMatch(markup(panel.tree({ currentFingerprint: null })), />Güncel</)
})
test('AI unavailable errors are safe and repeat clicks cannot duplicate a pending call', async () => {
  let reject, calls = 0
  const panel = aiPanel({}, () => { calls++; return new Promise((_, fail) => { reject = fail }) })
  const button = buttons(panel.tree())[0]
  button.props.onClick(); button.props.onClick()
  assert.equal(calls, 1)
  assert.equal(buttons(panel.tree())[0].props.disabled, true)
  reject(new Error('private backend payload'))
  await new Promise(resolve => setImmediate(resolve))
  const html = markup(panel.tree())
  assert.match(html, /AI Mentor şu anda kullanılamıyor\./)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /private backend payload/)
  assert.equal(buttons(panel.tree())[0].props.disabled, false)
})
test('dashboard hierarchy keeps tasks and attention before secondary summaries', () => {
  const student = read('src/pages/Student/Dashboard.tsx')
  assert.ok(student.indexOf('<TaskList') < student.indexOf('Sıradaki Mentor Görüşmen'))
  assert.ok(student.indexOf('<MockExamSummary') < student.indexOf('<PerformanceForm'))
  assert.ok(student.indexOf('<GoalProgressCard') < student.indexOf('<PerformanceForm'))
  assert.ok(student.indexOf('<PerformanceForm') < student.indexOf('<TopicCompetencyMap'))
  const teacher = read('src/pages/Teacher/Dashboard.tsx')
  assert.ok(teacher.indexOf('<EarlyWarningCenter') < teacher.indexOf('<StudentList'))
  assert.ok(teacher.indexOf('<StudentList') < teacher.indexOf('<MentorSummary'))
})
