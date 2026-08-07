import { describe, expect, it } from 'vitest'
import { ERROR_CODES, normalizeWechatPhone, parseCodes, SafeError, safeJson } from './core'

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
  it('normalizes mainland WeChat phone data to E.164', () => {
    expect(normalizeWechatPhone({ countryCode: '86', purePhoneNumber: '13222201527', phoneNumber: '13222201527' }))
      .toBe('+8613222201527')
  })
  it('accepts an already international phone number as fallback', () => {
    expect(normalizeWechatPhone({ phoneNumber: '+61 412 345 678' })).toBe('+61412345678')
  })
  it('rejects national numbers without a country code', () => {
    expect(() => normalizeWechatPhone({ phoneNumber: '13222201527' })).toThrowError(SafeError)
  })
  it('returns stable errors without echoing sensitive input', async () => {
    const response = safeJson(ERROR_CODES.session, 500)
    expect(await response.text()).toBe('{"code":"SESSION_CREATION_FAILED"}')
  })
})
