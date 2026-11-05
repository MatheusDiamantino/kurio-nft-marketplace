import { setupWorker } from 'msw/browser'
import type { EditionId } from '@/api/contracts'
import { getConfig, initConfig, LATENCIES, resetConfig, SCENARIOS, setConfig, type MockConfig } from './config'
import * as db from './db'
import { restHandlers } from './handlers'
import {
  connectionCount,
  dropRealtime,
  isRealtimeDown,
  realtimeHandlers,
  replayEvent,
  restoreRealtime,
  sendStaleNftEvent,
} from './realtime'

/**
 * Control surface for demos and E2E tests. It only manipulates the *mock
 * server* (data, scenarios, socket transport) — never the app's state. Every
 * effect reaches the UI through REST (MSW handlers) or Socket.IO events.
 */
export interface KurioMockControl {
  scenarios: typeof SCENARIOS
  latencies: typeof LATENCIES
  getConfig(): MockConfig
  setConfig(patch: Partial<MockConfig>): MockConfig
  /** Restore seed data + default config. */
  reset(): void
  updateNft(id: string, patch: { price?: string; compareAtPrice?: string | null; editions?: Partial<Record<EditionId, number>> }): boolean
  expireSessions(): void
  resolveOrder(id: string, outcome: 'confirmed' | 'declined'): boolean
  pendingOrders(): string[]
  realtime: {
    drop(): void
    restore(): void
    isDown(): boolean
    connections(): number
    replayLast(): string | null
    replay(eventId: string): string | null
    sendStale(nftId: string): string | null
  }
}

declare global {
  interface Window {
    __kurio?: KurioMockControl
    __kurioMockReady?: boolean
  }
}

export async function startMocks() {
  initConfig()
  const params = new URLSearchParams(location.search)
  if (params.has('mock-reset')) {
    db.resetDb()
    resetConfig()
    initConfig()
  } else {
    db.loadDb()
  }
  db.resumePendingOrders()

  // Mock-control params are one-shot: strip them so a refresh doesn't re-apply
  // them (e.g. `?mock-reset=1` must not wipe data again on reload).
  const MOCK_PARAMS = ['mock-reset', 'scenario', 'latency', 'orderResolutionMs']
  if (MOCK_PARAMS.some((p) => params.has(p))) {
    for (const p of MOCK_PARAMS) params.delete(p)
    const qs = params.toString()
    history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`)
  }

  const worker = setupWorker(...restHandlers, ...realtimeHandlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })

  window.__kurio = {
    scenarios: SCENARIOS,
    latencies: LATENCIES,
    getConfig,
    setConfig(patch) {
      setConfig(patch)
      return getConfig()
    },
    reset() {
      db.resetDb()
      resetConfig()
      restoreRealtime()
    },
    updateNft(id, patch) {
      return !!db.updateNft(id, patch)
    },
    expireSessions: db.expireAllSessions,
    resolveOrder(id, outcome) {
      return !!db.resolveOrder(id, outcome)
    },
    pendingOrders: () => db.pendingOrders().map((o) => o.id),
    realtime: {
      drop: dropRealtime,
      restore: restoreRealtime,
      isDown: isRealtimeDown,
      connections: connectionCount,
      replayLast: () => replayEvent()?.id ?? null,
      replay: (id) => replayEvent(id)?.id ?? null,
      sendStale: (id) => sendStaleNftEvent(id)?.id ?? null,
    },
  }
  window.__kurioMockReady = true
}
