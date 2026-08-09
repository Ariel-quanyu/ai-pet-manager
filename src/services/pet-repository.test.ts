import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pet } from '@/domain/pet'

const mocks = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  session: null as null | { access_token: string; refresh_token: string; user: { id: string } },
  rest: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => mocks.storage.get(key),
  setStorageSync: (key: string, value: unknown) => mocks.storage.set(key, value),
  removeStorageSync: (key: string) => mocks.storage.delete(key),
} }))
vi.mock('./auth-session', () => ({ getStoredSession: vi.fn(async() => mocks.session) }))
vi.mock('./supabase-rest', () => ({ supabaseRest: mocks.rest }))

import { SupabasePetRepository, upsertCloudPet } from './pet-repository'

const key = 'ai-pet-manager:pets'
const pet: Pet = { id: 'pet-stable', name: '招财', type: '猫咪', sex: 'unknown', weight: '4.5', coat: '花色', neuter: 'yes', createdAt: '2026-08-01T00:00:00Z' }
const login = () => { mocks.session = { access_token: 'token', refresh_token: 'refresh', user: { id: 'user-1' } } }

describe('SupabasePetRepository', () => {
  beforeEach(() => { mocks.storage.clear(); mocks.session = null; mocks.rest.mockReset() })

  it('stores a guest pet locally without a Supabase request', async() => {
    await new SupabasePetRepository().save(pet)
    expect(mocks.storage.get(key)).toEqual([pet])
    expect(mocks.rest).not.toHaveBeenCalled()
  })

  it('upserts a logged-in pet with its stable client key and no user_id', async() => {
    login(); mocks.rest.mockResolvedValue([{ id: 'cloud-id' }])
    await new SupabasePetRepository().save(pet)
    const [, options] = mocks.rest.mock.calls[0]
    expect(options.body).toMatchObject({ client_key: pet.id, name: '招财', weight: 4.5 })
    expect(options.body).not.toHaveProperty('user_id')
    expect(mocks.storage.has(key)).toBe(false)
  })

  it('propagates an RLS rejection and does not claim a local success', async() => {
    login(); mocks.rest.mockRejectedValue(new Error('RLS rejected'))
    await expect(new SupabasePetRepository().save(pet)).rejects.toThrow('RLS rejected')
    expect(mocks.storage.has(key)).toBe(false)
  })

  it('loads cloud snake_case rows for a logged-in user', async() => {
    login(); mocks.rest.mockResolvedValue([{ id:'cloud-id',client_key:pet.id,name:'招财',type:'猫咪',sex:'unknown',avatar_url:null,birthday:null,weight:4.5,breed:null,coat:'花色',neuter:'yes',created_at:pet.createdAt }])
    await expect(new SupabasePetRepository().list()).resolves.toEqual([pet])
    expect(mocks.rest.mock.calls.at(-1)?.[0]).toContain('pets?select=')
  })

  it('loads local pets when a session is absent or expired', async() => {
    mocks.storage.set(key, [pet])
    await expect(new SupabasePetRepository().list()).resolves.toEqual([pet])
    expect(mocks.rest).not.toHaveBeenCalled()
  })

  it('migrates local pets and only clears records confirmed by Supabase', async() => {
    login(); const second = { ...pet, id: 'pet-2', name: '未同步' }; mocks.storage.set(key, [pet, second])
    mocks.rest.mockResolvedValueOnce([{ id: 'cloud-id' }]).mockRejectedValueOnce(new Error('offline'))
    await new SupabasePetRepository().syncLocalPets()
    expect(mocks.storage.get(key)).toEqual([second])
  })

  it('uses the conflict target on every retry so a client key is idempotent', async() => {
    login(); mocks.rest.mockResolvedValue([{ id: 'same-cloud-id' }])
    await upsertCloudPet(pet); await upsertCloudPet(pet)
    expect(mocks.rest).toHaveBeenCalledTimes(2)
    for (const [path, options] of mocks.rest.mock.calls) {
      expect(path).toContain('on_conflict=user_id,client_key')
      expect(options.prefer).toContain('resolution=merge-duplicates')
    }
  })
})
