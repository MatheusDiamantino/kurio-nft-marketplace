import './index.css'

async function boot() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app')
  renderApp(document.getElementById('root')!)
}

void boot()
