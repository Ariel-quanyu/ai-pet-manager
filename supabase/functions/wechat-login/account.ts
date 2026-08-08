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
  createCandidate(phone: string): Promise<AuthResult<TUser>>
  claimIdentity(candidateUserId: string): Promise<IdentityClaim>
  deleteCandidate(userId: string): Promise<void>
  updateExisting(userId: string, phone: string): Promise<AuthResult<TUser>>
}

export interface WechatAccountResult<TUser extends AccountUser> {
  user: TUser
  inserted: boolean
}

const PHONE_CONFLICT_PATTERN = /already|registered|exists|duplicate|unique/i

export function authFailure(message?: string): SafeError {
  return PHONE_CONFLICT_PATTERN.test(message || '')
    ? new SafeError(ERROR_CODES.bound, 409)
    : new SafeError(ERROR_CODES.internal, 500)
}

function requireUser<TUser extends AccountUser>(result: AuthResult<TUser>): TUser {
  if (!result.user) throw authFailure(result.errorMessage)
  return result.user
}

/**
 * Resolve an existing WeChat identity before creating anything. New users are
 * created with their phone in the same Auth Admin operation, so a unique-phone
 * conflict cannot leave behind an identity row, profile, or phone-less user.
 */
export async function resolveOrCreateWechatAccount<TUser extends AccountUser>(
  dependencies: WechatAccountDependencies<TUser>,
  phone: string,
): Promise<WechatAccountResult<TUser>> {
  const existingUserId = await dependencies.resolveIdentity()
  if (existingUserId) {
    return {
      user: requireUser(await dependencies.updateExisting(existingUserId, phone)),
      inserted: false,
    }
  }

  const candidate = requireUser(await dependencies.createCandidate(phone))
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
      user: requireUser(await dependencies.updateExisting(claim.userId, phone)),
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
