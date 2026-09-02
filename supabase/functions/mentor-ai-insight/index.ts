import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { canGenerateAIMentorInsight } from '../../../src/lib/aiMentorAuthorization.ts'
import { buildAIMentorContext } from '../../../src/lib/aiMentorContext.ts'
import { calculateCompetencyMap, type TopicPerformanceSignal } from '../../../src/lib/competencyMap.ts'
import { calculateGoalProgress, type StudentGoal } from '../../../src/lib/goalProgress.ts'
import type { MeetingActionItem } from '../../../src/lib/meetingBriefing.ts'
import { calculateMentorAlerts } from '../../../src/lib/mentorAlerts.ts'
import { calculateStudentStatus, type MeetingSignal, type PerformanceSignal, type TaskSignal } from '../../../src/lib/studentStatus.ts'
import { createOpenAIMentorProvider } from '../_shared/aiMentorProvider.ts'

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
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function contextFingerprint(context: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(context))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Yalnız POST isteği destekleniyor.' })

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'Oturum doğrulanamadı.' })

    let requestBody: Record<string, unknown>
    try {
      const parsed = await request.json()
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('invalid')
      requestBody = parsed as Record<string, unknown>
    } catch {
      return json(400, { error: 'Geçersiz istek gövdesi.' })
    }
    if (Object.keys(requestBody).some(key => key !== 'studentId') || !isUuid(requestBody.studentId)) {
      return json(400, { error: 'Geçerli bir öğrenci kimliği gerekli.' })
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
    if (authError || !authData.user) return json(401, { error: 'Oturum doğrulanamadı.' })

    const { data: callerProfile, error: callerError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (callerError || !callerProfile || callerProfile.role !== 'teacher') {
      return json(403, { error: 'Bu işlem yalnız mentorlar tarafından kullanılabilir.' })
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
      return json(403, { error: 'Bu öğrenci için AI mentor yorumu oluşturma yetkiniz yok.' })
    }

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
    if (failedResult?.error) throw new Error('AI_CONTEXT_DATA_LOAD_FAILED')

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
    const fingerprint = await contextFingerprint(context)
    const provider = createOpenAIMentorProvider({
      apiKey: requiredEnvironment('OPENAI_API_KEY'),
      model: requiredEnvironment('OPENAI_MODEL'),
    })
    const insight = await provider.generateMentorInsight(context)

    return json(200, {
      insight,
      contextFingerprint: fingerprint,
      generatedAt: new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error('mentor-ai-insight failed', error instanceof Error ? error.message : 'unknown error')
    if (error instanceof Error && (error.message.includes('_MISSING') || error.message === 'AI_SERVICE_NOT_CONFIGURED')) {
      return json(503, { error: 'AI mentor servisi henüz yapılandırılmamış.' })
    }
    return json(502, { error: 'AI mentor yorumu şu anda oluşturulamadı.' })
  }
})
