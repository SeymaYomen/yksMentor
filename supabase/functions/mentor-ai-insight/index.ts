import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { canGenerateAIMentorInsight } from '../../../src/lib/aiMentorAuthorization.ts'
import { buildAIMentorContext, createAIMentorContextFingerprint } from '../../../src/lib/aiMentorContext.ts'
import { calculateCompetencyMap, type TopicPerformanceSignal } from '../../../src/lib/competencyMap.ts'
import { calculateGoalProgress, type StudentGoal } from '../../../src/lib/goalProgress.ts'
import type { MeetingActionItem } from '../../../src/lib/meetingBriefing.ts'
import { calculateMentorAlerts } from '../../../src/lib/mentorAlerts.ts'
import { calculateStudentStatus, type MeetingSignal, type PerformanceSignal, type TaskSignal } from '../../../src/lib/studentStatus.ts'
import { AIMentorServiceError, type AIMentorErrorCode } from '../../../src/lib/aiMentorErrors.ts'
import { loadAIMentorConfig } from '../_shared/aiMentorConfig.ts'
import { AIMentorProviderError, createOpenAIMentorProvider } from '../_shared/aiMentorProvider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ProfileRow = {
  id: string
  username: string
  created_at: string | null
  mentor_id: string | null
  role: string | null
}

