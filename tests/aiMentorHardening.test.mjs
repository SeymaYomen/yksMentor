import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
function load(path, mocks = {}) {
  path = resolve(path)
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', js)(id => id in mocks ? mocks[id] : load(resolve(dirname(path), /\.ts$/.test(id) ? id : id + '.ts'), mocks), module, module.exports)
  return module.exports
}
const ctx = load('src/lib/aiMentorContext.ts')
const { createGeminiMentorProvider } = load('supabase/functions/_shared/aiMentorProvider.ts')
const { loadAIMentorConfig } = load('supabase/functions/_shared/aiMentorConfig.ts')
const output = { summary: 'Summary', meetingTopics: [], mentorActions: [], studentFeedback: 'Feedback' }
const provider = fetchImpl => createGeminiMentorProvider({ apiKey: 'test', model: 'test-model', timeoutMs: 10, fetchImpl })
const json = data => new Response(JSON.stringify(data))
const geminiResponse = (text = JSON.stringify(output), finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts: [{ text }] } }],
})
test('same context with reordered keys has same fingerprint', async () => {
  assert.equal(await ctx.createAIMentorContextFingerprint({ a: 1, b: 2 }), await ctx.createAIMentorContextFingerprint({ b: 2, a: 1 }))
})
test('changed context has different fingerprint', async () => {
  assert.notEqual(await ctx.createAIMentorContextFingerprint({ a: 1 }), await ctx.createAIMentorContextFingerprint({ a: 2 }))
})
test('stale helper handles equal changed and pending fingerprints', () => {
  assert.equal(ctx.isAIMentorInsightStale('a', 'b'), true)
  assert.equal(ctx.isAIMentorInsightStale('a', 'a'), false)
  assert.equal(ctx.isAIMentorInsightStale(null, 'a'), false)
})
for (const [name, result, code] of [
  ['normalized RATE_LIMITED', { error: { message: 'secret', context: json({ code: 'RATE_LIMITED' }) } }, 'RATE_LIMITED'],
  ['malformed Edge response', { data: {} }, 'INVALID_AI_OUTPUT'],
]) test(name, async () => {
  const { SupabaseEdgeAIMentorInsightService } = load('src/services/aiMentorService.ts', {
    '../lib/supabase': { isSupabaseConfigured: true, supabase: { functions: { invoke: async () => result } } },
  })
  await assert.rejects(new SupabaseEdgeAIMentorInsightService().generateMentorInsight('student'), e => e.code === code && !e.message.includes('secret'))
})
test('provider aborts pending fetch', async () => {
  await assert.rejects(provider((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))).generateMentorInsight({}), { code: 'PROVIDER_TIMEOUT' })
})
test('provider timeout covers response body', async () => {
  await assert.rejects(provider(async (url, { signal }) => ({ ok: true, json: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) })).generateMentorInsight({}), { code: 'PROVIDER_TIMEOUT' })
})
test('provider normalizes 429', async () => {
  await assert.rejects(provider(async () => new Response('secret', { status: 429 })).generateMentorInsight({}), { code: 'RATE_LIMITED' })
})
test('provider normalizes network failure', async () => {
  await assert.rejects(provider(async () => { throw new Error('secret') }).generateMentorInsight({}), { code: 'PROVIDER_UNAVAILABLE' })
})
test('missing API key is NOT_CONFIGURED', () => {
  assert.throws(() => loadAIMentorConfig(() => undefined), { code: 'NOT_CONFIGURED' })
  assert.throws(() => createGeminiMentorProvider({ apiKey: '', model: 'test', timeoutMs: 10 }), { code: 'NOT_CONFIGURED' })
})
test('config defaults', () => {
  const config = loadAIMentorConfig(name => ({ GEMINI_API_KEY: 'test', GEMINI_MODEL: 'test' })[name])
  assert.equal(config.minuteLimit, 3); assert.equal(config.dailyLimit, 30); assert.equal(config.timeoutMs, 20000)
  assert.equal(config.provider, 'gemini')
})
test('provider parses usage model latency', async () => {
  const result = await provider(async () => json({ ...geminiResponse(), modelVersion: 'actual', usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 } })).generateMentorInsight({})
  assert.deepEqual(result.output, output)
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 8, totalTokens: 20 })
  assert.equal(result.model, 'actual'); assert.ok(result.latencyMs >= 0)
})
test('provider rejects malformed payloads', async () => {
  for (const payload of [null, [], {}, geminiResponse('{}'), geminiResponse('invalid JSON'),
    geminiResponse(JSON.stringify(output), 'MAX_TOKENS'), geminiResponse(JSON.stringify(output), 'SAFETY')]) {
    await assert.rejects(provider(async () => json(payload)).generateMentorInsight({}), { code: 'INVALID_AI_OUTPUT' })
  }
})

