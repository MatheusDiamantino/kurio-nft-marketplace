# Arquitetura

Aqui estão as decisões técnicas do Kurio: como o código está organizado, os contratos da API, os eventos de tempo real, a sessão, o carrinho, o cache e o que ficou diferente do Figma. Para rodar o projeto, veja o [README](./README.md).

## Organização

```
src/
  api/         tipos compartilhados, cliente Axios e endpoints
  auth/        sessão e login/logout
  queries/     hooks do TanStack Query
  realtime/    cliente Socket.IO e aplicação dos eventos no cache
  routes/      search params e rotas privadas
  router.tsx   rotas do TanStack Router
  components/  layout, componentes shadcn adaptados e compartilhados
  pages/       telas
  mocks/       servidor simulado (dados, handlers REST, Socket.IO, cenários e controle pelo console)
tests/         Playwright
scripts/       auditoria Lighthouse
```

O caminho de uma requisição é: componente, hook do TanStack Query, `api/endpoints.ts`, Axios, MSW, `mocks/handlers.ts` e `mocks/db.ts`. Os eventos fazem o caminho inverso: uma mudança no `db` vira um evento no servidor Socket.IO simulado, que chega ao `socket.io-client` e é aplicado no cache do TanStack Query.

Nenhum componente conhece os dados fictícios. O mock fica todo na camada de rede e é ligado pela variável `VITE_ENABLE_MOCKS`. Trocar por uma API real é só desligar essa variável.

Um detalhe importante: o `main.tsx` inicia o MSW antes de importar a aplicação. O `engine.io-client` guarda a referência do `WebSocket` no momento do import, então, se a app carregasse primeiro, o socket escaparia do mock.

## API REST

Os tipos ficam em `src/api/contracts.ts` e são usados tanto pelo cliente quanto pelos handlers do MSW. Se um contrato mudar, os dois lados param de compilar.

Valores em ETH trafegam como string decimal e as contas usam `decimal.js`, para evitar erro de ponto flutuante.

A base é `/api`. O usuário logado manda `Authorization: Bearer <token>`, o visitante manda o carrinho em `X-Cart-Id` e a criação de pedido manda `Idempotency-Key`.

| Recurso | Rota | Respostas principais |
| --- | --- | --- |
| Cadastro | `POST /auth/register` | `201` · `422` · `409 EMAIL_TAKEN/USERNAME_TAKEN` |
| Login | `POST /auth/login` | `200` · `401 INVALID_CREDENTIALS` · `422` |
| Sessão | `GET /auth/session` · `POST /auth/logout` | `200` · `401 SESSION_EXPIRED` · `204` |
| Catálogo | `GET /nfts?q&collection&network&minPrice&maxPrice&sort&tab&page&pageSize` | itens, paginação e contadores dos filtros |
| Detalhe | `GET /nfts/:id` | `200` · `404` |
| Favoritos | `GET /favorites` · `PUT/DELETE /favorites/:nftId` | lista de ids |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:nftId/:editionId` | carrinho · `409 OUT_OF_STOCK` |
| Cupom | `POST/DELETE /cart/coupon` | carrinho · `422 COUPON_INVALID/COUPON_EXPIRED` |
| Cotação | `POST /quote` | linhas, subtotal, desconto, taxa, total e um `fingerprint` |
| Pedidos | `POST /orders` | `201` novo · `200` repetido · `409 QUOTE_STALE/OUT_OF_STOCK/IDEMPOTENCY_CONFLICT` · `504` |
| | `GET /orders` · `GET /orders/:id` | `200` · `403` · `404` |
| Perfil | `GET/PATCH /me/profile` · `PUT/DELETE /me/avatar` · `POST /me/password` | `200` · `422` |
| Carteiras | `GET /me/wallets` · `PUT /me/wallets/:slot` · `POST /me/wallets/:id/connect` | `200` · `422` · `409 WALLET_REJECTED` |

Todo erro tem o mesmo formato:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "...", "fields": {}, "details": {} } }
```

O Axios converte qualquer falha num `ApiError`, inclusive as que não têm resposta, como queda de rede e timeout. Assim a interface sabe se o erro é de validação, de sessão ou passageiro, e decide se mostra a mensagem no campo, manda para o login ou tenta de novo.

### Pedidos sem duplicar

Cada tentativa de compra gera uma `Idempotency-Key`, que fica salva no `sessionStorage` junto com um hash do pedido. Se a requisição falhar por timeout ou rede, o reenvio usa a mesma chave.

