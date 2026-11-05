import './index.css'

const INTRO_MIN_MS = 1100
const SEEN_KEY = 'kurio.intro.seen'

function hideIntro(startedAt: number) {
  const intro = document.getElementById('intro')
  if (!intro) return
  let seen = false
  try {
    seen = sessionStorage.getItem(SEEN_KEY) === '1'
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    seen = false
  }
  const wait = seen || navigator.webdriver ? 0 : Math.max(0, INTRO_MIN_MS - (performance.now() - startedAt))
  setTimeout(() => {
    intro.classList.add('done')
    intro.addEventListener('transitionend', () => intro.remove(), { once: true })
    setTimeout(() => intro.remove(), 800)
  }, wait)
}

async function boot() {
  const startedAt = performance.now()
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app')
  renderApp(document.getElementById('root')!)
  requestAnimationFrame(() => hideIntro(startedAt))
}

void boot()
