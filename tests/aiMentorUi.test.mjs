import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './loadTs.mjs'

const insightPanel = readFileSync(new URL('../src/components/teacher/AIMentorInsightPanel.tsx', import.meta.url), 'utf8')
const mentorSummary = readFileSync(new URL('../src/components/teacher/MentorSummary.tsx', import.meta.url), 'utf8')

test('AI çağrısı yalnız mentor butonuyla başlatılır', () => {
  assert.doesNotMatch(insightPanel, /useEffect/)
  assert.match(insightPanel, /onClick=\{\(\) => void generateInsight\(\)\}/)
  assert.match(insightPanel, /Haftalık AI Değerlendirmesi/)
})

test('AI başarısızlığı mevcut mentor özetini ve domain çıktılarını bozmaz', () => {
  assert.match(insightPanel, /catch \(caughtError\)/)
  assert.match(insightPanel, /aiMentorErrorMessage/)
  assert.match(mentorSummary, /<AIMentorInsightPanel/)
  assert.match(mentorSummary, /Mentor Özeti/)
  assert.match(mentorSummary, /Hedefe İlerleme/)
  assert.match(mentorSummary, /Akademik Yetkinlik/)
})

test('v1 mentor summary does not mount AI UI or expose an AI request handler', () => {
  let aiMounts = 0
  const { default: MentorSummary } = loadTs('src/components/teacher/MentorSummary.tsx', {
    react: { ...React, default: React },
    './AIMentorInsightPanel': { __esModule: true, default: () => { aiMounts++; throw new Error('AI panel must stay unmounted') } },
    './StudentStatusBadge': { __esModule: true, default: () => null },
    '../../lib/competencyMap': { selectCompetencyHighlights: () => ({}) },
    '../../lib/aiMentorContext': { aiMentorWeekKey: () => '2026-W38', buildAIMentorContext: () => ({}) },
  })
  const comparison = { current: null, previous: null }
  const html = renderToStaticMarkup(React.createElement(MentorSummary, {
    displayName: 'Öğrenci',
    status: { hasEnoughData: true, warnings: [], reasons: ['Mevcut değerlendirme'], positives: [],
      metrics: { tyt: comparison, ayt: comparison, studyHours: comparison, taskCompletionRate: null, totalTasks: 0, lastMeetingDays: null } },
    alerts: { studentId: 's', alerts: [] },
    goalProgress: { hasGoal: false },
    competencyMap: { hasReliableData: false },
  }))
  assert.equal(aiMounts, 0)
  assert.doesNotMatch(html, /AI Mentor Yorumu|Haftalık AI Değerlendirmesi|role="alert"|<button/)
  for (const label of ['Mentor Özeti', 'TYT', 'AYT', 'Çalışma', 'Görev uyumu', 'Son görüşme', 'Değerlendirme nedeni', 'Hedefe İlerleme']) {
    assert.ok(html.includes(label), label)
  }
})
