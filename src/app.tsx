import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from '@/queries/query-client'
import { RealtimeProvider } from '@/realtime/realtime-context'
import { createAppRouter } from '@/router'

const router = createAppRouter(queryClient)

function preloadRouteChunksOnFirstInteraction() {
  const events = ['pointermove', 'touchstart', 'scroll', 'keydown'] as const
  const load = () => {
    for (const e of events) window.removeEventListener(e, onFirst)
    const run = () => {
      void import('@/pages/nft-detail')
      void import('@/pages/cart')
      void import('@/pages/checkout')
      void import('@/pages/auth')
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 })
    else setTimeout(run, 200)
  }
  const onFirst = () => load()
  for (const e of events) window.addEventListener(e, onFirst, { once: true, passive: true })
}

export function renderApp(container: HTMLElement) {
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
  preloadRouteChunksOnFirstInteraction()
}
