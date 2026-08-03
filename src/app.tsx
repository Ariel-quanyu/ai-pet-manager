import type { PropsWithChildren } from 'react'
import { PetStoreProvider } from './store/pet-store'
import './styles/global.scss'

export default function App({ children }: PropsWithChildren) {
  return <PetStoreProvider>{children}</PetStoreProvider>
}
