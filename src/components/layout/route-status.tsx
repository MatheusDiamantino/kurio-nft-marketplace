import { useEffect, useRef, useState } from 'react'
import { useRouter, useRouterState, type ErrorComponentProps } from '@tanstack/react-router'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorState } from '@/components/shared'

export function RouteProgress() {
  const loading = useRouterState({ select: (s) => s.isLoading })
  const [visible, setVisible] = useState(false)
  const booted = useRef(false)

  useEffect(() => {
    if (!loading) {
      booted.current = true
      setVisible(false)
      return
    }
    if (!booted.current) return
    const t = setTimeout(() => setVisible(true), 250)
    return () => clearTimeout(t)
  }, [loading])

  if (!visible) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden">
      <div className="route-progress h-full w-1/3 bg-brand" />
    </div>
  )
}

export function RoutePending() {
  return (
    <div className="container-page flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <span className="sr-only">Carregando página…</span>
      <span aria-hidden className="size-8 animate-spin rounded-full border-2 border-line-soft border-t-brand" />
    </div>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const { reset: resetQueries } = useQueryErrorResetBoundary()
  return (
    <div className="container-page py-16">
      <ErrorState
        title="Não foi possível abrir esta página"
        message={error instanceof Error ? error.message : 'Erro inesperado.'}
        onRetry={() => {
          resetQueries()
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
