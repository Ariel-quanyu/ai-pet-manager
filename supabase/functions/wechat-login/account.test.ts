import { describe, expect, it, vi } from 'vitest'
import { ERROR_CODES, SafeError } from './core'
import {
  resolveOrCreateWechatAccount,
  type AccountUser,
  type WechatAccountDependencies,
} from './account'

interface TestUser extends AccountUser {
  email: string
}

function dependencies(overrides: Partial<WechatAccountDependencies<TestUser>> = {}) {
  const defaults: WechatAccountDependencies<TestUser> = {
    resolveIdentity: vi.fn(async () => null),
    createCandidate: vi.fn(async () => ({
      user: { id: 'candidate', email: 'candidate@wechat.invalid' },
    })),
    claimIdentity: vi.fn(async () => ({ userId: 'candidate', inserted: true })),
    deleteCandidate: vi.fn(async () => undefined),
    getExisting: vi.fn(async (userId) => ({
      user: { id: userId, email: 'existing@wechat.invalid' },
    })),
  }
  return { ...defaults, ...overrides }
}

describe('WeChat account provisioning', () => {
  it('reuses an existing WeChat user without creating a candidate', async () => {
    const deps = dependencies({
      resolveIdentity: vi.fn(async () => 'existing'),
    })

    await expect(resolveOrCreateWechatAccount(deps)).resolves.toEqual({
      user: { id: 'existing', email: 'existing@wechat.invalid' },
      inserted: false,
    })
    expect(deps.createCandidate).not.toHaveBeenCalled()
    expect(deps.getExisting).toHaveBeenCalledWith('existing')
  })

  it('stops before identity creation when Auth user creation fails', async () => {
    const deps = dependencies({
      createCandidate: vi.fn(async () => ({
        user: null,
        errorMessage: 'Auth unavailable',
      })),
    })

    await expect(resolveOrCreateWechatAccount(deps)).rejects.toMatchObject({
      code: ERROR_CODES.internal,
      status: 500,
    })
    expect(deps.claimIdentity).not.toHaveBeenCalled()
    expect(deps.deleteCandidate).not.toHaveBeenCalled()
  })

  it('deletes a fully-created candidate if identity claiming fails', async () => {
    const deps = dependencies({
      claimIdentity: vi.fn(async () => {
        throw new SafeError(ERROR_CODES.internal, 500)
      }),
    })

    await expect(resolveOrCreateWechatAccount(deps)).rejects.toMatchObject({
      code: ERROR_CODES.internal,
    })
    expect(deps.deleteCandidate).toHaveBeenCalledWith('candidate')
  })

  it('removes the losing candidate before adopting a concurrent identity claim', async () => {
    const events: string[] = []
    const deps = dependencies({
      claimIdentity: vi.fn(async () => ({ userId: 'winner', inserted: false })),
      deleteCandidate: vi.fn(async () => { events.push('delete-candidate') }),
      getExisting: vi.fn(async (userId) => {
        events.push('update-existing')
        return { user: { id: userId, email: 'winner@wechat.invalid' } }
      }),
    })

    await expect(resolveOrCreateWechatAccount(deps)).resolves.toMatchObject({
      user: { id: 'winner' },
      inserted: false,
    })
    expect(events).toEqual(['delete-candidate', 'update-existing'])
  })
})
