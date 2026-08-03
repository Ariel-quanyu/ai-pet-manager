import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react'
import { createPet, type Pet, type PetDraft } from '@/domain/pet'
import { petRepository } from '@/services/pet-repository'
interface PetState { pets: Pet[]; addPet(draft: PetDraft): Pet; reset(): void }
const Context = createContext<PetState | null>(null)
export function PetStoreProvider({ children }: PropsWithChildren) {
  const [pets, setPets] = useState<Pet[]>(() => petRepository.list())
  const addPet = useCallback((draft: PetDraft) => { const pet=createPet(draft); petRepository.save(pet); setPets(petRepository.list()); return pet }, [])
  const reset = useCallback(() => { petRepository.clear(); setPets([]) }, [])
  const value = useMemo(() => ({ pets, addPet, reset }), [pets, addPet, reset])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function usePetStore() { const value=useContext(Context); if (!value) throw new Error('usePetStore must be used inside PetStoreProvider'); return value }
