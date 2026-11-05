import { lazy, Suspense } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { SoonHint } from '@/components/soon'
import { Footer } from './footer'
import { Header } from './header'
import { MobileTabBar, MobileTopBar } from './mobile-nav'
import { RealtimeIndicator } from './realtime-indicator'
import { RouteProgress } from './route-status'
import { SessionEffects } from './session-effects'

const MockPanel = lazy(() => import('@/mocks/mock-panel').then((m) => ({ default: m.MockPanel })))

export function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-[100] rounded-sm bg-brand px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <RouteProgress />
      <Header />
      <MobileTopBar />
      <main id="conteudo" tabIndex={-1} className="min-h-[100dvh] outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <RealtimeIndicator />
      <SessionEffects />
      <SoonHint />
      <Toaster />
      {import.meta.env.VITE_ENABLE_MOCKS !== 'false' && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
