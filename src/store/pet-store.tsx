import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createPet, type Pet, type PetDraft } from '@/domain/pet'
import { petRepository } from '@/services/pet-repository'
interface PetState { pets: Pet[]; addPet(draft: PetDraft): Promise<Pet>; reset(): Promise<void> }
const Context = createContext<PetState | null>(null)
export function PetStoreProvider({ children }: PropsWithChildren) {
  const [pets, setPets] = useState<Pet[]>([])
  useEffect(() => { void petRepository.list().then(setPets) }, [])
  const addPet = useCallback(async(draft: PetDraft) => { const pet=createPet(draft); await petRepository.save(pet); setPets(await petRepository.list()); return pet }, [])
  const reset = useCallback(async() => { await petRepository.clear(); setPets([]) }, [])
  const value = useMemo(() => ({ pets, addPet, reset }), [pets, addPet, reset])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function usePetStore() { const value=useContext(Context); if (!value) throw new Error('usePetStore must be used inside PetStoreProvider'); return value }