O servidor lembra a chave:

- mesma chave e mesmo conteúdo devolvem o pedido que já existe;
- mesma chave com conteúdo diferente devolve `409 IDEMPOTENCY_CONFLICT`.

O cenário `order-timeout` mostra isso: o pedido é criado, a primeira resposta é `504` e o reenvio recupera o mesmo pedido. Além disso, o botão de confirmar fica desabilitado enquanto a requisição está em andamento.

### Preço que muda na hora de pagar

Antes de criar o pedido, o servidor recalcula a cotação e compara com a que o usuário revisou. Se a edição esgotou, responde `OUT_OF_STOCK`. Se o preço, o cupom ou a taxa mudaram, ou se a cotação passou de 10 minutos, responde `QUOTE_STALE`.

As duas respostas já trazem a cotação nova. A tela mostra o que mudou e pede uma nova confirmação. Na maioria dos casos isso nem chega ao servidor: o evento `nft.updated` atualiza a cotação na tela e o botão de confirmar já fica bloqueado.

### Ciclo do pedido

O pedido nasce `pending` e termina `confirmed` ou `declined`, sem voltar atrás.

- Ao criar o pedido, o estoque fica reservado.
- Se confirmado, saem do carrinho só os itens comprados. O que foi adicionado depois continua lá.
- Se recusado, o estoque é liberado e o carrinho não muda.
- O recibo guarda uma cópia dos valores, então mudar o preço depois não altera o recibo.

## Tempo real

O `socket.io-client` conecta em `wss://realtime.kurio.mock` e o MSW intercepta a conexão com `@mswjs/socket.io-binding`. O token vai no handshake, e é assim que o servidor sabe quem é o usuário.

Todo evento tem o mesmo envelope:

```ts
{ id: 'evt_000123', type: 'nft.updated' | 'order.updated', resource: { type, id }, version: number, occurredAt: string, data }
```

| Evento | Quem recebe | O que acontece na tela |
| --- | --- | --- |
| `nft.updated` | todos | preço e disponibilidade mudam no catálogo, no detalhe e nos favoritos; se o NFT estiver no carrinho, aparece um aviso e o carrinho é recarregado |
| `order.updated` | só o dono do pedido | o status do pedido muda; ao confirmar ou recusar, carrinho e catálogo são recarregados |

Cuidados na hora de aplicar um evento:

- O mesmo evento nunca é aplicado duas vezes. Os últimos 500 ids ficam guardados.
- Evento com versão igual ou menor do que a conhecida é ignorado, então a tela nunca volta para um estado antigo.
- Pedido confirmado ou recusado não muda mais.
- Evento de pedido de outro usuário é descartado.
- A cada login, logout ou expiração, o socket antigo é fechado e um novo é aberto para a nova sessão.

O binding do MSW tem limitações. Não existem rooms nem namespaces, então a separação por usuário é feita na conexão. Ele também não manda heartbeat, e o servidor simulado faz isso a cada 20 s. Como o socket roda dentro da página, o modo offline do Playwright não o afeta. Por isso as quedas são simuladas com `__kurio.realtime.drop()` e `restore()`.

## Sessão

O token, a data de expiração e o perfil público ficam no `localStorage`. A senha nunca é guardada no cliente. No mock, ela é salva como hash com salt.

Ao recarregar a página, a sessão salva é validada em `GET /auth/session`. Qualquer `401` numa requisição autenticada encerra a sessão. Quando isso acontece:

1. os dados privados do usuário saem do cache;
2. o socket é trocado;
3. se a pessoa estava numa rota privada, ela vai para o login e, depois de entrar, volta para onde estava. O rascunho do checkout é mantido.

As chaves de cache privadas incluem o id do usuário (`['private', userId, ...]`). Assim, trocar de conta nunca mistura os dados de uma pessoa com os de outra, nem por um instante.

`/account/*` e `/orders/*` exigem login. O `/checkout` fica aberto para visitantes, como no frame de Pagamento do Figma. O visitante preenche os dados e escolhe o tipo de carteira, e ao clicar em "Confirmar compra" vai para o login. Depois de entrar, o rascunho dele é aproveitado. Criar o pedido continua exigindo sessão.

Logout em uma aba também desloga as outras.

## Carrinho

O carrinho mora no servidor. O visitante recebe um id de carrinho que fica no `localStorage`, então os itens sobrevivem ao refresh.

