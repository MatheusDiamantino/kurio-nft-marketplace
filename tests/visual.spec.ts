import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 50))
    }
    window.scrollTo(0, 0)
  })
  await page.evaluate(async () => {
    const pending = [...document.images].filter((img) => !img.complete)
    await Promise.race([
      Promise.all(pending.map((img) => new Promise((r) => img.addEventListener('load', r, { once: true })))),
      new Promise((r) => setTimeout(r, 5000)),
    ])
  })
  await page.waitForTimeout(400)
}

const mask = (page: Page) => [page.locator('[data-sonner-toaster]')]

test.describe('regressão visual', () => {
  test('início', async ({ app, page }) => {
    await app.open('/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: mask(page) })
  })

  test('detalhe', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: mask(page) })
  })

  test('carrinho', async ({ app, page }) => {
    await app.open('/')
    await app.seedFigmaCart()
    await app.goto('/cart')
    await expect(page.getByTestId('summary-total')).toContainText('26.846')
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: mask(page) })
  })

  test('pagamento', async ({ app, page }) => {
    await app.open('/')
    await app.loginViaApi('ana')
    await app.seedFigmaCart()
    await app.goto('/checkout')
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue(/.+/)
    await expect(page.getByTestId('summary-total')).toContainText('26.846')
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: mask(page) })
  })
})
