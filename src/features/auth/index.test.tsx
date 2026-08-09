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

  it('uses a normal button rather than getPhoneNumber', async () => {
    const { default: AuthPage } = await import('./index')
    const phoneButton = findByClass(AuthPage(), 'auth-sheet__phone')

    expect(phoneButton.props?.openType).toBeUndefined()
    expect(phoneButton.props?.onGetPhoneNumber).toBeUndefined()
    expect(phoneButton.props?.onClick).toEqual(expect.any(Function))
  })

  it('exchanges a fresh Taro login code without phone or openid', async () => {
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
    await (phoneButton.props?.onClick as () => Promise<void>)()

    expect(taroMocks.login).toHaveBeenCalledOnce()
    expect(taroMocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: 'https://test-ref.supabase.co/functions/v1/wechat-login',
      data: { loginCode: 'fresh-login-code' },
    }))
    expect(taroMocks.redirectTo).toHaveBeenCalledWith({ url: '/features/home/index' })
  })

  it('does not call the backend when Taro.login fails', async () => {
    taroMocks.login.mockRejectedValueOnce(new Error('login:fail'))
    const { default: AuthPage } = await import('./index')
    const button = findByClass(AuthPage(), 'auth-sheet__phone')
    await (button.props?.onClick as () => Promise<void>)()
    expect(taroMocks.request).not.toHaveBeenCalled()
    expect(taroMocks.redirectTo).not.toHaveBeenCalled()
  })

  it('obtains a new code for every separate login attempt', async () => {
    taroMocks.login
      .mockResolvedValueOnce({ code: 'fresh-login-code-1' })
      .mockResolvedValueOnce({ code: 'fresh-login-code-2' })
    taroMocks.request
      .mockRejectedValueOnce(new Error('request:fail'))
      .mockRejectedValueOnce(new Error('request:fail'))
    const { default: AuthPage } = await import('./index')
    const button = findByClass(AuthPage(), 'auth-sheet__phone')
    await (button.props?.onClick as () => Promise<void>)()
    await (button.props?.onClick as () => Promise<void>)()
    expect(taroMocks.login).toHaveBeenCalledTimes(2)
    expect(taroMocks.request.mock.calls[0][0].data).toEqual({ loginCode: 'fresh-login-code-1' })
    expect(taroMocks.request.mock.calls[1][0].data).toEqual({ loginCode: 'fresh-login-code-2' })
  })

  it('prevents concurrent login requests', async () => {
    let finishLogin!: (value: { code: string }) => void
    taroMocks.login.mockImplementationOnce(() => new Promise(resolve => { finishLogin = resolve }))
    const { default: AuthPage } = await import('./index')
    const button = findByClass(AuthPage(), 'auth-sheet__phone')
    const first = (button.props?.onClick as () => Promise<void>)()
    const second = (button.props?.onClick as () => Promise<void>)()
    expect(taroMocks.login).toHaveBeenCalledOnce()
    finishLogin({ code: 'fresh-login-code' })
    taroMocks.request.mockRejectedValueOnce(new Error('request:fail'))
    await Promise.all([first, second])
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
    await completeWechatLogin('login-code')
    await expect(restoreAuthSession()).resolves.toBe(true)

    expect(taroMocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: 'https://test-ref.supabase.co/functions/v1/wechat-login',
      method: 'POST',
      data: { loginCode: 'login-code' },
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

    const error = await completeWechatLogin('login-code').catch((cause: unknown) => cause)
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
