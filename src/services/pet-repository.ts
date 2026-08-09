import Taro from '@tarojs/taro'
import type { NeuterStatus, Pet, PetSex } from '@/domain/pet'
import { getStoredSession } from './auth-session'
import { supabaseRest } from './supabase-rest'

const KEY = 'ai-pet-manager:pets'

interface PetRow {
  id: string; client_key: string; name: string; type: string; sex: PetSex
  avatar_url: string | null; birthday: string | null; weight: number | null
  breed: string | null; coat: string | null; neuter: NeuterStatus | null; created_at: string
}

const localPets = (): Pet[] => Taro.getStorageSync<Pet[]>(KEY) || []
const storeLocalPets = (pets: Pet[]): void => Taro.setStorageSync(KEY, pets)

const toPet = (row: PetRow): Pet => ({
  id: row.client_key, name: row.name, type: row.type, sex: row.sex,
  avatar: row.avatar_url || undefined, birthday: row.birthday || undefined,
  weight: row.weight == null ? undefined : String(row.weight), breed: row.breed || undefined,
  coat: row.coat || undefined, neuter: row.neuter || undefined, createdAt: row.created_at,
})

/** The single Pet -> public.pets mapping used by add, migration, and appointments. */
export async function upsertCloudPet(pet: Pet): Promise<string> {
  const rows = await supabaseRest<Pick<PetRow, 'id'>[]>('pets?on_conflict=user_id,client_key&select=id', {
    method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
    body: {
      client_key: pet.id, name: pet.name, type: pet.type, sex: pet.sex,
      avatar_url: pet.avatar || null, birthday: pet.birthday || null,
      weight: pet.weight ? Number(pet.weight) : null, breed: pet.breed || null,
      coat: pet.coat || null, neuter: pet.neuter || null,
    },
  })
  if (!rows[0]?.id) throw new Error('宠物档案同步失败，请稍后重试')
  return rows[0].id
}

export interface PetRepository {
  list(): Promise<Pet[]>; save(pet: Pet): Promise<void>; clear(): Promise<void>; syncLocalPets(): Promise<void>
}

export class SupabasePetRepository implements PetRepository {
  async syncLocalPets(): Promise<void> {
    if (!await getStoredSession()) return
    for (const pet of localPets()) {
      try {
        await upsertCloudPet(pet)
        // Only remove this record after Supabase confirms its upsert.
        storeLocalPets(localPets().filter(candidate => candidate.id !== pet.id))
      } catch {
        // Preserve failed records for the next first-load synchronization attempt.
      }
    }
  }

  async list(): Promise<Pet[]> {
    if (!await getStoredSession()) return localPets()
    await this.syncLocalPets()
    const select = 'id,client_key,name,type,sex,avatar_url,birthday,weight,breed,coat,neuter,created_at'
    const rows = await supabaseRest<PetRow[]>(`pets?select=${select}&order=created_at.asc`)
    return rows.map(toPet)
  }

  async save(pet: Pet): Promise<void> {
    if (await getStoredSession()) { await upsertCloudPet(pet); return }
    const pets = localPets()
    const index = pets.findIndex(candidate => candidate.id === pet.id)
    if (index >= 0) pets[index] = pet
    else pets.push(pet)
    storeLocalPets(pets)
  }

  async clear(): Promise<void> { Taro.removeStorageSync(KEY) }
}

export const petRepository = new SupabasePetRepository()
