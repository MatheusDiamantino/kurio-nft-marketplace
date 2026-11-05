# Kurio — Marketplace de NFTs

Solução do [desafio frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): descoberta, compra e conta do colecionador, em desktop e mobile, com APIs, autenticação, carteiras, pagamento e tempo real **simulados na camada de rede** (MSW + Socket.IO).

- **Demo:** _URL de deploy_
- **Arquitetura, contratos, eventos, cache e desvios do Figma:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Lighthouse:** [lighthouse/summary.md](./lighthouse/summary.md) · análise e correções em [lighthouse/ANALYSIS.md](./lighthouse/ANALYSIS.md)

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS 4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · react-hook-form + zod · decimal.js · Playwright · Lighthouse.

## Setup

Requisitos: Node ≥ 20.19 e pnpm 9 (`corepack enable`).

```bash
pnpm install
pnpm dev                       # http://localhost:5173 — com mocks
```

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). Com `false`, a app usa `/api` e `wss://realtime.kurio.mock` reais, seguindo os mesmos contratos. |

Copie `.env.example` para `.env.local` se quiser mudar o valor.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Desenvolvimento com mocks |
| `pnpm build` | Verificação de tipos + build otimizado (`dist/`, com mocks: é o build de demonstração) |
| `pnpm preview` | Serve o build em http://localhost:4173 |
| `pnpm typecheck` | `tsc -b` |
| `pnpm lint` | oxlint |
| `pnpm test:e2e` | Playwright (faz build e preview automaticamente), em desktop 1440 e mobile 390 |
| `pnpm test:e2e:update` | Regera as baselines visuais |
| `pnpm test:e2e:report` | Abre o relatório HTML (`playwright-report/`, com traces das falhas) |
| `pnpm lighthouse` | Auditoria Lighthouse (rode `pnpm build` antes): 3 execuções × {home, detalhe} × {mobile, desktop}, com mediana em `lighthouse/summary.md` |

Na primeira vez, instale o navegador dos testes: `pnpm exec playwright install chromium`.

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Souza | `ana@kurio.dev` | `Kurio@123` |
| Bruno Lima | `bruno@kurio.dev` | `Kurio@123` |

Cupons: `KURIO10` (10%), `GENESIS25` (25%), `VERAO2024` (**expirado**). Qualquer outro código é inválido.

## Cenários simulados

Você pode escolher o cenário de três formas:
- **URL:** `?scenario=<id>&latency=<id>` em qualquer rota. O valor fica salvo e os parâmetros saem da URL.
- **Painel "Mock"** no canto inferior esquerdo da app.
- **Console:** `window.__kurio.setConfig({ scenario, latency })`.

Para restaurar o estado inicial: `?mock-reset=1`, o botão **Resetar dados** do painel ou `window.__kurio.reset()`.

| Cenário (`scenario`) | Efeito |
| --- | --- |
| `default` | Fluxo feliz |
| `catalog-empty` | Catálogo vazio |
| `catalog-error` | `GET /nfts` responde 500 |
| `flaky` | A 1ª tentativa de cada GET falha com 503 (o retry automático recupera) |
| `out-of-order` | Respostas do catálogo alternam lenta e rápida (as antigas chegam depois) |
| `offline` | Toda requisição REST falha na rede |
| `favorite-fail` | Favoritar ou desfavoritar responde 500 (rollback otimista) |
| `session-expired` | Toda requisição autenticada responde 401 `SESSION_EXPIRED` |
| `price-change-checkout` | Ao confirmar, o preço do 1º item sobe 0.10 ETH (`nft.updated` + `409 QUOTE_STALE`) |
| `sold-out-checkout` | Ao confirmar, a edição do 1º item esgota (`409 OUT_OF_STOCK`) |
| `order-timeout` | O pedido é criado, mas a 1ª resposta é `504`; o reenvio com a mesma chave recupera o mesmo pedido |
| `payment-declined` | O pagamento é recusado depois de ficar pendente |
| `payment-hold` | O pagamento fica pendente até `__kurio.resolveOrder(id, 'confirmed' \| 'declined')` |
| `wallet-reject` | A carteira recusa a conexão |
| `validation-error` | Perfil e carteiras respondem 422 com erros de campo |

