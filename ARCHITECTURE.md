# Arquitetura — Kurio NFT Marketplace

Este documento descreve as decisões técnicas, os contratos REST e de eventos, a política de sessão, o estado do carrinho, a estratégia de cache, a reconciliação REST × Socket.IO, as limitações e os desvios em relação ao Figma.

## 1. Visão geral

```
src/
  api/          contracts.ts (tipos compartilhados) · client.ts (Axios + ApiError) · endpoints.ts
  auth/         session-store (token fora do React) · hooks de sessão e login/logout
  queries/      TanStack Query: chaves, políticas, hooks (catálogo, carrinho, cotação, conta, favoritos)
  realtime/     RealtimeClient (socket.io-client) · EventApplier (cache) · notices (avisos ao vivo)
  routes/       schemas de search params · rotas privadas
  router.tsx    TanStack Router (rotas em código, guards, lazy routes)
  components/   layout, shadcn/ui adaptado, componentes compartilhados
  pages/        telas
  mocks/        servidor simulado: db (estado), handlers REST, realtime (Socket.IO), cenários, painel
tests/          Playwright (E2E + regressão visual)
scripts/        auditoria Lighthouse
lighthouse/     configuração versionada + relatórios
```

**Fluxo de dados:** UI → hooks do TanStack Query → `api/endpoints.ts` → Axios → (MSW na camada de rede) → `mocks/handlers.ts` → `mocks/db.ts`.
Eventos: `mocks/db.ts` (mutação) → `mocks/realtime.ts` (servidor Socket.IO via MSW `ws` + `@mswjs/socket.io-binding`) → `socket.io-client` → `RealtimeClient` → `EventApplier` → cache do TanStack Query → UI.

Nenhum componente, hook ou cliente Axios contém respostas fictícias: o mock vive inteiramente na camada de rede e é ativado por configuração (`VITE_ENABLE_MOCKS`, ativo por padrão em dev, testes e no build de demonstração).

**Ordem de boot:** `main.tsx` inicia o MSW **antes** de importar a aplicação (`app.tsx`). Isso é necessário porque o `engine.io-client` captura `globalThis.WebSocket` no momento do import; se a app fosse importada antes, o socket escaparia da interceptação.

## 2. Contratos REST

Todos os tipos estão em `src/api/contracts.ts` e são usados ao mesmo tempo pelo cliente e pelos handlers do MSW. Se um contrato mudar, os dois lados deixam de compilar. Valores em ETH trafegam como **strings decimais** e os cálculos usam `decimal.js` (`src/lib/eth.ts`). Quantidades são inteiras.

Base: `/api`. Autenticação: `Authorization: Bearer <token>`. Carrinho de visitante: `X-Cart-Id`. Pedidos: `Idempotency-Key`.

