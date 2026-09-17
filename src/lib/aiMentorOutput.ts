export type AIMentorInsight = {
  summary: string
  meetingTopics: string[]
  mentorActions: string[]
  studentFeedback: string
}

export type AIMentorInsightResponse = {
  insight: AIMentorInsight
  contextFingerprint: string
  generatedAt: string
  weekKey?: string
  cached?: boolean
}

export const AI_MENTOR_OUTPUT_LIMITS = {
  summary: 700,
  meetingTopics: 3,
  meetingTopicLength: 300,
  mentorActions: 2,
  mentorActionLength: 300,
  studentFeedback: 500,
} as const

export const AI_MENTOR_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'meetingTopics', 'mentorActions', 'studentFeedback'],
  properties: {
    summary: { type: 'string', minLength: 1, maxLength: AI_MENTOR_OUTPUT_LIMITS.summary },
    meetingTopics: {
      type: 'array',
      maxItems: AI_MENTOR_OUTPUT_LIMITS.meetingTopics,
      items: { type: 'string', minLength: 1, maxLength: AI_MENTOR_OUTPUT_LIMITS.meetingTopicLength },
    },
    mentorActions: {
      type: 'array',
      maxItems: AI_MENTOR_OUTPUT_LIMITS.mentorActions,
      items: { type: 'string', minLength: 1, maxLength: AI_MENTOR_OUTPUT_LIMITS.mentorActionLength },
    },
    studentFeedback: { type: 'string', minLength: 1, maxLength: AI_MENTOR_OUTPUT_LIMITS.studentFeedback },
  },
} as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Geçersiz AI yanıtı: ${field}.`)
  }
  return value.trim()
}

function textList(value: unknown, field: string, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Geçersiz AI yanıtı: ${field}.`)
  }
  return value.map((item, index) => requiredText(item, `${field}[${index}]`, maxLength))
}

export function parseAIMentorInsight(value: unknown): AIMentorInsight {
  if (!isPlainObject(value)) throw new Error('Geçersiz AI yanıtı: nesne bekleniyor.')
  const expectedKeys = ['summary', 'meetingTopics', 'mentorActions', 'studentFeedback']
  if (Object.keys(value).some(key => !expectedKeys.includes(key)) || expectedKeys.some(key => !(key in value))) {
    throw new Error('Geçersiz AI yanıtı: alanlar şemayla eşleşmiyor.')
  }

  return {
    summary: requiredText(value.summary, 'summary', AI_MENTOR_OUTPUT_LIMITS.summary),
    meetingTopics: textList(
      value.meetingTopics,
      'meetingTopics',
      AI_MENTOR_OUTPUT_LIMITS.meetingTopics,
      AI_MENTOR_OUTPUT_LIMITS.meetingTopicLength,
    ),
    mentorActions: textList(
      value.mentorActions,
      'mentorActions',
      AI_MENTOR_OUTPUT_LIMITS.mentorActions,
      AI_MENTOR_OUTPUT_LIMITS.mentorActionLength,
    ),
    studentFeedback: requiredText(value.studentFeedback, 'studentFeedback', AI_MENTOR_OUTPUT_LIMITS.studentFeedback),
  }
}

export function parseAIMentorInsightResponse(value: unknown): AIMentorInsightResponse {
  if (!isPlainObject(value)) throw new Error('AI servisi geçersiz yanıt döndürdü.')
  if (typeof value.contextFingerprint !== 'string' || value.contextFingerprint.length < 8) {
    throw new Error('AI servisi context fingerprint döndürmedi.')
  }
  if (typeof value.generatedAt !== 'string' || !Number.isFinite(new Date(value.generatedAt).getTime())) {
    throw new Error('AI servisi geçerli üretim zamanı döndürmedi.')
  }
  if (value.weekKey !== undefined && (typeof value.weekKey !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.weekKey)
    || !Number.isFinite(new Date(`${value.weekKey}T00:00:00Z`).getTime())
    || new Date(`${value.weekKey}T00:00:00Z`).toISOString().slice(0, 10) !== value.weekKey
    || new Date(`${value.weekKey}T00:00:00Z`).getUTCDay() !== 1)) {
    throw new Error('AI servisi geçerli hafta kimliği döndürmedi.')
  }
  return {
    insight: parseAIMentorInsight(value.insight),
    contextFingerprint: value.contextFingerprint,
    generatedAt: value.generatedAt,
    weekKey: value.weekKey as string | undefined,
    cached: value.cached === true,
  }
}
