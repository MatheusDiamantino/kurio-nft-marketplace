# Kurio

Marketplace de NFTs feito para o [desafio de frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge).

Dá para navegar pelo catálogo, ver os detalhes de uma peça, montar o carrinho, pagar e acompanhar o pedido, além de editar o perfil e as carteiras. Não existe backend: as APIs, o login, o pagamento e o tempo real são simulados no navegador com MSW, então a aplicação funciona sozinha, inclusive no deploy.

- Demo: https://kurio-nft-marketplace-dun.vercel.app
- Decisões técnicas: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Lighthouse: [resultados](./lighthouse/summary.md) e [análise](./lighthouse/ANALYSIS.md)

## Rodando o projeto

Você precisa de Node 20.19 ou mais novo e do pnpm 9 (`corepack enable` resolve).

```bash
pnpm install
pnpm dev
```

A aplicação abre em http://localhost:5173, já com os mocks ligados.

Para entrar, use `ana@kurio.dev` ou `bruno@kurio.dev`, com a senha `Kurio@123`. O formulário de login já vem preenchido com a conta da Ana.

Os cupons disponíveis são `KURIO10` (10%) e `GENESIS25` (25%). O `VERAO2024` está expirado, de propósito.

### Outros comandos

```bash
pnpm build        # checa os tipos e gera o build em dist/
pnpm preview      # serve o build em http://localhost:4173
pnpm lint
pnpm typecheck
pnpm test:e2e     # testes com Playwright
pnpm lighthouse   # auditoria (rode o build antes)
```

Se quiser desligar os mocks e apontar para uma API real, crie um `.env.local` com `VITE_ENABLE_MOCKS=false`.

## Simulando cenários

Para testar falhas, lentidão e casos de borda, passe o cenário na URL, por exemplo `?scenario=payment-declined&latency=slow`. A escolha fica salva até você trocar ou resetar.

Os cenários mais úteis:

- `catalog-error` e `catalog-empty`: catálogo com erro ou vazio.
- `flaky`: a primeira tentativa de cada GET falha e o retry recupera.
- `favorite-fail`: favoritar dá erro e a interface desfaz a mudança.
- `price-change-checkout` e `sold-out-checkout`: o preço muda ou a edição esgota na hora de confirmar.
- `order-timeout`: a criação do pedido demora demais, mas o reenvio recupera o mesmo pedido, sem duplicar.
- `payment-declined` e `payment-hold`: pagamento recusado ou parado em pendente.
- `session-expired`, `wallet-reject` e `validation-error`.

A latência pode ser `none`, `fast` (padrão), `slow` ou `variable`. Para voltar ao estado inicial, use `?mock-reset=1` ou `__kurio.reset()` no console.

No console, `window.__kurio` permite mudar o preço de um NFT, expirar a sessão, derrubar o Socket.IO e resolver pedidos pendentes. Por exemplo:

```js
__kurio.updateNft('emerald-ape-042', { price: '1.29' }) // o aviso de preço aparece no carrinho
__kurio.realtime.drop()                                 // simula queda do tempo real
__kurio.realtime.restore()                              // reconecta e sincroniza
```

A lista completa de cenários e o passo a passo de cada fluxo de falha estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

## Testes

```bash
pnpm exec playwright install chromium   # só na primeira vez
pnpm test:e2e
```

Os testes rodam em desktop (1440 px) e mobile (390 px). Eles cobrem os fluxos de compra, os cenários de erro, os eventos de tempo real, a comparação visual com imagens de referência e a acessibilidade com axe. Cada teste começa com os dados zerados.

Se você mudar o visual de propósito, atualize as imagens com `pnpm test:e2e:update`.

## Deploy

O deploy fica na Vercel, configurado no `vercel.json`. O build publicado já inclui os mocks, então a demo funciona sem nenhum serviço externo.
