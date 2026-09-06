import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const insightPanel = readFileSync(new URL('../src/components/teacher/AIMentorInsightPanel.tsx', import.meta.url), 'utf8')
const mentorSummary = readFileSync(new URL('../src/components/teacher/MentorSummary.tsx', import.meta.url), 'utf8')

test('AI çağrısı yalnız mentor butonuyla başlatılır', () => {
  assert.doesNotMatch(insightPanel, /useEffect/)
  assert.match(insightPanel, /onClick=\{\(\) => void generateInsight\(\)\}/)
  assert.match(insightPanel, /Yorum Oluştur/)
})

test('AI başarısızlığı mevcut mentor özetini ve domain çıktılarını bozmaz', () => {
  assert.match(insightPanel, /catch \(caughtError\)/)
  assert.match(insightPanel, /aiMentorErrorMessage/)
  assert.match(mentorSummary, /<AIMentorInsightPanel/)
  assert.match(mentorSummary, /Mentor Özeti/)
  assert.match(mentorSummary, /Hedefe İlerleme/)
  assert.match(mentorSummary, /Akademik Yetkinlik/)
})
