import { AIMentorServiceError } from '../../../src/lib/aiMentorErrors.ts'

export type AIMentorConfig = {
  apiKey: string
  model: string
  provider: 'openai'
  minuteLimit: number
  dailyLimit: number
  timeoutMs: number
}

export const AI_MENTOR_CONFIG_DEFAULTS = {
  minuteLimit: 3,
  dailyLimit: 30,
  timeoutMs: 20_000,
  minimumTimeoutMs: 5_000,
  maximumTimeoutMs: 60_000,
  maximumMinuteLimit: 60,
  maximumDailyLimit: 1_000,
} as const

type EnvironmentReader = (name: string) => string | undefined

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

export function loadAIMentorConfig(readEnvironment: EnvironmentReader = name => Deno.env.get(name)) : AIMentorConfig {
  const apiKey = readEnvironment('OPENAI_API_KEY')?.trim()
  const model = readEnvironment('OPENAI_MODEL')?.trim()
  if (!apiKey || !model) throw new AIMentorServiceError('NOT_CONFIGURED')

  const minuteLimit = boundedInteger(
    readEnvironment('AI_MENTOR_MINUTE_LIMIT'),
    AI_MENTOR_CONFIG_DEFAULTS.minuteLimit,
    1,
    AI_MENTOR_CONFIG_DEFAULTS.maximumMinuteLimit,
  )
  const dailyLimit = boundedInteger(
    readEnvironment('AI_MENTOR_DAILY_LIMIT'),
    Math.max(minuteLimit, AI_MENTOR_CONFIG_DEFAULTS.dailyLimit),
    minuteLimit,
    AI_MENTOR_CONFIG_DEFAULTS.maximumDailyLimit,
  )
  const timeoutMs = boundedInteger(
    readEnvironment('AI_MENTOR_TIMEOUT_MS'),
    AI_MENTOR_CONFIG_DEFAULTS.timeoutMs,
    AI_MENTOR_CONFIG_DEFAULTS.minimumTimeoutMs,
    AI_MENTOR_CONFIG_DEFAULTS.maximumTimeoutMs,
  )

  return { apiKey, model, provider: 'openai', minuteLimit, dailyLimit, timeoutMs }
}
