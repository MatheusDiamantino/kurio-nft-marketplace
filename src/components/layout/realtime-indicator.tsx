import { Wifi, WifiOff } from 'lucide-react'
import { useRealtimeStatus } from '@/realtime/realtime-context'

export function RealtimeIndicator() {
  const status = useRealtimeStatus()
  const problem = status === 'reconnecting' || status === 'offline'
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 z-50 md:bottom-4">
      {problem && (
        <p
          className="flex items-center gap-2 rounded-sm border border-line-soft bg-surface px-3 py-2 text-xs text-sand shadow-lg"
        >
          <WifiOff className="size-4 text-danger" aria-hidden />
          Atualizações em tempo real indisponíveis. Reconectando...
        </p>
      )}
      {status === 'connected' && (
        <span className="sr-only">
          <Wifi aria-hidden /> Atualizações em tempo real ativas
        </span>
      )}
    </div>
  )
}
