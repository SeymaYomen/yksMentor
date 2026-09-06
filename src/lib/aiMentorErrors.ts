export type AIMentorErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_AI_OUTPUT'
  | 'NOT_CONFIGURED'
  | 'CONTEXT_LOAD_FAILED'
  | 'INTERNAL_ERROR'

export class AIMentorServiceError extends Error {
  constructor(public readonly code: AIMentorErrorCode) {
    super(aiMentorErrorMessage(code))
    this.name = 'AIMentorServiceError'
  }
}

export function isAIMentorErrorCode(value: unknown): value is AIMentorErrorCode {
  return typeof value === 'string' && [
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'RATE_LIMITED',
    'PROVIDER_TIMEOUT',
    'PROVIDER_UNAVAILABLE',
    'INVALID_AI_OUTPUT',
    'NOT_CONFIGURED',
    'CONTEXT_LOAD_FAILED',
    'INTERNAL_ERROR',
  ].includes(value)
}

export function aiMentorErrorMessage(code: AIMentorErrorCode) {
  if (code === 'RATE_LIMITED') return 'AI Mentor kullanım sınırına ulaşıldı. Bir süre sonra tekrar deneyin.'
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return 'Bu AI Mentor işlemi için yetkiniz yok.'
  if (code === 'BAD_REQUEST') return 'AI Mentor isteği geçerli değil.'
  if (code === 'INVALID_AI_OUTPUT') return 'AI Mentor geçerli bir yorum oluşturamadı. Daha sonra tekrar deneyin.'
  return 'AI Mentor şu anda kullanılamıyor. Mevcut mentor verileri kullanılmaya devam edebilir.'
}
