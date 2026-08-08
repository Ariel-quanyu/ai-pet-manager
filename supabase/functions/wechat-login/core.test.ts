import { describe, expect, it, vi } from 'vitest'
import {
  ERROR_CODES,
  normalizeWechatPhone,
  parseCodes,
  requireWechatLoginSuccess,
  SafeError,
  safeJson,
} from './core'

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

  it('logs only allowlisted WeChat API error fields and keeps the public response generic', async () => {
    const logError = vi.fn()
    const sensitive = {
      appSecret: 'secret-value-that-must-not-be-logged',
      loginCode: 'temporary-login-code',
      openid: 'private-openid',
      unionid: 'private-unionid',
      session_key: 'private-session-key',
      access_token: 'private-access-token',
    }

    let response: Response | undefined
    try {
      requireWechatLoginSuccess({
        errcode: 40029,
        errmsg: 'invalid code',
        ...sensitive,
      }, logError)
    } catch (error) {
      expect(error).toBeInstanceOf(SafeError)
      response = safeJson((error as SafeError).code, (error as SafeError).status)
    }

    expect(logError).toHaveBeenCalledOnce()
    expect(logError).toHaveBeenCalledWith(
      'wechat-login wechat api failed',
      '{"errcode":40029,"errmsg":"invalid code"}',
    )
    const serializedLog = JSON.stringify(logError.mock.calls)
    expect(serializedLog).not.toContain(sensitive.appSecret)
    expect(serializedLog).not.toContain(sensitive.loginCode)
    expect(serializedLog).not.toContain(sensitive.openid)
    expect(serializedLog).not.toContain(sensitive.unionid)
    expect(serializedLog).not.toContain(sensitive.session_key)
    expect(serializedLog).not.toContain(sensitive.access_token)
    expect(serializedLog).not.toMatch(/openid|unionid|session_key|access_token|token/i)
    expect(response?.status).toBe(400)
    expect(await response?.text()).toBe('{"code":"WECHAT_LOGIN_FAILED"}')
  })

  it('keeps successful WeChat login results unchanged without logging', () => {
    const logError = vi.fn()
    const result = {
      openid: 'private-openid',
      unionid: 'private-unionid',
      session_key: 'private-session-key',
    }

    expect(requireWechatLoginSuccess(result, logError)).toBe(result)
    expect(logError).not.toHaveBeenCalled()
  })
})
