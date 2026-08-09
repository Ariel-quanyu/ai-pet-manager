import { ERROR_CODES, SafeError } from './core.ts'

export interface AccountUser {
  id: string
}

export interface AuthResult<TUser extends AccountUser> {
  user: TUser | null
  errorMessage?: string
}

export interface IdentityClaim {
  userId: string
  inserted: boolean
}

export interface WechatAccountDependencies<TUser extends AccountUser> {
  resolveIdentity(): Promise<string | null>
  createCandidate(): Promise<AuthResult<TUser>>
  claimIdentity(candidateUserId: string): Promise<IdentityClaim>
  deleteCandidate(userId: string): Promise<void>
  getExisting(userId: string): Promise<AuthResult<TUser>>
}

export interface WechatAccountResult<TUser extends AccountUser> {
  user: TUser
  inserted: boolean
}

export function authFailure(message?: string): SafeError {
  void message
  return new SafeError(ERROR_CODES.internal, 500)
}

function requireUser<TUser extends AccountUser>(result: AuthResult<TUser>): TUser {
  if (!result.user) throw authFailure(result.errorMessage)
  return result.user
}

/**
 * Resolve an existing WeChat identity before creating anything. New users are
 * created only when needed. The identity claim RPC serializes concurrent first
 * logins; a losing candidate is deleted before the winning account is reused.
 */
export async function resolveOrCreateWechatAccount<TUser extends AccountUser>(
  dependencies: WechatAccountDependencies<TUser>,
): Promise<WechatAccountResult<TUser>> {
  const existingUserId = await dependencies.resolveIdentity()
  if (existingUserId) {
    return {
      user: requireUser(await dependencies.getExisting(existingUserId)),
      inserted: false,
    }
  }

  const candidate = requireUser(await dependencies.createCandidate())
  let candidateDeleted = false

  try {
    const claim = await dependencies.claimIdentity(candidate.id)
    if (!claim.userId) throw new SafeError(ERROR_CODES.internal, 500)

    if (claim.inserted) {
      if (claim.userId !== candidate.id) throw new SafeError(ERROR_CODES.internal, 500)
      return { user: candidate, inserted: true }
    }

    await dependencies.deleteCandidate(candidate.id)
    candidateDeleted = true
    return {
      user: requireUser(await dependencies.getExisting(claim.userId)),
      inserted: false,
    }
  } catch (error) {
    if (!candidateDeleted) {
      try {
        await dependencies.deleteCandidate(candidate.id)
      } catch {
        throw new SafeError(ERROR_CODES.internal, 500)
      }
    }
    throw error
  }
}
