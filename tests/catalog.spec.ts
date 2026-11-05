import { expect, isMobile, test } from './fixtures'

/** 1. Busca, filtros combinados, ordenação, paginação e restauração pelo histórico. */
test.describe('catálogo', () => {
  test('filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico', async ({ app, page }) => {
    test.skip(isMobile(page), 'filtros desktop (mobile coberto em teste próprio)')
    await app.open('/')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByTestId('catalog-count')).toContainText('60')

    // Página 2 → depois um filtro deve reiniciar a paginação.
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)

    await page.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await page.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(page.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/collection/)
    await expect(page).toHaveURL(/network/)

    await page.getByRole('combobox', { name: /Ordenar por/ }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)

    // Os resultados refletem os parâmetros: todos Música + Ethereum, em ordem crescente de preço.
    const prices = await grid.getByTestId('nft-card').evaluateAll((cards) =>
      cards.map((c) => Number(c.textContent!.match(/(\d+\.\d+) ETH/)![1])),
    )
    expect(prices.length).toBeGreaterThan(0)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    const filteredCount = await page.getByTestId('catalog-count').textContent()

    // Refresh mantém o estado.
    await app.reload()
    await expect(page.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('catalog-count')).toHaveText(filteredCount!)

    // Voltar no histórico desfaz a ordenação; avançar refaz.
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=price-asc/)
    await page.goForward()
    await expect(page).toHaveURL(/sort=price-asc/)
  })

  test('busca por texto atualiza a URL e o resultado; voltar restaura a lista completa', async ({ app, page }) => {
    await app.open('/')
    const input = isMobile(page) ? page.locator('#mobile-search') : page.locator('#catalog-search')
    await input.fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    const cards = page.getByTestId('catalog-grid').getByTestId('nft-card')
    await expect(cards.first()).toContainText(/Golden/i)
    for (const text of await cards.allTextContents()) expect(text.toLowerCase()).toContain('golden')
    await page.goBack()
    await expect(page).not.toHaveURL(/q=golden/)
    await expect(input).toHaveValue('')
  })

  test('filtros no mobile ficam num drawer com foco controlado', async ({ app, page }) => {
    test.skip(!isMobile(page), 'drawer de filtros é mobile')
    await app.open('/')
    const open = page.getByRole('button', { name: /Filtros e ordenação/ })
    await open.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /^Polygon/ }).click()
    await dialog.getByRole('button', { name: /^Ver \d+ resultados/ }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/network/)
    await expect(open).toBeFocused()
  })

  test('resultado vazio oferece limpar filtros', async ({ app, page }) => {
    await app.open('/?q=nao-existe-nada')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem o resultado atual', async ({ app, page }) => {
    await app.open('/', { scenario: 'out-of-order' })
    const input = isMobile(page) ? page.locator('#mobile-search') : page.locator('#catalog-search')
    // 1ª requisição (lenta) = "ivory"; 2ª (rápida) = "golden". A lenta chega depois e deve ser descartada.
    await input.fill('ivory')
    await expect(page).toHaveURL(/q=ivory/)
    await input.fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    const cards = page.getByTestId('catalog-grid').getByTestId('nft-card')
    await expect(cards.first()).toContainText(/Golden/i, { timeout: 10_000 })
    await page.waitForTimeout(2200) // tempo da resposta lenta chegar
    for (const text of await cards.allTextContents()) expect(text.toLowerCase()).toContain('golden')
  })
})

/** 12. Skeletons durante carregamento lento, feedback de falha e recuperação após nova tentativa. */
test.describe('carregamento e falhas', () => {
  test('skeletons com carregamento lento, erro e recuperação ao tentar novamente', async ({ app, page }) => {
    await app.open('/', { latency: 'slow', scenario: 'catalog-error' })
    // Skeletons (shimmer) preservam o grid enquanto a primeira resposta não chega.
    await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('alert').filter({ hasText: /catálogo|carregar/i }).first()).toBeVisible()

    await app.setScenario('default', { latency: 'none' })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  })

  test('detalhe mostra skeleton enquanto carrega', async ({ app, page }) => {
    await app.open('/')
    await app.setScenario('default', { latency: 'slow' })
    await app.goto('/nft/ivory-baron-088')
    await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Ivory Baron #088' })).toBeVisible({ timeout: 15_000 })
  })
})
