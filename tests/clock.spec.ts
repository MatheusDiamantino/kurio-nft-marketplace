import { expect, test } from './fixtures'

test.describe('cenários controlados pelo relógio', () => {
  test('pagamento só liquida quando o relógio avança, sem polling nem nova compra', async ({ app, page }) => {
    await page.clock.install({ time: new Date('2026-07-29T12:00:00-03:00') })
    await app.open('/', { orderResolutionMs: 60_000 })
    await app.loginViaApi('ana')
    await app.seedFigmaCart()
    await app.goto('/checkout')
    await page.getByLabel(/^Código de indicação/).fill('KURIO-ANA')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    const pending = page.getByRole('heading', { name: 'Pagamento em processamento' })
    await expect(pending).toBeVisible()

    await page.clock.runFor(30_000)
    await expect(pending).toBeVisible()
    expect(await app.mock((k) => k.pendingOrders())).toHaveLength(1)

    await page.clock.runFor(31_000)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    expect(await app.mock((k) => k.pendingOrders())).toHaveLength(0)
  })

  test('sessão expira pelo tempo (TTL de 2 h) e a navegação privada volta ao login', async ({ app, page }) => {
    await page.clock.install({ time: new Date('2026-07-29T12:00:00-03:00') })
    await app.open('/')
    await app.loginViaApi('ana')
    await app.goto('/account/profile')
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue('Ana Souza')

    await page.clock.fastForward('02:00:01')
    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Carteiras' }).click()

    await expect(page).toHaveURL(/\/login\?redirect=/)
    await expect(page.getByText('Sua sessão expirou.')).toBeVisible()
  })
})