| Recurso | Método e rota | Corpo / parâmetros | Resposta |
| --- | --- | --- | --- |
| Cadastro | `POST /auth/register` | `RegisterRequest` (`guestCartId?`) | `201 Session` · `422 VALIDATION_ERROR` · `409 EMAIL_TAKEN/USERNAME_TAKEN` |
| Login | `POST /auth/login` | `LoginRequest` (`guestCartId?`) | `200 Session` · `401 INVALID_CREDENTIALS` · `422` |
| Sessão | `GET /auth/session` | — | `200 Session` · `401 SESSION_EXPIRED/UNAUTHENTICATED` |
| Logout | `POST /auth/logout` | — | `204` (revoga o token) |
| Catálogo | `GET /nfts` | `q, collection*, network*, minPrice, maxPrice, sort, tab, page, pageSize` | `CatalogResponse` (itens, paginação, facetas, `applied`) |
| Detalhe | `GET /nfts/:id` | — | `NftDetail` · `404 NOT_FOUND` |
| Favoritos | `GET /favorites` · `PUT/DELETE /favorites/:nftId` | — | `FavoritesResponse` / `{ nftIds }` |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:nftId/:editionId` | `AddCartItemRequest` / `{ quantity }` | `Cart` · `409 OUT_OF_STOCK` · `404` · `422` |
| Cupom | `POST /cart/coupon` · `DELETE /cart/coupon` | `{ code }` | `Cart` · `422 COUPON_INVALID/COUPON_EXPIRED` |
| Cotação | `POST /quote` | `{ network }` | `Quote` (linhas, subtotal, desconto, taxa, total, `issues`, `fingerprint`, `expiresAt`) |
| Pedidos | `POST /orders` (header `Idempotency-Key`) | `CreateOrderRequest` | `201 Order` (novo) · `200 Order` (replay) · `409 QUOTE_STALE/OUT_OF_STOCK/IDEMPOTENCY_CONFLICT/WALLET_DISCONNECTED` · `504 GATEWAY_TIMEOUT` |
| | `GET /orders?status=` · `GET /orders/:id` | — | `{ items: Order[] }` · `Order` · `403 FORBIDDEN` · `404` |
| Perfil | `GET/PATCH /me/profile` · `PUT/DELETE /me/avatar` · `POST /me/password` | `UpdateProfileRequest` · `{ dataUrl }` · `ChangePasswordRequest` | `User` · `204` · `422` · `409` |
| Carteiras | `GET /me/wallets` · `PUT /me/wallets/:slot` (`primary`/`secondary`) | `UpsertWalletRequest` | `{ items }` · `Wallet` · `422` |
| Conexão de carteira | `POST /me/wallets/:id/connect` · `DELETE /me/wallet-connections/:id` | `{ network }` | `WalletConnection` · `409 WALLET_REJECTED` |

**Formato de erro** (todas as falhas): `{ "error": { "code": ApiErrorCode, "message": string, "fields"?: Record<string,string>, "details"?: unknown } }`.
O Axios normaliza tudo em `ApiError` (`status`, `code`, `fields`, `details`, `isTransient`, `isAuthError`), incluindo os erros sem resposta (`NETWORK_ERROR`, `TIMEOUT`).

| Situação | HTTP | `code` |
| --- | --- | --- |
| Validação | 422 | `VALIDATION_ERROR`, `COUPON_INVALID`, `COUPON_EXPIRED` (com `fields`) |
| Sessão inválida | 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` |
| Falta de permissão | 403 | `FORBIDDEN` (pedido de outro usuário) |
| Recurso inexistente | 404 | `NOT_FOUND` (inclui rotas `/api/*` desconhecidas) |
| Conflito de disponibilidade | 409 | `OUT_OF_STOCK`, `QUOTE_STALE` (com `details.quote` = cotação nova) |
| Conflito de cadastro e idempotência | 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `IDEMPOTENCY_CONFLICT` |
| Falha transitória | 503 / 504 / rede | `SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT`, `NETWORK_ERROR`, `TIMEOUT` |

### Idempotência de pedidos

- O cliente gera uma `Idempotency-Key` (UUID) por **tentativa de compra** e a guarda em `sessionStorage` junto com o hash do corpo. Retentativas por timeout ou erro de rede reaproveitam a mesma chave.
- O servidor associa a chave a `(usuário, fingerprint do corpo, pedido)`:
  - mesma chave e mesmo conteúdo → devolve o **mesmo pedido** (`200`, header `Idempotent-Replayed: true`);
  - mesma chave com conteúdo diferente, ou de outro usuário → `409 IDEMPOTENCY_CONFLICT`.
- O cenário `order-timeout` cria o pedido e devolve `504` na primeira resposta. O cliente repete com a mesma chave e recupera o pedido original sem duplicar a compra.
- Cliques repetidos: o botão fica desabilitado durante a mutation e uma `ref` impede reentrada.

### Revalidação antes da compra

Ao criar o pedido, o servidor recalcula a cotação (preço, disponibilidade, cupom e taxa) e compara o `fingerprint` com o que o usuário revisou:
- se a disponibilidade mudou → `409 OUT_OF_STOCK`;
- se preço, cupom ou taxa mudaram, ou a cotação expirou (10 min) → `409 QUOTE_STALE`.

