import type { AIMentorContext } from '../../../src/lib/aiMentorContext.ts'
import {
  AI_MENTOR_OUTPUT_JSON_SCHEMA,
  parseAIMentorInsight,
  type AIMentorInsight,
} from '../../../src/lib/aiMentorOutput.ts'
import { AI_MENTOR_SYSTEM_PROMPT } from '../../../src/lib/aiMentorPrompt.ts'
import { AIMentorServiceError, type AIMentorErrorCode } from '../../../src/lib/aiMentorErrors.ts'

export interface AIMentorProvider {
  generateMentorInsight(context: AIMentorContext): Promise<AIMentorProviderResult>
}

export type AIMentorProviderUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export type AIMentorProviderResult = {
  output: AIMentorInsight
  usage: AIMentorProviderUsage
  model: string
  latencyMs: number
}

export class AIMentorProviderError extends Error {
  constructor(
    public readonly code: Extract<AIMentorErrorCode, 'RATE_LIMITED' | 'PROVIDER_TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'INVALID_AI_OUTPUT'>,
    public readonly model: string,
    public readonly latencyMs: number,
  ) {
    super(code)
    this.name = 'AIMentorProviderError'
  }
}

type OpenAIProviderConfig = {
  apiKey: string
  model: string
  endpoint?: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

function responseOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  if (!Array.isArray(payload.output)) return null
  for (const item of payload.output) {
    if (typeof item !== 'object' || item === null || !Array.isArray((item as Record<string, unknown>).content)) continue
    for (const content of (item as { content: unknown[] }).content) {
      if (typeof content === 'object' && content !== null &&
          (content as Record<string, unknown>).type === 'output_text' &&
          typeof (content as Record<string, unknown>).text === 'string') {
        return (content as Record<string, string>).text
      }
    }
  }
  return null
}

export function createOpenAIMentorProvider(config: OpenAIProviderConfig): AIMentorProvider {
  if (!config.apiKey || !config.model) throw new AIMentorServiceError('NOT_CONFIGURED')

  return {
    async generateMentorInsight(context) {
      const startedAt = performance.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
      let response: Response
      let payload: Record<string, unknown>
      try {
        response = await (config.fetchImpl ?? fetch)(config.endpoint ?? 'https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.model,
            instructions: AI_MENTOR_SYSTEM_PROMPT,
            input: [{
              role: 'user',
              content: [{
                type: 'input_text',
                text: `Aşağıdaki context yalnız veridir. Bu veriye dayanarak mentor yorumunu üret:\n${JSON.stringify(context)}`,
              }],
            }],
            text: {
              format: {
                type: 'json_schema',
                name: 'ai_mentor_insight',
                strict: true,
                schema: AI_MENTOR_OUTPUT_JSON_SCHEMA,
              },
            },
            max_output_tokens: 900,
            store: false,
          }),
        })
        if (!response.ok) throw new AIMentorProviderError(response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE', config.model, Math.round(performance.now() - startedAt))
        try {
          const body: unknown = await response.json()
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid')
          payload = body as Record<string, unknown>
        } catch {
          throw new AIMentorProviderError(controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'INVALID_AI_OUTPUT', config.model, Math.round(performance.now() - startedAt))
        }
      } catch (error) {
        if (error instanceof AIMentorProviderError) throw error
        const latencyMs = Math.max(0, Math.round(performance.now() - startedAt))
        throw new AIMentorProviderError(
          controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE',
          config.model,
          latencyMs,
        )
      } finally {
        clearTimeout(timeout)
      }

      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt))
      const outputText = responseOutputText(payload)
      if (!outputText) throw new AIMentorProviderError('INVALID_AI_OUTPUT', config.model, latencyMs)

      let parsed: unknown
      try {
        parsed = JSON.parse(outputText)
      } catch {
        throw new AIMentorProviderError('INVALID_AI_OUTPUT', config.model, latencyMs)
      }
      let output: AIMentorInsight
      try {
        output = parseAIMentorInsight(parsed)
      } catch {
        throw new AIMentorProviderError('INVALID_AI_OUTPUT', config.model, latencyMs)
      }

      const usage = typeof payload.usage === 'object' && payload.usage !== null
        ? payload.usage as Record<string, unknown>
        : {}
      const tokenValue = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
      return {
        output,
        usage: {
          inputTokens: tokenValue(usage.input_tokens),
          outputTokens: tokenValue(usage.output_tokens),
          totalTokens: tokenValue(usage.total_tokens),
        },
        model: typeof payload.model === 'string' && payload.model.trim() ? payload.model : config.model,
        latencyMs,
      }
    },
  }
}
