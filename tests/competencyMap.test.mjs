import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/competencyMap.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const competencyModule = { exports: {} }
new Function('exports', 'module', compiled.outputText)(competencyModule.exports, competencyModule)
const { calculateTopicCompetency, calculateCompetencyMap, selectCompetencyHighlights } = competencyModule.exports

function row(correctCount, wrongCount, observedAt, overrides = {}) {
  return {
    topicId: 'problems',
    topicName: 'Problemler',
    topicIsActive: true,
    subjectId: 'math',
    subjectName: 'Matematik',
    examType: 'TYT',
    correctCount,
    wrongCount,
    blankCount: 0,
    observedAt,
    ...overrides,
  }
}

test('yüksek doğruluk ve yeterli veri güçlü yetkinlik üretir', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(8, 2, '2026-08-01'), row(9, 1, '2026-08-10')],
  })

  assert.equal(result.status, 'strong')
  assert.equal(result.evidence.recentAccuracy, 0.85)
})

test('düşük doğruluk ve yeterli veri zayıf yetkinlik üretir', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(3, 7, '2026-08-01'), row(4, 6, '2026-08-10')],
  })

  assert.equal(result.status, 'weak')
})

test('iyileşen doğruluk serisini improving olarak sınıflandırır', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(4, 6, '2026-08-01'), row(5, 5, '2026-08-10'), row(7, 3, '2026-08-20')],
  })

  assert.equal(result.trend, 'improving')
  assert.equal(result.status, 'developing')
})

test('düşen doğruluk serisini declining olarak sınıflandırır', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(8, 2, '2026-08-01'), row(5, 5, '2026-08-10'), row(3, 7, '2026-08-20')],
  })

  assert.equal(result.trend, 'declining')
})

test('anlamlı değişim olmayan seri stable kalır', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(6, 4, '2026-08-01'), row(6, 4, '2026-08-10'), row(6, 4, '2026-08-20')],
  })

  assert.equal(result.trend, 'stable')
  assert.equal(result.status, 'developing')
})

test('tek ölçüm güvenilir sınıflandırma üretmez', () => {
  const result = calculateTopicCompetency({ topicPerformances: [row(10, 0, '2026-08-01')] })
  assert.equal(result.status, 'insufficient_data')
  assert.equal(result.trend, 'insufficient_data')
})

test('sıfır yanlış eksik veri sayılmaz', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(5, 0, '2026-08-01'), row(5, 0, '2026-08-10')],
  })

  assert.equal(result.evidence.wrong, 0)
  assert.equal(result.evidence.recentAccuracy, 1)
  assert.equal(result.status, 'strong')
})

test('az soru sayısı güçlü veya zayıf şeklinde aşırı sınıflandırılmaz', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [row(1, 0, '2026-08-01'), row(0, 1, '2026-08-10')],
  })

  assert.equal(result.status, 'insufficient_data')
})

test('yalnız yanlış sayıları olan tekrarlı ölçümleri yorumlar', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [
      row(null, 3, '2026-08-01'),
      row(null, 3, '2026-08-10'),
    ],
  })

  assert.equal(result.evidence.recentAccuracy, null)
  assert.equal(result.status, 'weak')
})

test('hiç sorulmayan sıfır toplamlı satırları ölçüm saymaz', () => {
  const result = calculateTopicCompetency({
    topicPerformances: [
      row(0, 0, '2026-08-01'),
      row(8, 2, '2026-08-10'),
    ],
  })

  assert.equal(result.evidence.attempts, 1)
  assert.equal(result.status, 'insufficient_data')
})

test('pasif konu geçmiş kanıtını korur ve anlamlı özet yalnız güvenilir konuları seçer', () => {
  const map = calculateCompetencyMap([
    row(3, 7, '2026-08-01', { topicIsActive: false }),
    row(3, 7, '2026-08-10', { topicIsActive: false }),
    row(10, 0, '2026-08-10', { topicId: 'single', topicName: 'Tek Ölçüm' }),
  ])
  const highlights = selectCompetencyHighlights(map)

  assert.equal(map.weak[0].topicIsActive, false)
  assert.equal(highlights.attention[0].topicName, 'Problemler')
  assert.equal(map.insufficient.length, 1)
})
