import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

import { loadTs } from './loadTs.mjs'
const goalModule = { exports: loadTs('src/lib/goalProgress.ts') }

const { calculateGoalProgress, validateGoalInput } = goalModule.exports

const now = new Date('2026-08-31T12:00:00+03:00')

function goal(overrides = {}) {
  return {
    id: 'goal',
    student_id: 'student',
    created_by: 'teacher',
    goal_type: 'net',
    score_type: 'sayisal',
    university_name: null,
    program_name: null,
    target_rank: null,
    target_score: null,
    target_tyt_net: 85,
    target_ayt_net: 55,
    target_date: '2027-06-01',
    is_active: true,
    created_at: '2026-08-01T10:00:00+03:00',
    updated_at: '2026-08-01T10:00:00+03:00',
    archived_at: null,
    ...overrides,
  }
}

test('TYT ve AYT hedef mesafelerini gerçek son kayıttan hesaplar', () => {
  const result = calculateGoalProgress({
    goal: goal(),
    performance: [
      { date: '2026-08-05', tyt_net: 63.5, ayt_net: 35 },
      { date: '2026-08-28', tyt_net: 71.25, ayt_net: 42 },
    ],
    now,
  })

  assert.equal(result.metrics.tyt.remaining, 13.75)
  assert.equal(result.metrics.ayt.remaining, 13)
  assert.equal(result.metrics.tyt.change30Days, 7.75)
  assert.equal(result.status, 'approaching')
})

test('hedef aşılmışsa kalan farkı negatif üretmez', () => {
  const result = calculateGoalProgress({
    goal: goal({ target_tyt_net: 70, target_ayt_net: null }),
    performance: [{ date: '2026-08-20', tyt_net: 68 }, { date: '2026-08-28', tyt_net: 74 }],
    now,
  })

  assert.equal(result.metrics.tyt.remaining, 0)
  assert.equal(result.metrics.tyt.reached, true)
  assert.equal(result.status, 'achieved')
  assert.equal(result.label, 'Hedefe ulaşıldı')
})

test('yaklaşan, durağan ve uzaklaşan trendleri sınıflandırır', () => {
  const approaching = calculateGoalProgress({ goal: goal({ target_ayt_net: null }), performance: [{ date: '2026-08-10', tyt_net: 60 }, { date: '2026-08-28', tyt_net: 65 }], now })
  const stable = calculateGoalProgress({ goal: goal({ target_ayt_net: null }), performance: [{ date: '2026-08-10', tyt_net: 60 }, { date: '2026-08-28', tyt_net: 60.5 }], now })
  const movingAway = calculateGoalProgress({ goal: goal({ target_ayt_net: null }), performance: [{ date: '2026-08-10', tyt_net: 65 }, { date: '2026-08-28', tyt_net: 61 }], now })

  assert.equal(approaching.status, 'approaching')
  assert.equal(stable.status, 'stable')
  assert.equal(movingAway.status, 'moving_away')
})

test('tek performans kaydında mesafeyi gösterir fakat trendi yetersiz sayar', () => {
  const result = calculateGoalProgress({ goal: goal(), performance: [{ date: '2026-08-28', tyt_net: 70, ayt_net: 40 }], now })

  assert.equal(result.metrics.tyt.remaining, 15)
  assert.equal(result.status, 'insufficient_data')
})

test('performans yoksa ilerleme verisini yetersiz sayar', () => {
  const result = calculateGoalProgress({ goal: goal(), performance: [], now })

  assert.equal(result.status, 'insufficient_data')
  assert.equal(result.metrics.tyt.current, null)
  assert.equal(result.metrics.ayt.current, null)
})

