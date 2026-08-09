import { describe, expect, it, vi } from 'vitest'
import {
  ERROR_CODES,
  parseLoginCode,
  requireWechatLoginSuccess,
  SafeError,
  safeJson,
} from './core'

describe('wechat-login request boundary', () => {
  it.each([
    [{}], [{ loginCode: 'short' }], [{ loginCode: '' }], [{ loginCode: '含敏感字符' }],
    [{ loginCode: 42 }],
  ])('rejects missing or malformed login codes', (body) => {
    expect(() => parseLoginCode(body)).toThrowError(SafeError)
  })
  it('accepts only the current one-time login code and ignores no client identity', () => {
    expect(parseLoginCode({ loginCode: 'fresh_login_1' })).toEqual({ loginCode: 'fresh_login_1' })
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
