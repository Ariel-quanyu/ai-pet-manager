export const ERROR_CODES = {
  invalid: 'INVALID_REQUEST', login: 'WECHAT_LOGIN_FAILED', phone: 'PHONE_AUTH_FAILED',
  bound: 'PHONE_ALREADY_BOUND', session: 'SESSION_CREATION_FAILED', internal: 'INTERNAL_ERROR',
} as const

export class SafeError extends Error {
  constructor(public code: string, public status = 400) { super(code) }
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,256}$/
export function parseCodes(body: unknown): { loginCode: string; phoneCode: string } {
  if (!body || typeof body !== 'object') throw new SafeError(ERROR_CODES.invalid)
  const { loginCode, phoneCode } = body as Record<string, unknown>
  if (typeof loginCode !== 'string' || typeof phoneCode !== 'string' ||
      !CODE_PATTERN.test(loginCode) || !CODE_PATTERN.test(phoneCode)) throw new SafeError(ERROR_CODES.invalid)
  return { loginCode, phoneCode }
}

export function safeJson(code: string, status: number): Response {
  return Response.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } })
}
