import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const edgeFunction = readFileSync(new URL('../supabase/functions/mentor-ai-insight/index.ts', import.meta.url), 'utf8')
const provider = readFileSync(new URL('../supabase/functions/_shared/aiMentorProvider.ts', import.meta.url), 'utf8')
const clientService = readFileSync(new URL('../src/services/aiMentorService.ts', import.meta.url), 'utf8')

function filesRecursively(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? filesRecursively(path) : [path]
  })
}

test('Edge Function authenticated kullanıcıyı ve mentor-student ilişkisini sunucuda doğrular', () => {
  assert.match(edgeFunction, /supabase\.auth\.getUser\(\)/)
  assert.match(edgeFunction, /callerProfile\.role !== 'teacher'/)
  assert.match(edgeFunction, /canGenerateAIMentorInsight\([\s\S]*mentorId: studentProfile\.mentor_id/)
  assert.match(edgeFunction, /return json\(403, \{ code: 'FORBIDDEN'/)
})

test('client yalnız studentId gönderir ve server client rol iddiasını kabul etmez', () => {
  assert.match(clientService, /body: \{ studentId \}/)
  assert.doesNotMatch(clientService, /teacherId|teacher_id|role:/)
  assert.match(edgeFunction, /Object\.keys\(requestBody\)\.some\(key => key !== 'studentId'\)/)
  assert.doesNotMatch(edgeFunction, /requestBody\.(?:teacherId|teacher_id|role)/)
})

test('server context mevcut deterministic motorlardan yeniden oluşturulur', () => {
  assert.match(edgeFunction, /calculateStudentStatus\(/)
  assert.match(edgeFunction, /calculateGoalProgress\(/)
  assert.match(edgeFunction, /calculateCompetencyMap\(/)
  assert.match(edgeFunction, /calculateMentorAlerts\(/)
  assert.match(edgeFunction, /buildAIMentorContext\(/)
})

test('Gemini provider JSON schema ister ve yanıtı runtime validate eder', () => {
  assert.match(provider, /responseMimeType: 'application\/json'/)
  assert.match(provider, /responseJsonSchema: AI_MENTOR_OUTPUT_JSON_SCHEMA/)
  assert.match(provider, /parseAIMentorInsight\(parsed\)/)
})

test('Gemini API key client bundle kaynaklarında bulunmaz', () => {
  const sourceFiles = filesRecursively(fileURLToPath(new URL('../src', import.meta.url))).filter(path => /\.(?:ts|tsx|js|jsx)$/.test(path))
  const clientBundleSources = sourceFiles.map(path => readFileSync(path, 'utf8')).join('\n')

  assert.doesNotMatch(clientBundleSources, /GEMINI_API_KEY|VITE_GEMINI|generativelanguage\.googleapis\.com|OPENAI_API_KEY|VITE_OPENAI/)
  assert.match(provider, /generativelanguage\.googleapis\.com\/v1beta\/models/)
  assert.doesNotMatch(provider, /api\.openai\.com/)
  assert.match(edgeFunction, /loadAIMentorConfig\(\)/)
  assert.doesNotMatch(edgeFunction, /serviceClient\.from\(/)
})
