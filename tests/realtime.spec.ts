import { expect, test } from './fixtures'

test.describe('tempo real', () => {
  test('nft.updated atualiza catálogo e detalhe; duplicados e antigos são ignorados', async ({ app, page }) => {
    await app.open('/nft/neon-vessel-552')
    const h1 = page.getByRole('heading', { level: 1, name: 'Neon Vessel #552' })
    await expect(h1).toBeVisible()
    const main = page.locator('main')
    await expect(main).toContainText('1.99 ETH')

    await app.mock((k) => k.updateNft('neon-vessel-552', { price: '2.49' }))
    await expect(main).toContainText('2.49 ETH')

    await app.mock((k) => k.realtime.replayLast())
    await app.mock((k) => k.realtime.sendStale('neon-vessel-552'))
    await page.waitForTimeout(500)
    await expect(main).toContainText('2.49 ETH')
    await expect(main).not.toContainText('999.99')
  })

  test('queda do Socket.IO é anunciada e a reconexão reconcilia com o REST', async ({ app, page }) => {
    await app.open('/nft/neon-vessel-552')
    await expect(page.getByRole('heading', { level: 1, name: 'Neon Vessel #552' })).toBeVisible()
    await app.mock((k) => k.realtime.drop())
    await expect(page.getByText(/Atualizações em tempo real indisponíveis/)).toBeVisible()
    
    await app.mock((k) => k.updateNft('neon-vessel-552', { price: '3.10' }))
    await page.waitForTimeout(400)
    await expect(page.locator('main')).not.toContainText('3.10 ETH')
    
    await app.mock((k) => k.realtime.restore())
    await expect(page.locator('main')).toContainText('3.10 ETH', { timeout: 15_000 })
    await expect(page.getByText(/Atualizações em tempo real indisponíveis/)).toBeHidden()
  })

  test('pedido pendente sobrevive a desconexão e refresh e conclui sem nova compra', async ({ app, page }) => {
    await app.open('/', { scenario: 'payment-hold' })
    await app.loginViaApi('ana')
    await app.seedFigmaCart()
    await app.goto('/checkout')
    await page.getByLabel(/^Código de indicação/).fill('KURIO-ANA')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
    const orderId = page.url().split('/orders/')[1]

    await app.mock((k) => k.realtime.drop())
    await app.reload()
    await expect(page.getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()

    await app.goto('/checkout')
    await expect(page.getByText('Você tem um pedido em processamento')).toBeVisible()
    await page.getByRole('link', { name: 'Acompanhar pedido' }).click()
    await expect(page).toHaveURL(new RegExp(orderId))

    await app.mock((k, id) => k.resolveOrder(id, 'confirmed'), orderId)
    await app.mock((k) => k.realtime.restore())
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 20_000 })
    expect(await app.mock((k) => k.pendingOrders())).toHaveLength(0)
  })

  test('order.updated de outro usuário não chega à sessão atual', async ({ app, page }) => {
    await app.open('/', { scenario: 'payment-hold' })
    
    await app.loginViaApi('ana')
    await app.seedFigmaCart()
    await app.goto('/checkout')
    await page.getByLabel(/^Código de indicação/).fill('KURIO-ANA')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
    const orderId = page.url().split('/orders/')[1]
    
    await app.loginViaApi('bruno')
    await app.goto('/')
    await app.mock((k, id) => k.resolveOrder(id, 'confirmed'), orderId)
    await page.waitForTimeout(600)
    await expect(page.getByText('Pagamento confirmado na rede.')).toHaveCount(0)
    await app.goto(`/orders/${orderId}`)
    await expect(page.getByRole('heading', { name: 'Este pedido pertence a outra conta' })).toBeVisible()
  })
})
