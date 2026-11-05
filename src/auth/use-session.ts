import { useSyncExternalStore } from 'react'
import { sessionStore } from './session-store'

export function useSessionSnapshot() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.snapshot, sessionStore.snapshot)
}

export function useSession() {
  return useSessionSnapshot().session
}

export function useUser() {
  return useSession()?.user ?? null
}

export function useCartOwner() {
  return useUser()?.id ?? 'guest'
}
