import { expect, isMobile, test } from './fixtures'

/** 11. Navegação por teclado, foco de diálogos e validação de formulários. */
test.describe('acessibilidade', () => {
  test('link "pular para o conteúdo" e foco visível via teclado', async ({ app, page }) => {
    await app.open('/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card').first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
    // O foco visível usa outline (não depende só de cor de fundo).
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
    expect(outline).not.toBe('none')
  })

  test('diálogo de login prende o foco e fecha com Escape', async ({ app, page }) => {
    test.skip(isMobile(page), 'login é tela cheia no mobile')
    await app.open('/login')
    const dialog = page.getByTestId('auth-dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      const inside = await dialog.evaluate((d) => d.contains(document.activeElement))
      expect(inside).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/)
  })

  test('zoom da imagem no detalhe: foco entra no diálogo e retorna ao gatilho', async ({ app, page }) => {
    test.skip(isMobile(page), 'zoom disponível no layout desktop')
    await app.open('/nft/emerald-ape-042')
    const trigger = page.getByRole('button', { name: /Ampliar imagem de Emerald Ape/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('login operável só pelo teclado com erros associados aos campos', async ({ app, page }) => {
    await app.open('/login')
    const email = page.getByLabel('E-mail', { exact: true })
    await email.fill('')
    await email.focus()
    await page.keyboard.type('nao-e-email')
    await page.keyboard.press('Enter')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy!.split(' ')[0]}"]`)).toContainText(/e-mail/i)
  })

  test('filtros e paginação acessíveis por teclado', async ({ app, page }) => {
    test.skip(isMobile(page), 'sidebar desktop')
    await app.open('/')
    const music = page.getByRole('button', { name: /^Música/ })
    await music.focus()
    await page.keyboard.press('Enter')
    await expect(music).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/collection/)
  })

  test('sem overflow horizontal nas larguras avaliadas', async ({ app, page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/nft/emerald-ape-042', '/cart', '/login']) {
        await app.goto(path)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(1)
      }
    }
  })
})
