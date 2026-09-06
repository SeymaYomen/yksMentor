import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  parseAIMentorInsightResponse,
  type AIMentorInsightResponse,
} from '../lib/aiMentorOutput'
import {
  AIMentorServiceError,
  isAIMentorErrorCode,
} from '../lib/aiMentorErrors'

export interface AIMentorInsightService {
  generateMentorInsight(studentId: string): Promise<AIMentorInsightResponse>
}

type ErrorResponseBody = {
  code?: unknown
}

async function extractErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return null

  const context = (error as { context?: unknown }).context

  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as ErrorResponseBody
      return isAIMentorErrorCode(body?.code) ? body.code : null
    } catch {
      return null
    }
  }

  return null
}

export class SupabaseEdgeAIMentorInsightService implements AIMentorInsightService {
  async generateMentorInsight(studentId: string) {
    if (!studentId) {
      throw new AIMentorServiceError('BAD_REQUEST')
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new AIMentorServiceError('NOT_CONFIGURED')
    }

    const { data, error } = await supabase.functions.invoke('mentor-ai-insight', {
      body: { studentId },
    }).catch(() => { throw new AIMentorServiceError('PROVIDER_UNAVAILABLE') })

    if (error) {
      const code = await extractErrorCode(error)

      if (code) {
        throw new AIMentorServiceError(code)
      }

      throw new AIMentorServiceError('PROVIDER_UNAVAILABLE')
    }

    try {
      return parseAIMentorInsightResponse(data)
    } catch {
      throw new AIMentorServiceError('INVALID_AI_OUTPUT')
    }
  }
}

export const aiMentorInsightService: AIMentorInsightService =
  new SupabaseEdgeAIMentorInsightService()
