import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/studentStatus.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const statusModule = { exports: {} }
new Function('exports', 'module', compiled.outputText)(statusModule.exports, statusModule)
const { calculateStudentStatus } = statusModule.exports

const now = new Date('2026-08-31T12:00:00+03:00')

test('güçlü veriler GREEN sonucu ve açıklanabilir nedenler üretir', () => {
  const result = calculateStudentStatus({
    now,
    performance: [
      { date: '2026-08-20', tyt_net: 60, ayt_net: 35, daily_hours: 3 },
      { date: '2026-08-22', tyt_net: 62, ayt_net: 36, daily_hours: 3.5 },
      { date: '2026-08-27', tyt_net: 68, ayt_net: 41, daily_hours: 4 },
      { date: '2026-08-29', tyt_net: 71, ayt_net: 43, daily_hours: 4.5 },
    ],
    tasks: [
      { status: true, due_date: '2026-08-20' },
      { status: true, due_date: '2026-08-24' },
      { status: true, due_date: '2026-08-28' },
      { status: false, due_date: '2026-09-05' },
    ],
    meetings: [{ status: 'completed', scheduled_at: '2026-08-28T10:00:00+03:00' }],
  })

  assert.equal(result.level, 'green')
  assert.equal(result.metrics.taskCompletionRate, 75)
  assert.ok(result.reasons.length > 0)
  assert.ok(result.positives.some(reason => reason.includes('TYT')))
})

test('birden fazla güçlü negatif sinyal RED sonucu üretir', () => {
  const result = calculateStudentStatus({
    now,
    performance: [
      { date: '2026-08-20', tyt_net: 82, ayt_net: 46, daily_hours: 5 },
      { date: '2026-08-22', tyt_net: 78, ayt_net: 44, daily_hours: 4.5 },
      { date: '2026-08-27', tyt_net: 66, ayt_net: 36, daily_hours: 2 },
      { date: '2026-08-29', tyt_net: 61, ayt_net: 32, daily_hours: 1.5 },
    ],
    tasks: [
      { status: false, due_date: '2026-08-20' },
      { status: false, due_date: '2026-08-21' },
      { status: false, due_date: '2026-09-05' },
      { status: true, due_date: '2026-08-25' },
    ],
    meetings: [{ status: 'completed', scheduled_at: '2026-07-20T10:00:00+03:00' }],
  })

  assert.equal(result.level, 'red')
  assert.equal(result.metrics.performanceTrend, 'down')
  assert.equal(result.metrics.studyTrend, 'down')
  assert.equal(result.metrics.overdueTasks, 2)
  assert.ok(result.warnings.length >= 3)
})

test('tekil dikkat sinyalleri YELLOW sonucu üretir', () => {
  const result = calculateStudentStatus({
    now,
    performance: [],
    tasks: [
      { status: true, due_date: '2026-08-20' },
      { status: false, due_date: '2026-08-25' },
    ],
    meetings: [],
  })

  assert.equal(result.level, 'yellow')
  assert.equal(result.metrics.overdueTasks, 1)
  assert.ok(result.reasons.some(reason => reason.includes('1 görev')))
})

test('verisiz öğrenci RED olmaz ve açık yetersiz veri durumu döner', () => {
  const result = calculateStudentStatus({ now, performance: [], tasks: [], meetings: [] })

  assert.equal(result.level, 'yellow')
  assert.equal(result.hasEnoughData, false)
  assert.match(result.reasons[0], /yeterli veri yok/i)
})

test('sıfır değeri eksik veri sayılmaz', () => {
  const result = calculateStudentStatus({
    now,
    performance: [
      { date: '2026-08-20', tyt_net: 0 },
      { date: '2026-08-28', tyt_net: 4 },
    ],
    tasks: [],
    meetings: [],
  })

  assert.equal(result.metrics.tyt.previous, 0)
  assert.equal(result.metrics.tyt.current, 4)
  assert.equal(result.metrics.tyt.trend, 'up')
  assert.equal(result.level, 'green')
})
