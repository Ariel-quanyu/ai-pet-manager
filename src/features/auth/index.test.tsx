import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const taroMocks = vi.hoisted(() => ({
  request: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  login: vi.fn(),
  redirectTo: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({ default: taroMocks }))
vi.mock('@tarojs/components', () => ({ Button: 'button', Text: 'text', View: 'view' }))
vi.mock('@/components/status-bar', () => ({ StatusBar: () => null }))

describe('WeChat auth runtime compatibility', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    storage.clear()
    process.env.TARO_APP_SUPABASE_URL = 'https://test-ref.supabase.co'
    process.env.TARO_APP_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
    taroMocks.getStorageSync.mockImplementation((key: string) => storage.get(key) || '')
    taroMocks.setStorageSync.mockImplementation((key: string, value: string) => { storage.set(key, value) })
    taroMocks.removeStorageSync.mockImplementation((key: string) => { storage.delete(key) })
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('loads the auth page without browser globals', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('fetch', undefined)
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('WebSocket', undefined)

    await expect(import('./index')).resolves.toMatchObject({
      default: expect.any(Function),
      showAuthFailure: expect.any(Function),
    })
  })

  it('uses Taro.request for wechat-login and persists the returned session', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-id' },
    }
    taroMocks.request
      .mockResolvedValueOnce({ statusCode: 200, data: session })
      .mockResolvedValueOnce({ statusCode: 200, data: session.user })
      .mockResolvedValueOnce({ statusCode: 200, data: session.user })

    const { completeWechatLogin, restoreAuthSession } = await import('@/services/auth-session')
    await completeWechatLogin('login-code', 'phone-code')
    await expect(restoreAuthSession()).resolves.toBe(true)

    expect(taroMocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: 'https://test-ref.supabase.co/functions/v1/wechat-login',
      method: 'POST',
      data: { loginCode: 'login-code', phoneCode: 'phone-code' },
      header: expect.objectContaining({
        apikey: 'sb_publishable_test',
        Authorization: 'Bearer sb_publishable_test',
      }),
    }))
    expect(taroMocks.setStorageSync).toHaveBeenCalledWith(
      'sb-test-ref-auth-token',
      expect.stringContaining('access-token'),
    )
  })

  it('shows a readable toast when the login request fails', async () => {
    taroMocks.request.mockRejectedValueOnce(new Error('request:fail timeout'))
    const { completeWechatLogin } = await import('@/services/auth-session')
    const { showAuthFailure } = await import('./index')

    const error = await completeWechatLogin('login-code', 'phone-code').catch((cause: unknown) => cause)
    showAuthFailure(error)

    expect(taroMocks.showToast).toHaveBeenCalledWith({
      title: '网络连接失败，请检查网络后重试',
      icon: 'none',
    })
  })

  it('restores a session saved in WeChat local storage', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: 'user-id' },
    }
    storage.set('sb-test-ref-auth-token', JSON.stringify(session))
    taroMocks.request.mockResolvedValueOnce({ statusCode: 200, data: session.user })

    const { restoreAuthSession } = await import('@/services/auth-session')
    await expect(restoreAuthSession()).resolves.toBe(true)
    expect(taroMocks.getStorageSync).toHaveBeenCalledWith('sb-test-ref-auth-token')
  })
})
