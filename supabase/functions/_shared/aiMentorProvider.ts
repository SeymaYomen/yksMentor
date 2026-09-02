import type { AIMentorContext } from '../../../src/lib/aiMentorContext.ts'
import {
  AI_MENTOR_OUTPUT_JSON_SCHEMA,
  parseAIMentorInsight,
  type AIMentorInsight,
} from '../../../src/lib/aiMentorOutput.ts'
import { AI_MENTOR_SYSTEM_PROMPT } from '../../../src/lib/aiMentorPrompt.ts'

export interface AIMentorProvider {
  generateMentorInsight(context: AIMentorContext): Promise<AIMentorInsight>
}

type OpenAIProviderConfig = {
  apiKey: string
  model: string
  endpoint?: string
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
  if (!config.apiKey || !config.model) throw new Error('AI_SERVICE_NOT_CONFIGURED')

  return {
    async generateMentorInsight(context) {
      const response = await fetch(config.endpoint ?? 'https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
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

      if (!response.ok) throw new Error(`AI_PROVIDER_ERROR_${response.status}`)
      const payload = await response.json() as Record<string, unknown>
      const outputText = responseOutputText(payload)
      if (!outputText) throw new Error('AI_PROVIDER_EMPTY_RESPONSE')

      let parsed: unknown
      try {
        parsed = JSON.parse(outputText)
      } catch {
        throw new Error('AI_PROVIDER_INVALID_JSON')
      }
      return parseAIMentorInsight(parsed)
    },
  }
}
