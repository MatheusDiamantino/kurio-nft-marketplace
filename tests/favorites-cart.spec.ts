import { expect, test, USERS } from './fixtures'

test.describe('favoritos', () => {
  test('favoritar persiste para o usuário; falha faz rollback do estado otimista', async ({ app, page }) => {
    await app.open('/')
    await app.loginViaApi('ana')
    await app.goto('/nft/golden-beat-207')
    const fav = page.getByRole('button', { name: /^Favoritar$/ })
    await fav.click()
    await expect(page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ })).toHaveAttribute('aria-pressed', 'true')
    await app.reload()
    await expect(page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ })).toHaveAttribute('aria-pressed', 'true')

    await app.setScenario('favorite-fail')
    await app.goto('/nft/golden-signal-160')
    await page.getByRole('button', { name: /^Favoritar$/ }).click()
    await expect(page.getByText(/Não foi possível favoritar/)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Favoritar$/ })).toHaveAttribute('aria-pressed', 'false')

    await app.setScenario('default')
    await page.getByRole('button', { name: /^Favoritar$/ }).click()
    await expect(page.getByRole('button', { name: /Favoritado|Remover dos favoritos/ })).toHaveAttribute('aria-pressed', 'true')
    await app.goto('/account/favorites')
    await expect(page.getByTestId('favorites-grid')).toContainText('Golden Signal #160')
  })

  test('visitante é enviado ao login ao favoritar', async ({ app, page }) => {
    await app.open('/nft/golden-beat-207')
    await page.getByRole('button', { name: /^Favoritar$/ }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Fgolden-beat-207|\/login\?redirect=\/nft\/golden-beat-207/)
  })
})

test.describe('carrinho', () => {
  test('quantidades, remoção, cupom inválido/expirado/válido e resumo coerente com a API', async ({ app, page }) => {
    await app.open('/')
    await app.seedFigmaCart()
    await app.goto('/cart')
    await expect(page.getByTestId('summary-subtotal')).toContainText('26.83 ETH')
    await expect(page.getByTestId('summary-fee')).toContainText('0.016 ETH')
    await expect(page.getByTestId('summary-total')).toContainText('26.846 ETH')

    const coupon = page.getByLabel('Código promocional')
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: /Cupom inválido/ })).toBeVisible()
    await coupon.fill('VERAO2024')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: /Cupom expirado/ })).toBeVisible()
    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('applied-coupon')).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).toContainText('2.683')
    await expect(page.getByTestId('summary-total')).toContainText('24.163 ETH')

    await page.getByRole('group', { name: 'Quantidade de Ivory Baron #088' }).getByRole('button', { name: 'Diminuir quantidade' }).click()
    await expect(page.getByTestId('summary-subtotal')).toContainText('25.04 ETH')
    await page.getByRole('button', { name: 'Remover Violet Nomad #314 do carrinho' }).click()
    await expect(page.getByTestId('summary-subtotal')).toContainText('16.70 ETH')

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('summary-discount')).not.toContainText('1.67')

    await app.reload()
    await expect(page.getByTestId('summary-subtotal')).toContainText('16.70 ETH')
  })

  test('itens do visitante são preservados ao autenticar', async ({ app, page }) => {
    await app.open('/')
    await app.addToCartViaApi([{ nftId: 'golden-beat-207', quantity: 3 }])
    await app.goto('/cart')
    await expect(page.getByTestId('summary-subtotal')).toContainText('2.97 ETH')
    await app.reload()
    await expect(page.getByTestId('summary-subtotal')).toContainText('2.97 ETH')

    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByText('Golden Beat #207').first()).toBeVisible()
    await page.getByLabel(/^Nome de exibição/).fill('Visitante')
    await page.getByLabel(/^Nome de usuário/).fill('visitante')
    await page.getByLabel(/^Nome do perfil/).fill('visitante')
    await page.getByLabel(/^Código de indicação/).fill('GUEST-CODE')
    await page.getByLabel(/^E-mail/).first().fill('visitante@kurio.dev')
    await page.getByLabel(/^Nome ENS/).fill('visitante')
    await page.getByRole('radio', { name: 'Coinbase Wallet' }).check()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByText('Golden Beat #207').first()).toBeVisible()
    
    await expect(page.getByLabel(/^Código de indicação/)).toHaveValue('GUEST-CODE')
    await app.goto('/cart')
    await expect(page.getByTestId('summary-subtotal')).toContainText('2.97 ETH')
  })

  test('carrinho vazio', async ({ app, page }) => {
    await app.open('/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })
})
