import { expect, isMobile, test } from './fixtures'

/** 2. Acesso direto ao detalhe e tratamento de recurso inexistente. */
test.describe('detalhe do NFT', () => {
  test('acesso direto mostra informações, edição esgotada e limite de quantidade', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page).toHaveTitle(/Emerald Ape #042/)

    // A edição 1/1 está esgotada no seed → desabilitada e anunciada.
    await expect(page.getByRole('radio', { name: '1/1 (esgotada)' })).toBeDisabled()

    // 1/10 tem disponibilidade limitada: o "+" para no máximo.
    await page.getByRole('radio', { name: '1/10' }).click()
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let i = 0; i < 15 && (await plus.isEnabled()); i++) await plus.click()
    await expect(plus).toBeDisabled()
    const max = Number(await page.locator('output').first().textContent())
    expect(max).toBeGreaterThan(1)
    expect(max).toBeLessThanOrEqual(10)
  })

  test('NFT inexistente mostra estado de não encontrado', async ({ app, page }) => {
    await app.open('/nft/nao-existe-123')
    await expect(page.getByText('NFT não encontrado')).toBeVisible()
    await expect(page.getByRole('link', { name: /início|mercado|catálogo/i }).first()).toBeVisible()
  })

  test('rota inexistente mostra 404', async ({ app, page }) => {
    await app.open('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('comprar adiciona ao carrinho com a edição e a quantidade escolhidas', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await page.getByRole('radio', { name: '1/50' }).click()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    if (isMobile(page)) await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
    else await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.getByTestId('summary-subtotal')).toContainText('2.38 ETH')
  })
})