test('Gemini uses header authentication, system instructions and structured JSON on the configured model', async () => {
  const { AI_MENTOR_OUTPUT_JSON_SCHEMA } = load('src/lib/aiMentorOutput.ts')
  const context = { status: { hasEnoughData: true } }
  const result = await createGeminiMentorProvider({ apiKey: 'test', model: 'models/gemini-2.5-flash', timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
      assert.equal(options.headers['x-goog-api-key'], 'test')
      assert.equal(options.headers.Authorization, undefined)
      const body = JSON.parse(options.body)
      assert.ok(body.systemInstruction.parts[0].text.includes('yalnız verilen') || body.systemInstruction.parts[0].text.includes('Yalnız verilen'))
      assert.ok(body.contents[0].parts[0].text.includes(JSON.stringify(context)))
      assert.equal(body.generationConfig.responseMimeType, 'application/json')
      assert.deepEqual(body.generationConfig.responseJsonSchema, AI_MENTOR_OUTPUT_JSON_SCHEMA)
      const response = geminiResponse()
      response.candidates[0].content.parts.unshift({ text: 'internal thought', thought: true })
      return json(response)
    },
  }).generateMentorInsight(context)
  assert.deepEqual(result.output, output)
})

test('Gemini configuration requires both Gemini variables; legacy OpenAI variables are not used', () => {
  for (const env of [{ GEMINI_API_KEY: 'test' }, { GEMINI_MODEL: 'gemini-2.5-flash' },
    { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'test' }, { GEMINI_API_KEY: ' ', GEMINI_MODEL: 'test' }]) {
    assert.throws(() => loadAIMentorConfig(name => env[name]), { code: 'NOT_CONFIGURED' })
  }
})