As duas respostas trazem a cotação nova em `details.quote`. A UI mostra a diferença e exige **nova confirmação** do usuário. A cotação revisada também é comparada continuamente com a cotação viva, que é invalidada por eventos `nft.updated`, então a confirmação fica bloqueada antes mesmo de ir ao servidor.

### Ciclo do pedido

`pending` → `confirmed` | `declined`, e os dois estados finais são terminais.
- Na criação, o estoque é **reservado**.
- `confirmed`: remove do carrinho **apenas** os itens e quantidades comprados (itens adicionados depois permanecem).
- `declined`: libera o estoque e mantém o carrinho intacto.
- O recibo é um **snapshot** (`order.lines`, totais, carteira, rede). Mudanças posteriores no catálogo não alteram seus valores.
- `txHash` e o link do explorador são simulados.

## 3. Eventos Socket.IO

Transporte: `socket.io-client` 4 → `wss://realtime.kurio.mock` (`transports: ['websocket']`), interceptado pelo MSW (`ws.link`) com `@mswjs/socket.io-binding`. O handshake leva `auth: { token }`, e o servidor simulado lê o pacote `CONNECT` (`40{…}`) para associar a conexão ao usuário.

Envelope comum (`RealtimeEnvelope`):

```ts
{ id: "evt_000123", type: "nft.updated" | "order.updated", resource: { type, id }, version: number, occurredAt: ISO, data }
```

| Evento | Destinatários | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | todos | `price, compareAtPrice, editions[{id, available}], totalAvailable` | atualiza o detalhe, as páginas do catálogo e os favoritos no cache; se o NFT está no carrinho, mostra um aviso (toast + banner aria-live) e refaz a busca de carrinho e cotação na API |
| `order.updated` | só o dono do pedido, com sessão válida | `userId, status, txHash, explorerUrl, declineReason` | atualiza o pedido; nos estados terminais refaz a busca de carrinho, cotação e catálogo e anuncia confirmação ou recusa |

**Garantias do cliente** (`EventApplier`):
- **Duplicatas:** o `id` do evento é aplicado no máximo uma vez (LRU de 500 ids).
- **Eventos antigos:** um evento com `version ≤` à maior versão conhecida do recurso (no mapa interno ou no cache) é descartado, então o estado nunca regride.
- **Estados terminais:** um pedido `confirmed` ou `declined` nunca é alterado por evento.
- **Isolamento:** `order.updated` com `userId` diferente do usuário atual é ignorado. Além disso, cada sessão tem o próprio socket (veja a seção 4), e o servidor só entrega eventos privados a conexões cuja sessão ainda é válida.
- **Ciclo de vida:** a cada login, logout, troca de usuário ou expiração, o socket anterior é encerrado, com `removeAllListeners` e `disconnect`. Os handlers verificam a época da sessão antes de aplicar qualquer evento.

**Limitações do transporte simulado:** o binding não implementa namespaces, rooms nem broadcast nativos. O roteamento por usuário é feito na conexão. O binding também não envia heartbeat, então o servidor simulado envia o ping do Engine.IO a cada 20 s. Como o socket roda dentro da página, um `context.setOffline()` do Playwright não o afeta: quedas de conexão são simuladas com `__kurio.realtime.drop()` / `restore()`. O transporte `polling` não é suportado.

## 4. Sessão

- O token opaco, a expiração e o perfil público ficam em `localStorage` (`kurio.session`). **Senhas nunca são armazenadas no cliente.** No mock, elas são guardadas como SHA-256 com salt.
- **Recuperação após refresh:** a sessão é lida do storage e validada em `GET /auth/session`; se o token não vale mais, a resposta 401 a encerra.
- **Expiração:** qualquer 401 (`SESSION_EXPIRED` ou `UNAUTHENTICATED`) numa requisição feita **com** token encerra a sessão (`sessionStore.expire`). O `SessionEffects` então:
  1. remove do cache todos os dados privados (`['private', ...]`), as cotações e o carrinho do usuário anterior;
  2. limpa os avisos ao vivo (os sockets são trocados pelo `RealtimeClient`);
  3. se a rota é privada, redireciona para `/login?redirect=<rota atual>`; depois do login o usuário volta exatamente para onde estava, e o rascunho do checkout é preservado em `sessionStorage`.
