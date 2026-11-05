# Lighthouse: análise

Os números estão em [`summary.md`](./summary.md) (mediana de 3 execuções por página e perfil) e os relatórios completos em [`reports/`](./reports). A configuração versionada é [`lighthouse.config.mjs`](./lighthouse.config.mjs) e o script é [`../scripts/lighthouse.mjs`](../scripts/lighthouse.mjs).

## Resultado final

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 93 | 100 | 100 | 100 | 2,84 s | 0,001 | 186 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,84 s | 0,020 | 0 ms |
| Detalhe | mobile | 92 | 100 | 100 | 100 | 2,79 s | 0,000 | 201 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,82 s | 0,000 | 0 ms |

Execuções individuais de Performance: início mobile 93/93/93, detalhe mobile 93/92/91; no desktop, 99–100 em todas. Todas as metas foram atingidas.

## Condições

- Build de produção (`pnpm build`) servido por `vite preview`, com a camada MSW e o Socket.IO simulado ativos no cenário padrão. É o mesmo artefato publicado.
- Cada execução abre um Chrome novo: cache, storage e service worker frios, ou seja, o pior caso.
- Mobile usa o throttling padrão do Lighthouse (4G lento simulado e CPU 4x mais lenta). Desktop usa o preset `desktop`.
- Imagens, fontes (Roboto Mono self-hosted) e todas as funcionalidades são carregadas. Não há atalho específico para a auditoria.

## O que mudou durante a auditoria

| Medição | Problema | Causa | Correção |
| --- | --- | --- | --- |
| Detalhe: Performance 76 (mobile) e 86 (desktop), CLS 0,27 | Layout shift | O `main` ficava vazio enquanto a rota lazy carregava e o footer aparecia no topo, depois era empurrado. A galeria não tinha largura fixa, então a coluna de informações se deslocava quando a imagem carregava. | `main` com `min-height: 100dvh`; galeria com largura fixa (`567px`) no desktop. O CLS foi para 0,000. |
| Início: Accessibility 97 | `target-size` | Os pontos do carrossel do hero tinham área de toque de 8×8 px. | Área de toque de 24×24 px, mantendo o ponto visual de 8 px do Figma; o mesmo nos pontos do carrossel de relacionados. Accessibility 100. |
| Mobile: Performance 87–90 (no limite), TBT ~170–290 ms | Tempo de script | O chunk do MSW tinha 477 kB, puxando a Public Suffix List inteira (`tldts`, via `tough-cookie`, usada só pelo cookie store do MSW). | Alias de `tldts` para um stub mínimo (`src/mocks/stubs/tldts.ts`). A app não usa cookies (autenticação por bearer token). O chunk caiu para 210 kB (63 kB gzip), o LCP mobile foi de ~3,4 s para ~2,8 s e a Performance para 92–93. |
| — | Flash branco e LCP tardio | O `#root` ficava vazio até o MSW iniciar. | Fundo escuro inline, placeholder de boot e `preload` com `fetchpriority=high` da imagem do hero. |

**Tentativa descartada:** baixar e executar o bundle da app em paralelo com o boot do MSW piorou o mobile (Performance 77–79, TBT ~340 ms), porque duas tarefas grandes de parse e execução disputavam a thread principal com a CPU limitada. O boot sequencial (mocks → app) foi mantido.

## Pontos de atenção

- **O LCP mobile (~2,8 s) ainda carrega o custo da camada de mocks:** registrar e ativar o service worker do MSW e executar o chunk `browser` (cerca de 550 ms de script com a CPU 4x mais lenta, antes do stub). Isso é necessário para que nenhuma requisição escape da simulação e para que o `engine.io-client` capture o WebSocket já interceptado. Com um backend real (`VITE_ENABLE_MOCKS=false`), essa etapa deixa de existir.
- **TBT mobile entre 170 e 230 ms:** parse e execução do React, do TanStack e do MSW. O código das rotas já é separado (lazy routes): a página inicial não carrega checkout, conta nem formulários.
