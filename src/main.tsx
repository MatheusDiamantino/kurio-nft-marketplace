import './index.css'

/**
 * Boot: the mock worker (MSW) starts first and the app is imported afterwards,
 * so no request escapes the simulation. (Loading both in parallel was measured
 * to be slower on throttled mobile: two large parse/eval tasks compete for the
 * main thread — see lighthouse/ANALYSIS.md.) socket.io-client is additionally
 * imported lazily by RealtimeClient, because engine.io-client captures
 * globalThis.WebSocket at import time.
 * Set VITE_ENABLE_MOCKS=false to run against a real backend with the same contracts.
 */
async function boot() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app')
  renderApp(document.getElementById('root')!)
}

void boot()
