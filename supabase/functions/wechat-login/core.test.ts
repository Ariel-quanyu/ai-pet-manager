import { describe, expect, it } from 'vitest'
import { ERROR_CODES, parseCodes, SafeError, safeJson } from './core'

describe('wechat-login request boundary', () => {
  it.each([
    [{ phoneCode: 'phone' }], [{ loginCode: 'login' }],
    [{ loginCode: '', phoneCode: 'phone' }], [{ loginCode: 'login', phoneCode: '含敏感字符' }],
  ])('rejects missing or malformed codes', (body) => {
    expect(() => parseCodes(body)).toThrowError(SafeError)
  })
  it('keeps the two one-time codes distinct', () => {
    expect(parseCodes({ loginCode: 'login_1', phoneCode: 'phone_2' })).toEqual({ loginCode: 'login_1', phoneCode: 'phone_2' })
  })
  it('returns stable errors without echoing sensitive input', async () => {
    const response = safeJson(ERROR_CODES.session, 500)
    expect(await response.text()).toBe('{"code":"SESSION_CREATION_FAILED"}')
  })
})