| Latência (`latency`) | Atraso |
| --- | --- |
| `none` | 0 ms (testes) |
| `fast` | 150–300 ms (padrão) |
| `slow` | 2,5 s fixos (ver skeletons) |
| `variable` | 100–1800 ms, determinística por requisição |

Ações extras no console (`window.__kurio`):
- `updateNft(id, { price?, editions? })`: muda preço ou disponibilidade e emite `nft.updated`.
- `expireSessions()`: expira as sessões ativas.
- `resolveOrder(id, outcome)` e `pendingOrders()`: controlam pedidos pendentes.
- `realtime.drop()` / `realtime.restore()`: derrubam e restauram o Socket.IO.
- `realtime.replayLast()` / `realtime.sendStale(nftId)`: reenviam o último evento ou enviam um evento antigo.

### Como reproduzir os fluxos de falha

1. **Preço muda com o NFT no carrinho:** entre como Ana e adicione `Emerald Ape #042`. Com o carrinho ou o checkout aberto, rode `__kurio.updateNft('emerald-ape-042', { price: '1.29' })`. O aviso aparece e o resumo se atualiza. Na revisão do checkout, a confirmação fica bloqueada até você aceitar os novos valores.
2. **Edição esgotada:** `__kurio.updateNft('emerald-ape-042', { editions: { '1-50': 0 } })`, ou o cenário `sold-out-checkout`.
3. **Timeout com recuperação:** use `?scenario=order-timeout` e conclua a compra. A tela mostra "recuperando seu pedido" e termina no **mesmo** pedido (`__kurio.pendingOrders()` mostra apenas um).
4. **Pagamento recusado:** use `?scenario=payment-declined`. O carrinho é preservado.
5. **Queda do tempo real com pedido pendente:** use `?scenario=payment-hold`, confirme a compra e rode `__kurio.realtime.drop()`. Recarregue a página (o pedido continua pendente, sem duplicar), rode `__kurio.realtime.restore()` e depois `__kurio.resolveOrder('<id>', 'confirmed')`. A reconexão reconcilia e o recibo aparece.
6. **Sessão expirada no checkout:** com o checkout aberto, rode `__kurio.expireSessions()` e faça qualquer ação. Você vai para o login e, ao entrar, volta ao checkout com o rascunho preservado.
7. **Eventos duplicados ou antigos:** `__kurio.realtime.replayLast()` e `__kurio.realtime.sendStale('emerald-ape-042')`. A UI não muda.
8. **Falha e retry:** `?scenario=catalog-error&latency=slow` mostra skeletons e o erro. Mude o cenário para `default` no painel e clique em **Tentar novamente**.

## Testes

```bash
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:report
```

- Projetos `desktop` (1440×900) e `mobile` (Pixel 7, 390×844) no Chromium.
- Cada teste usa um contexto isolado e reseta o servidor simulado (`?mock-reset=1`, latência `none`).
- Os cenários sensíveis a tempo controlam latência, resolução do pedido e disparo dos eventos via `window.__kurio`. O REST passa pelos handlers do MSW e o tempo real pelo `socket.io-client`.
- A regressão visual cobre início, detalhe, carrinho e pagamento, com baselines versionadas em `tests/__screenshots__/`.
- Relatório HTML em `playwright-report/` e traces mantidos para os testes que falham.

## Deploy

Vercel (`vercel.json`): build `pnpm build`, saída `dist/`, rewrite de SPA para que o acesso direto e o refresh funcionem em qualquer rota. O `mockServiceWorker.js` é servido sem cache. O build publicado inclui os mocks e o tempo real simulado.
