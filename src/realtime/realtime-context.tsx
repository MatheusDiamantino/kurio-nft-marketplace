import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RealtimeClient, type RealtimeStatus } from './realtime-client'

const RealtimeContext = createContext<RealtimeClient | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [client] = useState(() => new RealtimeClient(qc))
  useEffect(() => {
    const unsubscribe = client.start()
    return () => {
      unsubscribe()
      client.stop()
    }
  }, [client])
  return <RealtimeContext.Provider value={client}>{children}</RealtimeContext.Provider>
}

export function useRealtimeStatus(): RealtimeStatus {
  const client = useContext(RealtimeContext)
  return useSyncExternalStore(
    (cb) => client?.onStatus(cb) ?? (() => {}),
    () => client?.getStatus() ?? 'idle',
    () => 'idle',
  )
}