type PerformanceRow = PerformanceSignal & { student_id: string }
type TaskRow = TaskSignal & { student_id: string }
type MeetingRow = MeetingSignal & { student_id: string }
type TopicPerformanceRow = {
  topic_id: string
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  observed_at: string | null
  created_at: string | null
}
type SubjectRow = { id: string; exam_type: 'TYT' | 'AYT'; name: string; is_active: boolean }
type TopicRow = { id: string; subject_id: string; name: string; is_active: boolean }

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new AIMentorServiceError('NOT_CONFIGURED')
  return value
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const errorStatus: Record<AIMentorErrorCode, number> = {
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, RATE_LIMITED: 429,
  NOT_CONFIGURED: 503, PROVIDER_TIMEOUT: 504, PROVIDER_UNAVAILABLE: 502,
  INVALID_AI_OUTPUT: 502, CONTEXT_LOAD_FAILED: 500, INTERNAL_ERROR: 500,
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { code: 'BAD_REQUEST' })

  let serviceClient: ReturnType<typeof createClient> | null = null
  let usageId: number | null = null
  let model = ''
  async function complete(status: 'succeeded' | 'failed', code: AIMentorErrorCode | null, usage?: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }, latencyMs?: number) {
    if (!serviceClient || usageId === null) return
    try {
      const { error } = await serviceClient.rpc('complete_ai_mentor_request', {
        p_usage_id: usageId, p_request_status: status, p_model: model,
        p_input_tokens: usage?.inputTokens ?? null, p_output_tokens: usage?.outputTokens ?? null,
        p_total_tokens: usage?.totalTokens ?? null, p_latency_ms: latencyMs ?? null, p_error_code: code,
      })
      if (error) console.error('AI telemetry completion failed')
    } catch { console.error('AI telemetry completion failed') }
  }
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return json(401, { code: 'UNAUTHORIZED' })

    let requestBody: Record<string, unknown>
    try {
      const parsed = await request.json()
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('invalid')
      requestBody = parsed as Record<string, unknown>
    } catch {
      return json(400, { code: 'BAD_REQUEST' })
    }
    if (Object.keys(requestBody).some(key => key !== 'studentId') || !isUuid(requestBody.studentId)) {
      return json(400, { code: 'BAD_REQUEST' })
    }

    const supabase = createClient(
      requiredEnvironment('SUPABASE_URL'),
      requiredEnvironment('SUPABASE_ANON_KEY'),
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return json(401, { code: 'UNAUTHORIZED' })

    const { data: callerProfile, error: callerError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (callerError || !callerProfile || callerProfile.role !== 'teacher') {
      return json(403, { code: 'FORBIDDEN' })
    }

    const { data: studentProfileData, error: studentError } = await supabase
      .from('profiles')
      .select('id, username, created_at, mentor_id, role')
      .eq('id', requestBody.studentId)
      .maybeSingle()
    const studentProfile = studentProfileData as ProfileRow | null
    if (studentError || !studentProfile || !canGenerateAIMentorInsight(
      { id: authData.user.id, role: callerProfile.role },
      { id: studentProfile.id, mentorId: studentProfile.mentor_id, role: studentProfile.role },
    )) {
      return json(403, { code: 'FORBIDDEN' })
    }

    const config = loadAIMentorConfig()
    model = config.model
    serviceClient = createClient(requiredEnvironment('SUPABASE_URL'), requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: claims, error: claimError } = await serviceClient.rpc('claim_ai_mentor_request', {
      p_teacher_id: authData.user.id, p_provider: config.provider, p_model: config.model,
      p_minute_limit: config.minuteLimit, p_daily_limit: config.dailyLimit,
    })
    const claim = claims?.[0]
    if (claimError || !claim || typeof claim.allowed !== 'boolean') throw new AIMentorServiceError('INTERNAL_ERROR')
    if (!claim.allowed) return json(429, { code: 'RATE_LIMITED', retryAfterSeconds: claim.retry_after_seconds })
    if (!claim.usage_id) throw new AIMentorServiceError('INTERNAL_ERROR')
    usageId = claim.usage_id
    const studentId = studentProfile.id
    const [performanceResult, taskResult, meetingResult, goalResult, actionItemResult, topicPerformanceResult, subjectResult, topicResult] = await Promise.all([
      supabase.from('performance').select('student_id, daily_hours, tyt_net, ayt_net, date, created_at').eq('student_id', studentId),
      supabase.from('tasks').select('student_id, status, due_date').eq('student_id', studentId),
      supabase.from('meetings').select('student_id, status, scheduled_at').eq('student_id', studentId),
      supabase.from('student_goals').select('*').eq('student_id', studentId).eq('is_active', true).maybeSingle(),
      supabase.from('meeting_action_items').select('*').eq('student_id', studentId),
      supabase.from('exam_topic_performance').select('topic_id, correct_count, wrong_count, blank_count, observed_at, created_at').eq('student_id', studentId),
      supabase.from('exam_subjects').select('id, exam_type, name, is_active'),
      supabase.from('exam_topics').select('id, subject_id, name, is_active'),
    ])

    const failedResult = [performanceResult, taskResult, meetingResult, goalResult, actionItemResult, topicPerformanceResult, subjectResult, topicResult]
      .find(result => result.error)
    if (failedResult?.error) throw new AIMentorServiceError('CONTEXT_LOAD_FAILED')

    const performance = (performanceResult.data ?? []) as PerformanceRow[]
    const tasks = (taskResult.data ?? []) as TaskRow[]
    const meetings = (meetingResult.data ?? []) as MeetingRow[]
    const actionItems = (actionItemResult.data ?? []) as MeetingActionItem[]
    const subjectById = new Map(((subjectResult.data ?? []) as SubjectRow[]).map(subject => [subject.id, subject]))
    const topicById = new Map(((topicResult.data ?? []) as TopicRow[]).map(topic => [topic.id, topic]))
    const topicPerformance = ((topicPerformanceResult.data ?? []) as TopicPerformanceRow[]).flatMap(row => {
      const topic = topicById.get(row.topic_id)
      const subject = topic ? subjectById.get(topic.subject_id) : undefined
      if (!topic || !subject) return []
      return [{
        topicId: topic.id,
        topicName: topic.name,
        topicIsActive: topic.is_active,
        subjectId: subject.id,
        subjectName: subject.name,
        examType: subject.exam_type,
        correctCount: row.correct_count,
        wrongCount: row.wrong_count,
        blankCount: row.blank_count,
        observedAt: row.observed_at ?? row.created_at,
      } satisfies TopicPerformanceSignal]
    })
    const now = new Date()
    const studentStatus = calculateStudentStatus({ performance, tasks, meetings, now })
    const competencyMap = calculateCompetencyMap(topicPerformance)
    const goalProgress = calculateGoalProgress({
      goal: (goalResult.data as StudentGoal | null) ?? null,
      performance,
      studentStatus,
      academicInsights: competencyMap.topics.flatMap(topic => topic.status === 'insufficient_data' ? [] : [{
        examType: topic.examType,
        topicName: topic.topicName,
        status: topic.status,
        trend: topic.trend,
      }]),
      now,
    })
    const mentorAlerts = calculateMentorAlerts({
      studentId,
      studentCreatedAt: studentProfile.created_at,
      studentStatus,
      goalProgress,
      competencySummary: competencyMap,
      performance,
      tasks,
      meetings,
      actionItems,
      now,
    })
    const context = buildAIMentorContext({
      displayName: studentProfile.username,
      studentStatus,
      goalProgress,
      competencyMap,
      mentorAlerts,
    })
    const fingerprint = await createAIMentorContextFingerprint(context)
    const provider = createOpenAIMentorProvider({
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
    })
    const providerResult = await provider.generateMentorInsight(context)
    model = providerResult.model
    await complete('succeeded', null, providerResult.usage, providerResult.latencyMs)

    return json(200, {
      insight: providerResult.output,
      contextFingerprint: fingerprint,
      generatedAt: new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    const code = error instanceof AIMentorServiceError || error instanceof AIMentorProviderError ? error.code : 'INTERNAL_ERROR'
    await complete('failed', code, undefined, error instanceof AIMentorProviderError ? error.latencyMs : undefined)
    console.error('mentor-ai-insight failed', code)
    return json(errorStatus[code], { code })
  }
})
