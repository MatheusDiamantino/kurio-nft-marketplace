import { useEffect, useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import type { MockConfig } from './config'

/**
 * Demo-only control panel for the mock server (scenario, latency, realtime
 * outage, reset). It talks exclusively to `window.__kurio` — the same surface
 * Playwright uses — so every effect still flows through MSW/Socket.IO.
 * Hidden with `?mockPanel=0` (used for visual baselines and Lighthouse).
 */
export function MockPanel() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<MockConfig | null>(null)
  const [down, setDown] = useState(false)
  const hidden = new URLSearchParams(location.search).get('mockPanel') === '0' || navigator.webdriver

  useEffect(() => {
    if (open && window.__kurio) {
      setConfig(window.__kurio.getConfig())
      setDown(window.__kurio.realtime.isDown())
    }
  }, [open])

  if (hidden || !window.__kurio) return null
  const k = window.__kurio

  return (
    <div className="fixed bottom-24 left-4 z-50 md:bottom-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-line-soft bg-surface px-3 py-2 text-xs font-bold text-sand shadow-lg hover:text-brand-accent"
          aria-label="Abrir painel de cenários simulados"
        >
          <FlaskConical className="size-4" aria-hidden />
          Mock
        </button>
      ) : (
        <section
          aria-label="Painel de cenários simulados"
          className="w-[min(92vw,340px)] rounded-sm border border-line-soft bg-surface p-4 text-xs text-sand shadow-2xl"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-cream">Cenários simulados (MSW)</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel" className="text-sand hover:text-brand-accent">
              <X className="size-4" aria-hidden />
            </button>
          </header>
          {config && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                Cenário
                <select
                  className="h-9 rounded-sm border border-line bg-ink px-2 text-cream"
                  value={config.scenario}
                  onChange={(e) => setConfig(k.setConfig({ scenario: e.target.value as MockConfig['scenario'] }))}
                >
                  {Object.entries(k.scenarios).map(([id, label]) => (
                    <option key={id} value={id}>
                      {id} — {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Latência
                <select
                  className="h-9 rounded-sm border border-line bg-ink px-2 text-cream"
                  value={config.latency}
                  onChange={(e) => setConfig(k.setConfig({ latency: e.target.value as MockConfig['latency'] }))}
                >
                  {Object.entries(k.latencies).map(([id, label]) => (
                    <option key={id} value={id}>
                      {id} — {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-sm border border-line-soft px-2 py-1 hover:text-brand-accent"
                  onClick={() => {
                    if (down) k.realtime.restore()
                    else k.realtime.drop()
                    setDown(!down)
                  }}
                >
                  {down ? 'Restaurar Socket.IO' : 'Derrubar Socket.IO'}
                </button>
                <button type="button" className="rounded-sm border border-line-soft px-2 py-1 hover:text-brand-accent" onClick={() => k.expireSessions()}>
                  Expirar sessões
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-line-soft px-2 py-1 hover:text-brand-accent"
                  onClick={() => {
                    const ok = window.confirm('Restaurar os dados simulados e sair da conta?')
                    if (!ok) return
                    k.reset()
                    localStorage.removeItem('kurio.session')
                    localStorage.removeItem('kurio.guestCartId')
                    location.assign('/')
                  }}
                >
                  Resetar dados
                </button>
              </div>
              <p className="text-[11px] leading-4 text-tan">
                Também via URL: <code>?scenario=…&amp;latency=…</code>, <code>?mock-reset=1</code>. Console: <code>window.__kurio</code>.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
