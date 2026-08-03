import Taro from '@tarojs/taro'
import type { Pet } from '@/domain/pet'
export interface PetRepository { list(): Pet[]; save(pet: Pet): void; clear(): void }
const KEY = 'ai-pet-manager:pets'
export class MockPetRepository implements PetRepository {
  list() { return Taro.getStorageSync<Pet[]>(KEY) || [] }
  save(pet: Pet) { Taro.setStorageSync(KEY, [...this.list(), pet]) }
  clear() { Taro.removeStorageSync(KEY) }
}
export const petRepository = new MockPetRepository()
