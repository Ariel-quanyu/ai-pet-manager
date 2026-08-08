export const ERROR_CODES = {
  invalid: 'INVALID_REQUEST', login: 'WECHAT_LOGIN_FAILED', phone: 'PHONE_AUTH_FAILED',
  bound: 'PHONE_ALREADY_BOUND', session: 'SESSION_CREATION_FAILED', internal: 'INTERNAL_ERROR',
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

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,256}$/
export function parseCodes(body: unknown): { loginCode: string; phoneCode: string } {
  if (!body || typeof body !== 'object') throw new SafeError(ERROR_CODES.invalid)
  const { loginCode, phoneCode } = body as Record<string, unknown>
  if (typeof loginCode !== 'string' || typeof phoneCode !== 'string' ||
      !CODE_PATTERN.test(loginCode) || !CODE_PATTERN.test(phoneCode)) throw new SafeError(ERROR_CODES.invalid)
  return { loginCode, phoneCode }
}

export interface WechatPhoneInfo {
  phoneNumber?: string
  purePhoneNumber?: string
  countryCode?: string
}

/** Convert WeChat phone data to the E.164 format required by Supabase Auth. */
export function normalizeWechatPhone(info?: WechatPhoneInfo): string {
  const countryCode = info?.countryCode?.replace(/\D/g, '') || ''
  const pureNumber = info?.purePhoneNumber?.replace(/\D/g, '') || ''
  const rawNumber = info?.phoneNumber?.trim() || ''
  const normalized = countryCode && pureNumber
    ? `+${countryCode}${pureNumber}`
    : rawNumber.startsWith('+')
      ? `+${rawNumber.replace(/\D/g, '')}`
      : ''
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new SafeError(ERROR_CODES.phone)
  return normalized
}

export function safeJson(code: string, status: number): Response {
  return Response.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } })
}
