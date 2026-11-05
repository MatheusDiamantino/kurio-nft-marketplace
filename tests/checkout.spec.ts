import type { Page } from '@playwright/test'
import { expect, test, type App } from './fixtures'

async function goToReview(app: App, page: Page) {
  await app.goto('/checkout')
  await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue(/.+/)
  await page.getByLabel(/^Código de indicação/).fill('KURIO-ANA')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Revisão do pedido' })).toBeVisible()
}

async function setup(app: App, scenario?: Parameters<App['open']>[1]['scenario']) {
  await app.open('/', { scenario })
  await app.loginViaApi('ana')
  await app.seedFigmaCart()
}

/** 6. Compra completa, do catálogo ao recibo confirmado. */
test('compra completa do catálogo ao recibo confirmado', async ({ app, page }) => {
  await app.open('/')
  await app.loginViaApi('ana')
  // Catálogo → detalhe → carrinho
  await page.getByTestId('catalog-grid').getByRole('link', { name: 'Golden Beat #207', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Golden Beat #207' })).toBeVisible()
  await page.getByRole('radio', { name: '1/50' }).click()
  const buy = page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).filter({ visible: true })
  await buy.first().click()
  await expect(page).toHaveURL(/\/cart$/)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout/)

  // Validação dos campos do layout antes da revisão.
  await page.getByLabel(/^Código de indicação/).fill('')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByLabel(/^Código de indicação/)).toHaveAttribute('aria-invalid', 'true')

  await page.getByLabel(/^Código de indicação/).fill('KURIO-ANA')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/orders\/ord_/)
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('receipt-line')).toHaveCount(1)
  await expect(page.getByTestId('receipt-line')).toContainText('Golden Beat #207')
  await expect(page.getByTestId('receipt-total')).toContainText('1.006 ETH')
  await expect(page.getByTestId('order-tx')).toContainText('0x')

  // O recibo é um snapshot: mudar o catálogo depois não altera seus valores.
  await app.mock((k) => k.updateNft('golden-beat-207', { price: '5.00' }))
  await app.reload()
  await expect(page.getByTestId('receipt-total')).toContainText('1.006 ETH')
  // Itens comprados saíram do carrinho.
  await app.goto('/cart')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

/** 7. Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido. */
test.describe('falhas no pagamento', () => {
  test('pagamento recusado preserva o carrinho', async ({ app, page }) => {
    await setup(app, 'payment-declined')
    await goToReview(app, page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('summary-subtotal')).toContainText('26.83 ETH')
  })

  test('cliques repetidos criam um único pedido', async ({ app, page }) => {
    await setup(app, 'payment-hold')
    await goToReview(app, page)
    const confirm = page.getByRole('button', { name: 'Confirmar compra' })
    await confirm.evaluate((el: HTMLButtonElement) => {
      el.click()
      el.click()
      el.click()
    })
    await expect(page).toHaveURL(/\/orders\/ord_/)
    expect(await app.mock((k) => k.pendingOrders())).toHaveLength(1)
  })

  test('timeout após criação recupera o mesmo pedido por idempotência', async ({ app, page }) => {
    await setup(app, 'order-timeout')
    await goToReview(app, page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/orders\/ord_/, { timeout: 15_000 })
    const orderId = page.url().split('/orders/')[1]
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15_000 })
    // Apenas um pedido existe e é o mesmo exibido.
    const orders = await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('kurio.session')!)
      const r = await fetch('/api/orders', { headers: { authorization: `Bearer ${s.token}` } })
      return ((await r.json()) as { items: { id: string }[] }).items.map((o) => o.id)
    })
    expect(orders).toEqual([orderId])
  })
})

/** 9. Alteração de preço/disponibilidade via Socket.IO durante o checkout. */
test.describe('tempo real no checkout', () => {
  test('preço muda durante a revisão: confirmação bloqueada até aceitar os novos valores', async ({ app, page }) => {
    await setup(app)
    await goToReview(app, page)
    await app.mock((k) => k.updateNft('emerald-ape-042', { price: '1.29' }))
    const changed = page.getByTestId('quote-changed')
    await expect(changed).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('receipt-total')).toContainText('27.046 ETH', { timeout: 15_000 })
  })

  test('edição esgota no momento da compra: servidor recusa e a interface orienta o ajuste', async ({ app, page }) => {
    await setup(app, 'sold-out-checkout')
    await goToReview(app, page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ajustar itens no carrinho' })).toBeVisible()
    expect(await app.mock((k) => k.pendingOrders())).toHaveLength(0)
  })

  test('carrinho aberto: alteração de preço é anunciada e o resumo é atualizado', async ({ app, page }) => {
    await setup(app)
    await app.goto('/cart')
    await expect(page.getByTestId('summary-total')).toContainText('26.846 ETH')
    await app.mock((k) => k.updateNft('emerald-ape-042', { price: '1.29' }))
    await expect(page.getByTestId('live-notice').first()).toContainText('Emerald Ape #042')
    await expect(page.getByTestId('summary-total')).toContainText('27.046 ETH')
  })
})