test('Gemini HTTP errors never leak raw bodies or become application authorization/configuration errors', async () => {
  for (const status of [400, 401, 403, 404, 500, 503]) {
    await assert.rejects(provider(async () => new Response('private provider body', { status })).generateMentorInsight({}),
      error => error.code === 'PROVIDER_UNAVAILABLE' && !error.message.includes('private'))
  }
})
const sql = readFileSync('sql/migrations/202609020002_ai_mentor_usage.sql', 'utf8')
const edge = readFileSync('supabase/functions/mentor-ai-insight/index.ts', 'utf8')
test('migration serializes claims with rolling windows and teacher role', () => {
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /interval '1 minute'/); assert.match(sql, /interval '24 hours'/)
  assert.match(sql, /profile.role = 'teacher'/)
  assert.match(sql, /pg_advisory_xact_lock[^;]+;\s+v_now := clock_timestamp\(\)/)
})
test('usage table and RPC privileges are service-role only', () => {
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public.ai_mentor_usage from public, anon, authenticated/)
  for (const rpc of ['claim_ai_mentor_request', 'complete_ai_mentor_request']) {
    assert.match(sql, new RegExp('revoke all on function public.' + rpc + '[\\s\\S]*?from public, anon, authenticated'))
    assert.match(sql, new RegExp('grant execute on function public.' + rpc + '[\\s\\S]*?to service_role'))
  }
  assert.doesNotMatch(sql, /create policy/i)
})
test('usage schema excludes student and content fields', () => {
  assert.doesNotMatch(sql.slice(sql.indexOf('create table'), sql.indexOf('create index')), /student|prompt|context|meeting|topic/i)
})
test('service-role restricted to telemetry and identity comes from auth', () => {
  assert.doesNotMatch(edge, /serviceClient\.from/)
  assert.match(edge, /p_teacher_id: authData.user.id/)
  assert.doesNotMatch(edge, /requestBody\.(teacherId|teacher_id|role)/)
  assert.ok(edge.indexOf('const config = loadAIMentorConfig()') > edge.indexOf('!canGenerateAIMentorInsight('))
  assert.match(edge, /await complete\('failed'/)
})

function edgeHarness({ allowed = true, foreignStudent = false, contextFailure = false, telemetryFailure = false, providerFailure = false, newStudent = false, progress, missingEnv } = {}) {
  const calls = []
  const studentId = '11111111-1111-4111-8111-111111111111'
  let handler
  const errors = load('src/lib/aiMentorErrors.ts')
  const userClient = {
    auth: { getUser: async () => ({ data: { user: { id: 'authenticated-teacher' } } }) },
    from(table) {
      calls.push(['query', table])
      let id
      const query = {
        select() { return query }, eq(key, value) { if (key === 'id') id = value; return query },
        maybeSingle() { return query },
        order() { return query }, range() { return query }, in() { return query },
        then(resolve) {
          const data = table === 'profiles'
            ? id === 'authenticated-teacher' ? { id, role: 'teacher' } : { id: studentId, username: 'Student', role: 'student', mentor_id: foreignStudent ? 'other-teacher' : 'authenticated-teacher', created_at: newStudent ? new Date().toISOString() : '2026-09-01' }
            : table === 'student_goals' ? null : []
          return Promise.resolve({ data, error: contextFailure && table === 'performance' ? { message: 'private database message' } : null }).then(resolve)
        },
      }
      return query
    },
  }
  const serviceClient = {
    async rpc(name, args) {
      calls.push([name, args])
      if (name === 'claim_ai_mentor_request') return { data: [{ allowed, usage_id: allowed ? 1 : null, retry_after_seconds: 60 }] }
      if (telemetryFailure) throw new Error('private telemetry message')
      return { data: true }
    },
    from() { assert.fail('service-role must never query student data') },
  }
  globalThis.Deno = { env: { get: name => name === missingEnv ? undefined : name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-secret' : 'test' }, serve: fn => { handler = fn } }
  load('supabase/functions/mentor-ai-insight/index.ts', {
    ...(progress ? { '../_shared/mentorProgressData.ts': { loadMentorProgressData: async () => progress } } : {}),
    'npm:@supabase/supabase-js@2.106.2': { createClient(url, key, options) {
      calls.push(['client', key])
      if (key === 'service-secret') return serviceClient
      assert.equal(options.global.headers.Authorization, 'Bearer user-jwt')
      return userClient
    } },
    '../../../src/lib/aiMentorErrors.ts': errors,
    '../_shared/aiMentorProvider.ts': {
      AIMentorProviderError: class extends Error {},
      createGeminiMentorProvider: () => ({ async generateMentorInsight() {
        calls.push(['provider'])
        if (providerFailure) throw new errors.AIMentorServiceError('PROVIDER_TIMEOUT')
        return { output, model: 'test-model', usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }, latencyMs: 5 }
      } }),
    },
  })
  return { calls, request: (body = { studentId }) => handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) }
}
test('Edge success reserves authenticated identity and completes operational telemetry', async () => {
  const h = edgeHarness()
  const response = await h.request()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.insight, output)
  assert.match(body.contextFingerprint, /^[a-f0-9]{64}$/)
  const claim = h.calls.find(([name]) => name === 'claim_ai_mentor_request')[1]
  assert.equal(claim.p_teacher_id, 'authenticated-teacher')
  assert.equal(claim.p_provider, 'gemini')
  const complete = h.calls.find(([name]) => name === 'complete_ai_mentor_request')[1]
  assert.equal(complete.p_request_status, 'succeeded')
  assert.equal(complete.p_total_tokens, 3)
  assert.doesNotMatch(JSON.stringify(complete), /Student|context|prompt|studentId/)
})

