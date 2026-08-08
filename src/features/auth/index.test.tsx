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
vi.mock('react', () => ({
  useEffect: vi.fn(),
  useRef: vi.fn((initial: unknown) => ({ current: initial })),
  useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
}))

interface TestElement {
  props?: Record<string, unknown> & { children?: unknown }
}

function findByClass(node: unknown, className: string): TestElement {
  if (node && typeof node === 'object') {
    const element = node as TestElement
    if (element.props?.className === className) return element
    const children = Array.isArray(element.props?.children)
      ? element.props.children
      : [element.props?.children]
    for (const child of children) {
      try {
        return findByClass(child, className)
      } catch {
        // Continue searching sibling elements.
      }
    }
  }
  throw new Error(`Element with class ${className} not found`)
}

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

  it('binds the phone button to getPhoneNumber and keeps denial on the auth page', async () => {
    const { default: AuthPage } = await import('./index')
    const phoneButton = findByClass(AuthPage(), 'auth-sheet__phone')

    expect(phoneButton.props?.openType).toBe('getPhoneNumber')
    expect(phoneButton.props?.onGetPhoneNumber).toEqual(expect.any(Function))

    await (phoneButton.props?.onGetPhoneNumber as (event: unknown) => Promise<void>)({
      detail: { code: '', errMsg: 'getPhoneNumber:fail user deny' },
    })

    expect(taroMocks.showToast).toHaveBeenCalledWith({
      title: '未授权手机号，可继续游客体验',
      icon: 'none',
    })
    expect(taroMocks.login).not.toHaveBeenCalled()
    expect(taroMocks.request).not.toHaveBeenCalled()
    expect(taroMocks.redirectTo).not.toHaveBeenCalled()
  })

  it('exchanges the phone authorization code with a fresh Taro login code', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-id' },
    }
    taroMocks.login.mockResolvedValueOnce({ code: 'fresh-login-code' })
    taroMocks.request
      .mockResolvedValueOnce({ statusCode: 200, data: session })
      .mockResolvedValueOnce({ statusCode: 200, data: session.user })

    const { default: AuthPage } = await import('./index')
    const phoneButton = findByClass(AuthPage(), 'auth-sheet__phone')
    await (phoneButton.props?.onGetPhoneNumber as (event: unknown) => Promise<void>)({
      detail: { code: 'phone-code', errMsg: 'getPhoneNumber:ok' },
    })

    expect(taroMocks.login).toHaveBeenCalledOnce()
    expect(taroMocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: 'https://test-ref.supabase.co/functions/v1/wechat-login',
      data: { loginCode: 'fresh-login-code', phoneCode: 'phone-code' },
    }))
    expect(taroMocks.redirectTo).toHaveBeenCalledWith({ url: '/features/home/index' })
  })

  it('keeps the explicit guest experience available without starting login', async () => {
    const { default: AuthPage } = await import('./index')
    const guestButton = findByClass(AuthPage(), 'auth-sheet__guest')
    const enterAsGuest = guestButton.props?.onClick as () => void

    expect(enterAsGuest).toEqual(expect.any(Function))
    enterAsGuest()

    expect(taroMocks.showToast).toHaveBeenCalledWith({ title: '已进入体验模式', icon: 'none' })
    expect(taroMocks.redirectTo).toHaveBeenCalledWith({ url: '/features/home/index' })
    expect(taroMocks.login).not.toHaveBeenCalled()
    expect(taroMocks.request).not.toHaveBeenCalled()
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