No login ou cadastro, os itens do visitante são juntados ao carrinho da conta: as quantidades somam, respeitando o estoque, e o cupom é mantido se a conta não tiver outro.

O limite de cada edição é validado no servidor e aparece no seletor de quantidade. Os totais vêm sempre da cotação (`POST /quote`), e a interface nunca faz essa conta sozinha. Mudar a quantidade atualiza a tela na hora e desfaz se a API recusar.

## Cache e navegação

| Item | Como está |
| --- | --- |
| Dados considerados frescos | 30 s, ou 10 s para o carrinho e 15 s para a cotação |
| Descarte da memória | 5 min sem uso |
| Novas tentativas | só em erro passageiro (rede, timeout, 5xx), no máximo 2, com espera crescente |
| Mutations | sem retry automático; a criação de pedido tem o próprio retry, com a mesma chave |
| Respostas fora de ordem | cada filtro tem sua chave de cache e a requisição antiga é cancelada, então ela nunca sobrescreve a nova |
| Troca de filtro | os resultados anteriores ficam na tela, levemente apagados, até chegarem os novos |
| Favoritos e quantidade | atualizam na hora e voltam ao estado anterior se der erro |

Na navegação com o TanStack Router:

- Cada rota tem um loader que busca os dados com os mesmos `queryOptions` dos hooks. Passar o mouse ou tocar num link já começa a buscar a página.
- O código das rotas é carregado sob demanda e pré-carregado na primeira interação do usuário.
- A barra de progresso só aparece em navegações acima de 250 ms e o spinner acima de 600 ms.
- Entre páginas há um fade curto, que não roda ao trocar filtros e é desligado para quem prefere menos movimento.

Medindo no build de produção, ir da home para o detalhe de um NFT caiu de 735 ms para cerca de 330 ms no clique direto, e para cerca de 80 ms quando o mouse passa antes pelo link.

## REST e tempo real juntos

O REST é a fonte da verdade e os eventos só adiantam mudanças no cache. Quando o socket reconecta, as telas abertas recarregam catálogo, carrinho, cotação e pedidos, para cobrir o que se perdeu durante a queda.

Para pedido pendente, a tela do pedido busca o status ao abrir, o que cobre o refresh, e confere de novo a cada 15 s como garantia. Enquanto houver um pedido pendente, o checkout não deixa iniciar outra compra. Quando o tempo real cai, aparece um aviso de "reconectando".

## Mocks

Todo o estado simulado fica em `mocks/db.ts` e é salvo no `localStorage`. Os dados são gerados com semente fixa, então são sempre os mesmos: 60 NFTs, 9 coleções e 3 redes, sendo os 9 primeiros iguais aos do Figma. Existem 2 usuários de teste.

O pagamento é resolvido por um timer, que é reativado se a página for recarregada no meio do processo.

### Cenários

| Cenário | O que acontece |
| --- | --- |
| `default` | tudo funciona |
| `catalog-empty` | catálogo vazio |
| `catalog-error` | o catálogo responde 500 |
| `flaky` | a primeira tentativa de cada GET falha com 503 e o retry recupera |
| `out-of-order` | as respostas do catálogo alternam entre lentas e rápidas |
| `offline` | toda requisição falha na rede |
| `favorite-fail` | favoritar responde 500 e a tela desfaz |
| `session-expired` | toda requisição autenticada responde 401 |
| `price-change-checkout` | ao confirmar, o preço do primeiro item sobe 0.10 ETH |
| `sold-out-checkout` | ao confirmar, a edição do primeiro item esgota |
| `order-timeout` | o pedido é criado, mas a resposta é 504; o reenvio recupera o mesmo pedido |
| `payment-declined` | o pagamento é recusado |
| `payment-hold` | o pagamento fica pendente até ser resolvido pelo console |
| `wallet-reject` | a carteira recusa a conexão |
| `validation-error` | perfil e carteiras respondem 422 com erros nos campos |

Latências: `none` (0 ms), `fast` (150 a 300 ms, padrão), `slow` (2,5 s) e `variable` (100 a 1800 ms).

### Reproduzindo os fluxos de falha

