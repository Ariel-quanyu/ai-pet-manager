export const ERROR_CODES = {
  invalid: 'INVALID_REQUEST', login: 'WECHAT_LOGIN_FAILED',
  session: 'SESSION_CREATION_FAILED', internal: 'INTERNAL_ERROR',
} as const

export class SafeError extends Error {
  constructor(public code: string, public status = 400) { super(code) }
}

export interface WechatLoginResult {
  openid?: string
  unionid?: string
  session_key?: string
  errcode?: number
  errmsg?: string
}

type ErrorLogger = (event: string, details?: string) => void

export function requireWechatLoginSuccess(
  result: WechatLoginResult,
  logError: ErrorLogger = console.error,
): WechatLoginResult & { openid: string } {
  if (result.openid && !result.errcode) return result as WechatLoginResult & { openid: string }

  if (typeof result.errcode === 'number' && result.errcode !== 0) {
    logError(
      'wechat-login wechat api failed',
      JSON.stringify({
        errcode: result.errcode,
        errmsg: typeof result.errmsg === 'string' ? result.errmsg : undefined,
      }),
    )
  }

  throw new SafeError(ERROR_CODES.login)
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{6,256}$/
export function parseLoginCode(body: unknown): { loginCode: string } {
  if (!body || typeof body !== 'object') throw new SafeError(ERROR_CODES.invalid)
  const { loginCode } = body as Record<string, unknown>
  if (typeof loginCode !== 'string' || !CODE_PATTERN.test(loginCode)) throw new SafeError(ERROR_CODES.invalid)
  return { loginCode }
}

export function safeJson(code: string, status: number): Response {
  return Response.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } })
}
