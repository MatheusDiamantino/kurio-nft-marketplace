import { expect, test } from './fixtures'

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** 8. Edição de perfil, avatar, senha e carteiras, com erros de validação. */
test.describe('perfil e carteiras', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('/')
    await app.loginViaApi('ana')
  })

  test('perfil: validação local, erros da API e persistência após refresh', async ({ app, page }) => {
    await app.goto('/account/profile')
    const name = page.getByLabel(/^Nome de exibição/)
    await expect(name).toHaveValue('Ana Souza')

    await page.getByLabel(/^E-mail/).first().fill('email-invalido')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByLabel(/^E-mail/).first()).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel(/^E-mail/).first()).toBeFocused()

    // Conflito: e-mail de outro usuário (409 da API mapeado para o campo).
    await page.getByLabel(/^E-mail/).first().fill('bruno@kurio.dev')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible()

    await page.getByLabel(/^E-mail/).first().fill('ana@kurio.dev')
    await name.fill('Ana S. Colecionadora')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText(/salv|atualizad/i).first()).toBeVisible()
    await app.reload()
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue('Ana S. Colecionadora')
  })

  test('avatar: envio, persistência e remoção', async ({ app, page }) => {
    await app.goto('/account/profile')
    await page.getByLabel('Arquivo de avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(page.getByRole('img', { name: /Avatar de Ana/ }).first()).toBeVisible()
    await app.reload()
    await expect(page.getByRole('img', { name: /Avatar de Ana/ }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByRole('img', { name: /Avatar de Ana/ })).toHaveCount(0)
  })

  test('senha: senha atual incorreta é rejeitada pela API; troca válida funciona no próximo login', async ({ app, page }) => {
    await app.goto('/account/profile')
    await page.getByLabel('Senha atual', { exact: true }).fill('Errada123')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('A senha atual está incorreta.')).toBeVisible()

    await page.getByLabel('Senha atual', { exact: true }).fill('Kurio@123')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText(/senha atualizad/i).first()).toBeVisible()

    const status = await page.evaluate(async () => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ana@kurio.dev', password: 'NovaSenha1' }),
      })
      return r.status
    })
    expect(status).toBe(200)
  })

  test('carteiras: validação, edição da principal e cadastro da secundária', async ({ app, page }) => {
    await app.goto('/account/wallets')
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByLabel(/Endereço da carteira/).fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByLabel(/Endereço da carteira/)).toHaveAttribute('aria-invalid', 'true')

    await primary.getByLabel(/Endereço da carteira/).fill('0x1111111111111111111111111111111111111111')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText(/carteira.*salva/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar carteira secundária' }).click()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await page.getByLabel('Igual à carteira principal').check()
    await secondary.getByLabel(/Endereço da carteira/).fill('0x2222222222222222222222222222222222222222')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText(/carteira.*salva/i).first()).toBeVisible()

    await app.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel(/Endereço da carteira/)).toHaveValue(
      '0x1111111111111111111111111111111111111111',
    )
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByLabel(/Endereço da carteira/)).toHaveValue(
      '0x2222222222222222222222222222222222222222',
    )
  })

  test('carteiras: erros de campo retornados pela API', async ({ app, page }) => {
    await app.setScenario('validation-error')
    await app.goto('/account/wallets')
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Endereço não encontrado na rede selecionada.')).toBeVisible()
  })
})
