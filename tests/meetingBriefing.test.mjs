import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/meetingBriefing.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const briefingModule = { exports: {} }
new Function('exports', 'module', compiled.outputText)(briefingModule.exports, briefingModule)
const { buildMeetingBriefing } = briefingModule.exports

const now = new Date('2026-08-31T12:00:00+03:00')
const targetMeeting = { id: 'target', status: 'scheduled', scheduled_at: '2026-09-01T10:00:00+03:00' }
const neutralStatus = {
  level: 'yellow',
  label: 'Takip edilmeli',
  reasons: ['Henüz yeterli veri yok.'],
  warnings: [],
  positives: [],
  hasEnoughData: false,
  metrics: {},
}

function build(overrides = {}) {
  return buildMeetingBriefing({
    targetMeeting,
    studentStatus: neutralStatus,
    performance: [],
    tasks: [],
    meetings: [targetMeeting],
    actionItems: [],
    now,
    ...overrides,
  })
}

function actionItem(overrides = {}) {
  return {
    id: 'item-1',
    meeting_id: 'previous',
    student_id: 'student',
    teacher_id: 'teacher',
    item_text: 'Her gün problem çözülecek.',
    kind: 'action',
    status: 'open',
    due_date: null,
    created_at: '2026-08-16T10:00:00+03:00',
    completed_at: null,
    ...overrides,
  }
}

test('ilk görüşmede yakın dönem kullanılır ve eksik veri sahte değişim üretmez', () => {
  const result = build({ performance: [{ date: '2026-08-28', tyt_net: 62, daily_hours: 3 }] })

  assert.equal(result.period.isFirstMeeting, true)
  assert.equal(result.performance.tyt.hasData, false)
  assert.equal(result.warnings.length, 0)
})

test('önceki görüşmeden sonraki performans değişimini hesaplar', () => {
  const previousMeeting = { id: 'previous', status: 'completed', scheduled_at: '2026-08-15T10:00:00+03:00' }
  const result = build({
    meetings: [previousMeeting, targetMeeting],
    performance: [
      { date: '2026-08-16', tyt_net: 64.25, ayt_net: 31, daily_hours: 2 },
      { date: '2026-08-18', tyt_net: 65, ayt_net: 31.5, daily_hours: 2 },
      { date: '2026-08-20', tyt_net: 66, ayt_net: 32, daily_hours: 3 },
      { date: '2026-08-25', tyt_net: 68, ayt_net: 33, daily_hours: 4 },
      { date: '2026-08-27', tyt_net: 69.5, ayt_net: 33.75, daily_hours: 4 },
    ],
  })

  assert.equal(result.period.previousMeetingId, 'previous')
  assert.equal(result.performance.tyt.delta, 5.25)
  assert.equal(result.performance.ayt.delta, 2.75)
  assert.equal(result.performance.weeklyStudyHours.previous, 17.5)
  assert.equal(result.performance.weeklyStudyHours.current, 28)
})

test('açık görüşme kararını sonraki brifingde gösterir', () => {
  const previousMeeting = { id: 'previous', status: 'completed', scheduled_at: '2026-08-15T10:00:00+03:00' }
  const result = build({ meetings: [previousMeeting, targetMeeting], actionItems: [actionItem()] })

  assert.equal(result.previousOpenItems.length, 1)
  assert.equal(result.previousOpenItems[0].item_text, 'Her gün problem çözülecek.')
})

test('tamamlanan ve iptal edilen kararları açık listesine almaz', () => {
  const previousMeeting = { id: 'previous', status: 'completed', scheduled_at: '2026-08-15T10:00:00+03:00' }
  const result = build({
    meetings: [previousMeeting, targetMeeting],
    actionItems: [
      actionItem({ id: 'completed', status: 'completed', completed_at: '2026-08-20T10:00:00+03:00' }),
      actionItem({ id: 'cancelled', status: 'cancelled' }),
    ],
  })

  assert.equal(result.previousOpenItems.length, 0)
})

test('süresi geçen açık kararı işaretler ve uyarıya ekler', () => {
  const previousMeeting = { id: 'previous', status: 'completed', scheduled_at: '2026-08-15T10:00:00+03:00' }
  const result = build({
    meetings: [previousMeeting, targetMeeting],
    actionItems: [actionItem({ due_date: '2026-08-20' })],
  })

  assert.equal(result.previousOpenItems[0].isOverdue, true)
  assert.ok(result.warnings.some(warning => warning.includes('süresi geçti')))
})

test('sıfır performans değerini eksik veriyle karıştırmaz', () => {
  const result = build({
    performance: [
      { date: '2026-08-20', tyt_net: 0 },
      { date: '2026-08-28', tyt_net: 5 },
    ],
  })

  assert.equal(result.performance.tyt.hasData, true)
  assert.equal(result.performance.tyt.previous, 0)
  assert.equal(result.performance.tyt.delta, 5)
})