test('Edge missing Gemini key or model yields exactly NOT_CONFIGURED/503 before quota or provider', async () => {
  for (const missingEnv of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    const h = edgeHarness({ missingEnv })
    const response = await h.request()
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { code: 'NOT_CONFIGURED' })
    assert.ok(!h.calls.some(([name]) => name === 'provider' || name === 'claim_ai_mentor_request'))
  }
})
test('Edge forbids another mentor student before service-role creation', async () => {
  const h = edgeHarness({ foreignStudent: true })
  const response = await h.request()
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { code: 'FORBIDDEN' })
  assert.equal(h.calls.filter(([name]) => name === 'client').length, 1)
})
test('Edge rejects body teacher identity', async () => {
  const h = edgeHarness()
  assert.equal((await h.request({ studentId: '11111111-1111-4111-8111-111111111111', teacher_id: 'attacker' })).status, 400)
  assert.equal(h.calls.length, 0)
})
test('Edge denied claim stops before academic data and provider', async () => {
  const h = edgeHarness({ allowed: false })
  const response = await h.request()
  assert.equal(response.status, 429)
  assert.deepEqual(await response.json(), { code: 'RATE_LIMITED', retryAfterSeconds: 60 })
  assert.equal(h.calls.filter(([name]) => name === 'query').length, 2)
  assert.ok(!h.calls.some(([name]) => name === 'provider'))
})
test('Edge context failure completes failed claim without raw data', async () => {
  const h = edgeHarness({ contextFailure: true })
  const response = await h.request()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { code: 'CONTEXT_LOAD_FAILED' })
  assert.equal(h.calls.find(([name]) => name === 'complete_ai_mentor_request')[1].p_error_code, 'CONTEXT_LOAD_FAILED')
})
test('Edge provider failure survives telemetry completion failure', async () => {
  const h = edgeHarness({ providerFailure: true, telemetryFailure: true })
  const response = await h.request()
  assert.equal(response.status, 504)
  assert.deepEqual(await response.json(), { code: 'PROVIDER_TIMEOUT' })
})
test('Edge successful output survives telemetry completion failure', async () => {
  const h = edgeHarness({ telemetryFailure: true })
  assert.equal((await h.request()).status, 200)
})

test('daily default remains at least configured minute limit', () => {
  const config = loadAIMentorConfig(name => ({ GEMINI_API_KEY: 'test', GEMINI_MODEL: 'test', AI_MENTOR_MINUTE_LIMIT: '60' })[name])
  assert.equal(config.dailyLimit, 60)
})

test('Edge insufficient/no-data and explicit zero return valid deterministic output without provider calls', async () => {
  for (const performance of [[], [{ date: new Date().toISOString().slice(0, 10), tyt_net: 0, daily_hours: 0 }]]) {
    const h = edgeHarness({ newStudent: true, progress: { performance, exams: [], topicSignals: [] } })
    const response = await h.request()
    assert.equal(response.status, 200)
    const body = await response.json()
    const { parseAIMentorInsightResponse } = load('src/lib/aiMentorOutput.ts')
    assert.equal(parseAIMentorInsightResponse(body).weekKey, ctx.aiMentorWeekKey())
    assert.equal(h.calls.some(([name]) => name === 'provider'), false)
    assert.equal(h.calls.filter(([name]) => name === 'claim_ai_mentor_request').length, 1)
    const complete = h.calls.find(([name]) => name === 'complete_ai_mentor_request')[1]
    assert.equal(complete.p_request_status, 'succeeded')
    assert.equal(complete.p_total_tokens, 0)
    if (performance.length) assert.match(body.insight.summary, /TYT sonucu: 0 net/)
    else assert.match(body.insight.summary, /yeterli kayıt yok/)
  }
})
test('client normalizes rejected invocation', async () => {
  const { SupabaseEdgeAIMentorInsightService } = load('src/services/aiMentorService.ts', {
    '../lib/supabase': { isSupabaseConfigured: true, supabase: { functions: { invoke: async () => { throw new Error('secret') } } } },
  })
  await assert.rejects(new SupabaseEdgeAIMentorInsightService().generateMentorInsight('student'), e => e.code === 'PROVIDER_UNAVAILABLE' && !e.message.includes('secret'))
})
