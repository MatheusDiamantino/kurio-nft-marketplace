import { test as base, expect, type Page } from '@playwright/test'
import type { EditionId, Session } from '../src/api/contracts'
import type { KurioMockControl } from '../src/mocks/browser'
import type { MockConfig } from '../src/mocks/config'

/**
 * Shared E2E helpers. Every interaction with the backend goes through the
 * MSW handlers (REST) or the Socket.IO mock (events) — tests only drive the
 * mock *server* via window.__kurio, never the app's internal state.
 */

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@123', name: 'Ana Souza', id: 'u_ana' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@123', name: 'Bruno Lima', id: 'u_bruno' },
} as const

export type UserKey = keyof typeof USERS

interface OpenOptions {
  scenario?: MockConfig['scenario']
  latency?: MockConfig['latency']
  orderResolutionMs?: number
}

export class App {
  constructor(readonly page: Page) {}

  /** Reset the mock server to the seed and open `path` (isolated state per test). */
  async open(path = '/', opts: OpenOptions = {}) {
    const params = new URLSearchParams({ 'mock-reset': '1', latency: opts.latency ?? 'none', mockPanel: '0' })
    if (opts.scenario) params.set('scenario', opts.scenario)
    params.set('orderResolutionMs', String(opts.orderResolutionMs ?? 600))
    const [pathname, query = ''] = path.split('?')
    for (const [k, v] of new URLSearchParams(query)) params.set(k, v)
    await this.page.goto(`${pathname}?${params}`)
    await this.ready()
  }

  async goto(path: string) {
    await this.page.goto(path)
    await this.ready()
  }

  async reload() {
    await this.page.reload()
    await this.ready()
  }

  async ready() {
    await this.page.waitForFunction(() => window.__kurioMockReady === true)
  }

  /** Run a function against the mock control surface in the page. */
  mock<T>(fn: (k: KurioMockControl, arg: never) => T | Promise<T>): Promise<T>
  mock<T, A>(fn: (k: KurioMockControl, arg: A) => T | Promise<T>, arg: A): Promise<T>
  mock<T, A>(fn: (k: KurioMockControl, arg: A) => T | Promise<T>, arg?: A): Promise<T> {
    return this.page.evaluate(
      ({ src, a }) => {
        // eslint-disable-next-line no-new-func
        const f = new Function('k', 'a', `return (${src})(k, a)`)
        return f(window.__kurio, a)
      },
      { src: fn.toString(), a: arg as A },
    ) as Promise<T>
  }

  async setScenario(scenario: MockConfig['scenario'], extra: Partial<MockConfig> = {}) {
    await this.mock((k, a) => k.setConfig(a), { scenario, ...extra })
  }

  /**
   * Authenticate through the real REST endpoint (MSW) and persist the session
   * the same way the app does, then reload. UI login is covered in auth.spec.
   */
  async loginViaApi(user: UserKey = 'ana') {
    const { email, password } = USERS[user]
    const session = await this.page.evaluate(
      async ({ email, password }) => {
        const guestCartId = localStorage.getItem('kurio.guestCartId') ?? undefined
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password, guestCartId }),
        })
        if (!res.ok) throw new Error(`login failed ${res.status}`)
        const s = (await res.json()) as Session
        localStorage.setItem('kurio.session', JSON.stringify(s))
        localStorage.removeItem('kurio.guestCartId')
        return s
      },
      { email, password },
    )
    await this.reload()
    return session
  }

  /** Seed the current user's cart through the REST API (MSW handlers). */
  async addToCartViaApi(items: { nftId: string; editionId?: EditionId; quantity: number }[]) {
    await this.page.evaluate(async (list) => {
      const raw = localStorage.getItem('kurio.session')
      const token = raw ? (JSON.parse(raw) as Session).token : null
      for (const item of list) {
        const headers: Record<string, string> = { 'content-type': 'application/json' }
        if (token) headers.authorization = `Bearer ${token}`
        const cartId = localStorage.getItem('kurio.guestCartId')
        if (!token && cartId) headers['X-Cart-Id'] = cartId
        const res = await fetch('/api/cart/items', {
          method: 'POST',
          headers,
          body: JSON.stringify({ nftId: item.nftId, editionId: item.editionId ?? '1-50', quantity: item.quantity }),
        })
        const cart = await res.json()
        if (!token && cart.id) localStorage.setItem('kurio.guestCartId', cart.id)
      }
    }, items)
  }

  /** The Figma cart: Emerald Ape x2, Violet Nomad x6, Ivory Baron x9. */
  async seedFigmaCart() {
    await this.addToCartViaApi([
      { nftId: 'emerald-ape-042', quantity: 2 },
      { nftId: 'violet-nomad-314', quantity: 6 },
      { nftId: 'ivory-baron-088', quantity: 9 },
    ])
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await use(new App(page))
  },
})

export { expect }

export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 768
}