- **Troca de usuário e logout:** as chaves de cache privadas são separadas por `userId` (`['private', userId, ...]`, `['cart', userId|'guest']`), então dados de usuários diferentes não colidem nem mesmo durante a transição. Toda troca de identidade também apaga esses dados.
- **Proteção de rotas:** o `beforeLoad` do TanStack Router redireciona `/checkout`, `/orders/*` e `/account/*` para o login.
- As abas ficam sincronizadas: logout em uma aba encerra a sessão nas outras (evento `storage`).

## 5. Estado do carrinho

- O carrinho é **estado do servidor**. Para visitantes, ele é identificado por `X-Cart-Id`, gerado pelo servidor e guardado em `localStorage`, então sobrevive ao refresh.
- No login ou cadastro, o cliente envia `guestCartId` e o servidor **mescla** os itens do visitante no carrinho do usuário: soma as quantidades, limita à disponibilidade e mantém o cupom se o usuário não tiver um.
- As regras de disponibilidade por NFT e edição (`min(available, maxPerOrder)`) são aplicadas no servidor (`409 OUT_OF_STOCK`) e refletidas na UI pelos limites do stepper.
- Subtotal, desconto, taxa e total **sempre** vêm de `POST /quote`. A UI nunca calcula totais.
- A alteração de quantidade é **otimista com rollback** (`useUpdateCartItem`).

## 6. Cache, retries e sincronização (TanStack Query)

| Item | Política |
| --- | --- |
| `staleTime` | 30 s por padrão; carrinho 10 s; cotação 15 s. O catálogo e o detalhe também são atualizados por Socket.IO. |
| `gcTime` | 5 min |
| Retries de query | só falhas transitórias (rede, timeout, 5xx), no máximo 2, com backoff exponencial (400 ms → 3 s). Respostas 4xx e 401 nunca são repetidas. |
| Retries de mutation | desligados; a criação de pedido tem retry próprio, idempotente. |
| Respostas obsoletas | cada combinação de parâmetros tem a própria chave e o `AbortSignal` é repassado ao Axios. Uma resposta atrasada só cai na própria entrada do cache e nunca sobrescreve os resultados atuais (cenário `out-of-order`). |
| Atualização em segundo plano | `placeholderData: keepPreviousData` no catálogo e na cotação, com um indicador "Atualizando…" (aria-live). |
| Invalidação | mutations de carrinho gravam o carrinho devolvido pela API e invalidam a cotação; eventos invalidam o carrinho, a cotação e o pedido; favoritos e quantidade usam atualização otimista com `onSettled` → invalidate. |
| Atualização otimista | favoritos (toggle) e quantidade do carrinho, ambos com rollback do snapshot e toast de erro. |

## 7. Reconciliação REST × Socket.IO

- O REST é a fonte de verdade; os eventos são **dicas** aplicadas ao cache, de forma idempotente e monotônica.
- Na **reconexão** (segundo `connect` em diante), o `RealtimeClient.reconcile()` invalida as queries **ativas** do catálogo, do carrinho, da cotação e dos pedidos do usuário, refazendo a busca no que está na tela. As inativas ficam marcadas como desatualizadas.
- Pedido pendente: a tela do pedido busca o estado via REST ao montar (o que cobre o refresh) e mantém uma busca periódica lenta (15 s) só como rede de segurança enquanto o pedido estiver `pending`. Ao reconectar, a reconciliação traz o estado final. O id do pedido pendente fica em `localStorage`, e o checkout bloqueia uma nova compra enquanto ele não chegar a um estado terminal.
- Quedas são anunciadas por um indicador acessível ("Atualizações em tempo real indisponíveis — reconectando…").

## 8. Mocks (MSW)

