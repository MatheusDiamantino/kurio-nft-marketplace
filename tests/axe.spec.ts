import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test, type App } from './fixtures'

const DESIGN_EXCEPTION_HERO_DOTS = '[aria-label^="Mostrar destaque"]'

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-sonner-toaster]')
    .exclude(DESIGN_EXCEPTION_HERO_DOTS)
    .analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}x — ${v.nodes[0]?.target.join(' ')}`)
  expect(summary, summary.join('\n')).toEqual([])
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

const PUBLIC: [string, (app: App, page: Page) => Promise<void>][] = [
  ['início', async (app, page) => {
    await app.open('/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  }],
  ['detalhe', async (app, page) => {
    await app.open('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }],
  ['carrinho', async (app, page) => {
    await app.open('/')
    await app.seedFigmaCart()
    await app.goto('/cart')
    await expect(page.getByTestId('summary-total')).toBeVisible()
  }],
  ['login', async (app, page) => {
    await app.open('/login')
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  }],
  ['cadastro', async (app, page) => {
    await app.open('/register')
    await expect(page.getByLabel(/^Nome de usuário/)).toBeVisible()
  }],
  ['404', async (app, page) => {
    await app.open('/nao-existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  }],
]

const PRIVATE: [string, string, (page: Page) => Promise<void>][] = [
  ['pagamento', '/checkout', async (page) => {
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue(/.+/)
  }],
  ['perfil', '/account/profile', async (page) => {
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue(/.+/)
  }],
  ['carteiras', '/account/wallets', async (page) => {
    await expect(page.getByRole('form', { name: 'Carteira principal' })).toBeVisible()
  }],
  ['favoritos', '/account/favorites', async (page) => {
    await expect(page.getByTestId('favorites-grid').getByTestId('nft-card').first()).toBeVisible()
  }],
]

test.describe('axe (WCAG 2.2 AA) sem violações', () => {
  for (const [name, open] of PUBLIC) {
    test(name, async ({ app, page }) => {
      await open(app, page)
      await settle(page)
      await audit(page)
    })
  }

  for (const [name, path, ready] of PRIVATE) {
    test(name, async ({ app, page }) => {
      await app.open('/')
      await app.loginViaApi('ana')
      await app.seedFigmaCart()
      await app.goto(path)
      await ready(page)
      await settle(page)
      await audit(page)
    })
  }
})