test('iki net hedefinin ikisi de karşılandığında hedefe ulaşıldı sonucunu üretir', () => {
  const result = calculateGoalProgress({
    goal: goal(),
    performance: [{ date: '2026-08-28', tyt_net: 85, ayt_net: 57 }],
    now,
  })

  assert.equal(result.status, 'achieved')
  assert.equal(result.metrics.tyt.remaining, 0)
  assert.equal(result.metrics.ayt.remaining, 0)
})

test('sıralama hedefinden sahte sıralama tahmini üretmez', () => {
  const result = calculateGoalProgress({
    goal: goal({ goal_type: 'rank', target_rank: 8000, target_tyt_net: null, target_ayt_net: null }),
    performance: [{ date: '2026-08-28', tyt_net: 70, ayt_net: 40 }],
    now,
  })

  assert.equal(result.reliableRankEstimateAvailable, false)
  assert.match(result.rankEstimateMessage, /güvenilir sıralama/i)
  assert.equal(result.status, 'insufficient_data')
})

test('sıfır hedef ve performans değerini veri eksikliğiyle karıştırmaz', () => {
  const result = calculateGoalProgress({
    goal: goal({ target_tyt_net: 0, target_ayt_net: null }),
    performance: [{ date: '2026-08-20', tyt_net: 0 }, { date: '2026-08-28', tyt_net: 0 }],
    now,
  })

  assert.equal(result.metrics.tyt.current, 0)
  assert.equal(result.metrics.tyt.remaining, 0)
  assert.equal(result.metrics.tyt.status, 'achieved')
  assert.equal(result.status, 'achieved')
})

test('hedef tarihi geçmişse yol haritasına açık uyarı ekler', () => {
  const result = calculateGoalProgress({ goal: goal({ target_date: '2026-08-01' }), performance: [], now })

  assert.equal(result.targetDatePassed, true)
  assert.match(result.roadmap[0], /hedef tarihi geçti/i)
})

test('hedef formu sınırları ve tarih doğrulaması merkezi kuralları kullanır', () => {
  assert.deepEqual(validateGoalInput({ goalType: 'net', targetTytNet: 120, targetAytNet: 0 }), [])
  assert.match(validateGoalInput({ goalType: 'net', targetTytNet: 121 })[0], /0-120/)
  assert.match(validateGoalInput({ goalType: 'rank', targetRank: 2.5 })[0], /pozitif bir tam sayı/)
  assert.match(validateGoalInput({ goalType: 'net', targetTytNet: 50, targetDate: '2026-02-30' })[0], /geçerli bir tarih/)
})

test('yol haritası büyük göreli açığı, yükselişi ve görev sürekliliğini üst seviyede açıklar', () => {
  const result = calculateGoalProgress({
    goal: goal(),
    performance: [
      { date: '2026-08-05', tyt_net: 63, ayt_net: 41 },
      { date: '2026-08-28', tyt_net: 71, ayt_net: 42 },
    ],
    studentStatus: {
      metrics: { taskCompletionRate: 68, studyTrend: 'stable', overdueTasks: 0 },
    },
    now,
  })

  assert.match(result.roadmap[0], /AYT açığı/)
  assert.match(result.roadmap[1], /TYT yükselişi/)
  assert.match(result.roadmap[2], /Görev uyumu %68/)
  assert.doesNotMatch(result.roadmap.join(' '), /fonksiyon|problem|türev/i)
})

test('güvenilir akademik içgörüyü açık hedef tarafına gözlemsel olarak bağlar', () => {
  const result = calculateGoalProgress({
    goal: goal({ target_ayt_net: null }),
    performance: [
      { date: '2026-08-05', tyt_net: 60 },
      { date: '2026-08-28', tyt_net: 65 },
    ],
    academicInsights: [{ examType: 'TYT', topicName: 'Geometri', status: 'weak', trend: 'declining' }],
    now,
  })

  assert.match(result.roadmap.join(' '), /TYT tarafında Geometri dikkat gerektiriyor/)
  assert.doesNotMatch(result.roadmap.join(' '), /net kazandırır|soru çöz/)
})