- `mocks/db.ts` é um único store consistente (catálogo, usuários, sessões, favoritos, carrinhos, cotações, pedidos, idempotência, carteiras, conexões), persistido em `localStorage` (`kurio.mockdb.v1`).
- Os fixtures são **determinísticos** (PRNG com seed fixa): 60 NFTs, 9 coleções e 3 redes, sendo os 9 primeiros idênticos ao Figma. Há 2 usuários, carteiras e favoritos.
- `?mock-reset=1` ou `__kurio.reset()` restaura integralmente o seed e a configuração padrão.
- Cenários e latência são configuráveis por URL, painel ou console e reproduzíveis (ver README).
- O pagamento é resolvido por um timer que é rearmado a partir do estado persistido depois de um refresh (`resumePendingOrders`).

## 9. Acessibilidade

- Link "Pular para o conteúdo", landmarks (`header`, `nav`, `main`, `footer`) e um `h1` por página.
- Foco visível global (`:focus-visible` com contorno `#E89B55`). Diálogos e drawers (Radix) prendem e devolvem o foco.
- Campos de formulário via `Field`: label associado, indicação de obrigatório com texto para leitor de tela, `aria-invalid`, `aria-describedby` para erros e foco no primeiro campo inválido.
- Feedback de mutations e de tempo real via `sonner` (aria-live) e regiões `role=status`.
- Estados não dependem só de cor: aria-pressed, aria-current, ícones, texto ("ESGOTADO", "Preço atualizado").
- Skeletons com shimmer desativado em `prefers-reduced-motion`.

## 10. Desvios em relação ao Figma e decisões de UX

- **Assets:** as quatro ilustrações (Emerald Ape, Sage/Violet Nomad, Ivory Baron e Golden Beat) foram extraídas das renderizações dos frames do Figma em 1x (cerca de 240–430 px) e servidas localmente em WebP (`public/nfts/`). Os 60 NFTs do catálogo reutilizam essas quatro artes, como no próprio Figma. Os ícones vêm de `lucide-react`; os ícones de marca (redes sociais, Google, Facebook), que a lucide não inclui mais, são SVGs inline. A fonte Roboto Mono é self-hosted via `@fontsource`.
- **Acessibilidade em relação ao layout:**
  - os pontos dos carrosséis têm área de toque de 24 px (o ponto visual continua com 8/12 px);
  - os filtros mostram um indicador tipo checkbox além da cor;
  - os inputs de login e cadastro, que no Figma só têm placeholder, ganharam label visualmente oculto;
  - no mobile, as ações do card ficam reduzidas ao coração (como no Figma) e as demais vão para o detalhe.
- Os links "Criadores", "Aprenda", editoriais, suporte, atividade, ofertas, downloads, newsletter e login social ficam visíveis para preservar o layout, mas avisam "indisponível nesta demonstração" em vez de simular sucesso.
- Login e Cadastro no desktop são modais sobre um fundo decorativo inerte (o Figma mostra o modal sobre a home). No mobile, são telas cheias, como nos frames mobile.
- O "Mercado" do menu leva ao catálogo da home (`/#catalogo`), já que não existe frame separado de mercado.
- Busca: o desktop ganhou um campo de busca visível na barra do catálogo e no ícone de lupa do header, porque o Figma só mostra o ícone.
- O checkout tem uma etapa explícita de **revisão** antes do envio, exigida pelo enunciado.

## 11. Limitações conhecidas

- O WebSocket simulado vive na página: não há servidor real nem rooms/namespaces (ver seção 3).
- O service worker do MSW é registrado na primeira visita, o que acrescenta latência ao primeiro carregamento (ver `lighthouse/ANALYSIS.md`).
- `tldts` (Public Suffix List, puxada pelo cookie store do MSW via `tough-cookie`) é substituído por um stub em `src/mocks/stubs/tldts.ts` (alias no `vite.config.ts`). A app não usa cookies; o ganho foi de cerca de 270 kB no chunk dos mocks.
- A persistência do mock é por navegador (`localStorage`): duas abas compartilham o estado, dois navegadores não.