1. **Preço muda com o item no carrinho.** Entre como Ana, adicione o Emerald Ape #042 e, com o carrinho aberto, rode `__kurio.updateNft('emerald-ape-042', { price: '1.29' })`. O aviso aparece e o total se atualiza. No checkout, a confirmação fica bloqueada até você aceitar o novo valor.
2. **Edição esgota.** Rode `__kurio.updateNft('emerald-ape-042', { editions: { '1-50': 0 } })` ou use o cenário `sold-out-checkout`.
3. **Timeout na compra.** Com `?scenario=order-timeout`, finalize a compra. A tela mostra que está recuperando o pedido e termina no mesmo pedido. `__kurio.pendingOrders()` mostra só um.
4. **Pagamento recusado.** Com `?scenario=payment-declined`, o pedido é recusado e o carrinho continua igual.
5. **Tempo real cai com pedido pendente.** Use `?scenario=payment-hold`, confirme a compra e rode `__kurio.realtime.drop()`. Recarregue a página, rode `__kurio.realtime.restore()` e depois `__kurio.resolveOrder('<id>', 'confirmed')`. O recibo aparece sem pedido duplicado.
6. **Sessão expira no checkout.** Com o checkout aberto, rode `__kurio.expireSessions()` e faça qualquer ação. Você vai para o login e, ao entrar, volta ao checkout com tudo preenchido.
7. **Evento repetido ou antigo.** Rode `__kurio.realtime.replayLast()` ou `__kurio.realtime.sendStale('emerald-ape-042')`. Nada muda na tela.
8. **Erro e nova tentativa.** Com `?scenario=catalog-error&latency=slow`, você vê o carregamento e depois o erro. Rode `__kurio.setConfig({ scenario: 'default' })` no console e clique em **Tentar novamente**.

## Acessibilidade

- Link para pular ao conteúdo, landmarks e um `h1` por página.
- Foco visível em tudo. Modais e gavetas prendem e devolvem o foco.
- Todo campo tem label, os erros são lidos pelo leitor de tela e o foco vai para o primeiro campo inválido.
- Avisos de ações e do tempo real são anunciados.
- Nenhum estado depende só de cor: há ícones e textos como "ESGOTADO" e "Preço atualizado".
- Animações respeitam a preferência por menos movimento.

O axe roda nos testes em 10 telas, nos dois tamanhos. A única exceção conhecida são os pontos do carrossel do topo da home, que ficaram menores que 24 px para seguir o Figma.

## Diferenças em relação ao Figma

- As ilustrações dos NFTs foram extraídas das imagens do próprio Figma em resolução 1x e convertidas para WebP. Os 60 NFTs reutilizam essas 4 artes, como o Figma faz.
- Os ícones vêm do `lucide-react`. Os de marca (Google, Facebook e redes sociais) são SVGs próprios, porque a lucide não tem mais esses ícones. A fonte Roboto Mono é servida pelo próprio projeto.
- Os inputs de login, que no Figma só têm placeholder, ganharam label invisível para leitores de tela.
- No mobile, o card de NFT mostra só o coração, como no Figma. As outras ações ficam no detalhe.
- Links sem tela no Figma (Criadores, Aprenda, artigos, suporte, login social etc.) continuam no layout, mas avisam que não estão disponíveis na demonstração.
- No desktop, login e cadastro abrem como modal sobre a home. No mobile, são telas inteiras.
- "Mercado" leva ao catálogo da home, porque não existe uma tela separada para ele.
- O Figma não mostra os destaques e o blog no mobile, então eles viraram carrosséis com arrasto. Nos destaques, a imagem fica em cima e o texto embaixo.
- O checkout ganhou uma etapa de revisão antes de enviar, pedida no enunciado.
- Ao abrir o site aparece uma tela de entrada com a marca, que não existe no Figma. Ela fica no `index.html`, aparece antes do JavaScript carregar e cobre o tempo de registrar o service worker do MSW. Fica no mínimo 1,1 s só na primeira visita da aba e some assim que a app está pronta nas seguintes.

## Limitações

- O WebSocket é simulado dentro da página, sem servidor real.
- O service worker do MSW é registrado na primeira visita, o que deixa o primeiro carregamento um pouco mais lento. Mais detalhes em [lighthouse/ANALYSIS.md](./lighthouse/ANALYSIS.md).
- A biblioteca `tldts`, que o MSW puxa indiretamente, foi trocada por uma versão vazia em `src/mocks/stubs/tldts.ts`. A app não usa cookies, e isso tirou cerca de 270 kB do bundle.
- Os dados simulados ficam no navegador: duas abas compartilham o estado, dois navegadores não.
