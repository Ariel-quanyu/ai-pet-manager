import Taro from '@tarojs/taro'
import type { NeuterStatus, Pet } from '@/domain/pet'
import { getSupabasePublicConfig, getValidSession, type SupabaseSession } from './supabase-session'

const GUEST_PETS_KEY = 'ai-pet-manager:pets'
const REQUEST_TIMEOUT_MS = 15_000

interface PetRow {
  client_key: string
  name: string
  type: string
  sex: Pet['sex']
  avatar_url: string | null
  birthday: string | null
  weight_kg: number | null
  breed: string | null
  coat: string | null
  neutered: boolean | null
  created_at: string
}

export interface GuestMigrationResult {
  migrated: number
}

export interface PetRepository {
  getCached(): Pet[]
  list(): Promise<Pet[]>
  save(pet: Pet): Promise<Pet>
  clear(): Promise<void>
  migrateGuestPets(): Promise<GuestMigrationResult>
}

function listGuestPets(): Pet[] {
  try {
    return Taro.getStorageSync<Pet[]>(GUEST_PETS_KEY) || []
  } catch {
    return []
  }
}

function saveGuestPet(pet: Pet): Pet {
  const pets = listGuestPets()
  const next = [...pets.filter(item => item.id !== pet.id), pet]
  Taro.setStorageSync(GUEST_PETS_KEY, next)
  return pet
}

function parseWeight(value?: string): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNeutered(value?: NeuterStatus): boolean | null {
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}

function fromNeutered(value: boolean | null): NeuterStatus {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return 'unknown'
}

function toInsert(pet: Pet) {
  return {
    client_key: pet.id,
    name: pet.name,
    type: pet.type,
    sex: pet.sex,
    avatar_url: pet.avatar || null,
    birthday: pet.birthday || null,
    weight_kg: parseWeight(pet.weight),
    breed: pet.breed || null,
    coat: pet.coat || null,
    neutered: toNeutered(pet.neuter)
  }
}

function fromRow(row: PetRow): Pet {
  return {
    id: row.client_key,
    name: row.name,
    type: row.type,
    sex: row.sex,
    avatar: row.avatar_url || undefined,
    birthday: row.birthday || undefined,
    weight: row.weight_kg == null ? undefined : String(row.weight_kg),
    breed: row.breed || undefined,
    coat: row.coat || undefined,
    neuter: fromNeutered(row.neutered),
    createdAt: row.created_at
  }
}

async function requestPets<T>(session: SupabaseSession, options: {
  method: 'GET' | 'POST' | 'DELETE'
  query?: string
  data?: unknown
  prefer?: string
}): Promise<T> {
  const config = getSupabasePublicConfig()
  const response = await Taro.request<T & { message?: string }>({
    url: `${config.url}/rest/v1/pets${options.query || ''}`,
    method: options.method,
    timeout: REQUEST_TIMEOUT_MS,
    header: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    data: options.data
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = response.data && typeof response.data === 'object'
      ? response.data.message
      : undefined
    throw new Error(message || '宠物数据同步失败，请检查网络后重试')
  }

  return response.data
}

async function saveRemotePet(session: SupabaseSession, pet: Pet): Promise<Pet> {
  const rows = await requestPets<PetRow[]>(session, {
    method: 'POST',
    query: '?on_conflict=user_id,client_key',
    data: toInsert(pet),
    prefer: 'resolution=merge-duplicates,return=representation'
  })
  if (!rows[0]) throw new Error('宠物数据保存成功，但未返回记录')
  return fromRow(rows[0])
}

export class HybridPetRepository implements PetRepository {
  getCached(): Pet[] {
    return listGuestPets()
  }

  async list(): Promise<Pet[]> {
    const session = await getValidSession()
    if (!session) return listGuestPets()
    const rows = await requestPets<PetRow[]>(session, {
      method: 'GET',
      query: '?select=client_key,name,type,sex,avatar_url,birthday,weight_kg,breed,coat,neutered,created_at&order=created_at.asc'
    })
    return rows.map(fromRow)
  }

  async save(pet: Pet): Promise<Pet> {
    const session = await getValidSession()
    return session ? saveRemotePet(session, pet) : saveGuestPet(pet)
  }

  async clear(): Promise<void> {
    const session = await getValidSession()
    if (!session) {
      Taro.removeStorageSync(GUEST_PETS_KEY)
      return
    }
    await requestPets<unknown>(session, { method: 'DELETE', query: '?id=not.is.null' })
  }

  async migrateGuestPets(): Promise<GuestMigrationResult> {
    const guests = listGuestPets()
    if (!guests.length) return { migrated: 0 }
    const session = await getValidSession()
    if (!session) throw new Error('请先登录后再同步游客宠物')

    for (const pet of guests) await saveRemotePet(session, pet)
    Taro.removeStorageSync(GUEST_PETS_KEY)
    return { migrated: guests.length }
  }
}

export const petRepository = new HybridPetRepository()

