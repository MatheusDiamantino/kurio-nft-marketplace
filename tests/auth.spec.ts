import { expect, isMobile, test, USERS } from './fixtures'

test.describe('conta e sessão', () => {
  test('cadastro valida campos, trata conflito e cria a conta', async ({ app, page }) => {
    await app.open('/register')
    const submit = page.getByRole('button', { name: isMobile(page) ? 'Criar perfil' : 'Criar conta', exact: true })
    await submit.click()
    await expect(page.getByLabel(/^Nome de usuário/)).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel(/^Nome de usuário/).fill('novo.colecionador')
    await page.getByLabel(/^E-mail/).first().fill(USERS.ana.email)
    await page.getByLabel(/^Senha/).first().fill('Segura123')
    await page.getByLabel(/^Confirmar senha/).fill('Segura123')
    await submit.click()

    await expect(page.getByText(/já está cadastrado/)).toBeVisible()
    await expect(page.getByLabel(/^E-mail/).first()).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel(/^E-mail/).first().fill('novo@kurio.dev')
    await submit.click()
    await expect(page).toHaveURL(/\/$|\/\?/)
    await app.goto('/account/profile')
    await expect(page.getByLabel(/^E-mail/).first()).toHaveValue('novo@kurio.dev')
  })

  test('login com erro, sucesso com retorno ao fluxo anterior e sessão recuperada após refresh', async ({ app, page }) => {
    await app.open('/account/wallets')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()

    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/account\/wallets/)
    await app.reload()
    await expect(page).toHaveURL(/\/account\/wallets/)
    await expect(page.getByRole('form', { name: 'Carteira principal' })).toBeVisible()
  })

  test('expiração de sessão durante a navegação leva ao login e retoma o fluxo', async ({ app, page }) => {
    await app.open('/')
    await app.loginViaApi('ana')
    await app.goto('/account/profile')
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue(USERS.ana.name)
    await app.mock((k) => k.expireSessions())
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await expect(page.getByText('Sua sessão expirou.')).toBeVisible()
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/account\//)
  })

  test('logout e troca de usuário não vazam dados privados', async ({ app, page }) => {
    await app.open('/')
    await app.loginViaApi('ana')
    await app.goto('/account/favorites')
    await expect(page.getByTestId('favorites-grid').getByTestId('nft-card')).toHaveCount(2)
    await expect(page.getByTestId('favorites-grid')).toContainText('Emerald Ape #042')

    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await app.goto('/account/favorites')
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('E-mail', { exact: true }).fill(USERS.bruno.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.bruno.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/account\/favorites/)
    const grid = page.getByTestId('favorites-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(1)
    await expect(grid).toContainText('Golden Signal #160')
    await expect(grid).not.toContainText('Emerald Ape #042')
  })
})
