import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { CartLines, CartLinesSkeleton, CartLiveNotices, lineProblem } from '@/components/cart/cart-lines'
import { CouponForm } from '@/components/cart/coupon-form'
import { QuoteSummary } from '@/components/cart/quote-summary'
import { RelatedCarousel } from '@/components/related-carousel'
import { Breadcrumb, EmptyState, ErrorState } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart, useQuote } from '@/queries/cart'

export function CartPage() {
  const cart = useCart()
  const lines = cart.data?.lines ?? []
  const hasLines = lines.length > 0
  const quote = useQuote('ethereum', { enabled: hasLines })
  const blocked = lines.some((l) => lineProblem(l) !== null)
  const quoteIssues = quote.data?.issues ?? []

  return (
    <>
      <div className="container-page pt-4 md:pt-8">
        {/* Mobile header per Figma: back button + centered title */}
        <div className="relative mb-4 flex h-11 items-center justify-center md:hidden">
          <Link
            to="/"
            className="absolute left-0 grid size-[35px] place-items-center rounded-full border border-line-soft text-cream"
            aria-label="Voltar ao início"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <span className="text-base font-bold text-cream" aria-hidden>
            Carrinho de NFTs
          </span>
        </div>
        <div className="hidden md:block">
          <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]} />
        </div>
        <h1 className="sr-only">Carrinho de NFTs</h1>

        <div className="mt-4 grid gap-8 lg:mt-2 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12 xl:grid-cols-[782px_1fr] xl:gap-[86px]">
          <section aria-label="Itens do carrinho" className="flex min-w-0 flex-col gap-4">
            <CartLiveNotices nftIds={lines.map((l) => l.nftId)} />
            {cart.isPending ? (
              <CartLinesSkeleton />
            ) : cart.isError ? (
              <ErrorState
                message="Não foi possível carregar seu carrinho."
                onRetry={() => void cart.refetch()}
                retrying={cart.isRefetching}
              />
            ) : !hasLines ? (
              <EmptyState
                title="Seu carrinho está vazio"
                message="Explore o catálogo e adicione NFTs para continuar."
                action={
                  <Link to="/" hash="catalogo" className="rounded-sm bg-brand px-6 py-3 font-bold text-ink hover:bg-brand-accent">
                    Explorar NFTs
                  </Link>
                }
              />
            ) : (
              <CartLines lines={lines} />
            )}
          </section>

          {(cart.isPending || hasLines) && (
            <aside
              aria-labelledby="cart-summary-title"
              className="-mx-4 flex flex-col gap-6 rounded-t-[28px] bg-surface px-6 py-6 md:mx-0 md:rounded-none md:bg-transparent md:px-0 md:py-0"
            >
              <h2 id="cart-summary-title" className="border-b border-line pb-3 text-lg font-bold text-cream">
                Resumo da carteira
              </h2>
              {cart.isPending ? <Skeleton className="h-16 w-full" /> : <CouponForm coupon={cart.data?.coupon ?? null} />}
              {quote.isError ? (
                <ErrorState
                  title="Não foi possível calcular os valores"
                  message={quote.error.message}
                  onRetry={() => void quote.refetch()}
                  retrying={quote.isRefetching}
                />
              ) : (
                <QuoteSummary
                  quote={quote.data}
                  loading={cart.isPending || quote.isPending}
                  refreshing={quote.isFetching && !!quote.data}
                />
              )}
              {(blocked || quoteIssues.length > 0) && (
                <div id="checkout-blocked" role="alert" className="rounded-sm border border-danger px-3 py-2 text-sm text-danger">
                  Alguns itens não têm disponibilidade suficiente. Ajuste as quantidades para finalizar.
                  {quoteIssues.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs">
                      {quoteIssues.map((i) => (
                        <li key={`${i.type}:${i.nftId}:${i.editionId}`}>{i.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center gap-4">
                {blocked || !hasLines ? (
                  <button
                    type="button"
                    disabled
                    aria-describedby={blocked ? 'checkout-blocked' : undefined}
                    className="h-[60px] w-full rounded-[14px] bg-brand text-base font-bold text-ink opacity-50 md:h-10 md:rounded-sm md:text-[15px]"
                  >
                    Conectar e finalizar
                  </button>
                ) : (
                  <Link
                    to="/checkout"
                    className="grid h-[60px] w-full place-items-center rounded-[14px] bg-brand text-base font-bold text-ink hover:bg-brand-accent md:h-10 md:rounded-sm md:text-[15px]"
                  >
                    Conectar e finalizar
                  </Link>
                )}
                <Link to="/" hash="catalogo" className="text-[15px] text-brand hover:text-brand-accent hover:underline">
                  Continuar explorando
                </Link>
              </div>
            </aside>
          )}
        </div>
      </div>
      <RelatedCarousel title="Colecionadores também viram" excludeIds={lines.map((l) => l.nftId)} />
    </>
  )
}
