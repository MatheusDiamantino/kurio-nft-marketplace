import { useEffect } from 'react'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, ShoppingCart, Star } from 'lucide-react'
import type { NftDetail } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { DetailSkeleton, DetailTabs, MetaLines, ShareLinks, Stars } from '@/components/nft/detail-parts'
import { EditionPicker } from '@/components/nft/edition-picker'
import { NftGallery } from '@/components/nft/gallery'
import { usePurchase, type Purchase } from '@/components/nft/use-purchase'
import { RelatedCarousel } from '@/components/related-carousel'
import { Breadcrumb, ErrorState, Price, QuantityStepper } from '@/components/shared'
import { useNft } from '@/queries/catalog'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const route = getRouteApi('/nft/$nftId')

function StockHint({ p, nft }: { p: Purchase; nft: NftDetail }) {
  if (p.blockedReason) return <span className="text-danger">{p.blockedReason}</span>
  return (
    <span>
      {p.edition?.supply === null ? 'Edição aberta' : `Restam ${p.available}`} · Máx. {Math.min(nft.maxPerOrder, p.max)} por pedido
    </span>
  )
}

function FavoriteButton({ p, className, compact }: { p: Purchase; className?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={p.toggleFavorite}
      aria-pressed={p.isFavorite}
      aria-label={compact ? (p.isFavorite ? 'Remover dos favoritos' : 'Favoritar') : undefined}
      className={className}
    >
      <Heart className={cn('size-5', p.isFavorite && 'fill-current')} aria-hidden />
      {!compact && (p.isFavorite ? 'Favoritado' : 'Favoritar')}
    </button>
  )
}

function DesktopDetail({ nft, p }: { nft: NftDetail; p: Purchase }) {
  return (
    <div className="container-page mt-6 hidden md:block">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} />
      <div className="mt-4 flex flex-col gap-8 lg:flex-row lg:gap-8">
        <NftGallery nft={nft} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-2xl leading-9 font-bold tracking-[0.03em] text-cream">{nft.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <Price value={nft.price} compareAt={nft.compareAtPrice} className="text-xl" />
            <p className="flex items-center gap-2 text-sm text-cream">
              <Stars rating={nft.rating} className="text-cream" />
              {nft.reviewsCount} avaliações de colecionadores
            </p>
          </div>
          <h2 className="mt-5 text-sm font-bold text-cream">Sobre este NFT:</h2>
          <p className="mt-3 text-[13px] leading-[22px] text-sand">{nft.description}</p>
          <div className="mt-3">
            <EditionPicker editions={nft.editions} value={p.editionId} onChange={p.setEditionId} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <QuantityStepper value={p.quantity} max={Math.max(1, p.max)} onChange={p.setQuantity} disabled={!!p.blockedReason} label="Quantidade" />
              <p className="text-xs text-tan">
                <StockHint p={p} nft={nft} />
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => p.addToCart(true)}
                disabled={!!p.blockedReason || p.adding}
                className="h-9 w-[115px] rounded-sm bg-brand text-sm font-bold tracking-[0.04em] text-ink hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.adding ? 'ADICIONANDO…' : p.blockedReason === 'Esgotado' ? 'ESGOTADO' : 'COMPRAR'}
              </button>
              <FavoriteButton
                p={p}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-sm border border-brand px-3 text-sm hover:bg-surface-dark',
                  p.isFavorite ? 'text-brand' : 'text-brand-accent',
                )}
              />
            </div>
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-brand-accent">
            {p.notice}
          </p>
          <MetaLines nft={nft} className="mt-1 flex flex-col gap-1 text-sm leading-7 text-tan" />
          <div className="mt-2">
            <ShareLinks nft={nft} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileDetail({ nft, p }: { nft: NftDetail; p: Purchase }) {
  const router = useRouter()
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1
  return (
    <div className="md:hidden">
      <div className="relative px-7 pt-[66px] pb-[110px]">
        <div className="absolute inset-x-7 top-6 z-10 flex items-center justify-between">
          {canGoBack ? (
            <button
              type="button"
              onClick={() => router.history.back()}
              className="grid size-9 place-items-center rounded-full border border-line-soft bg-surface/80 text-cream"
              aria-label="Voltar"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          ) : (
            <Link to="/" className="grid size-9 place-items-center rounded-full border border-line-soft bg-surface/80 text-cream" aria-label="Voltar ao início">
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
          )}
          <FavoriteButton
            p={p}
            compact
            className={cn('grid size-9 place-items-center rounded-full border border-line-soft bg-surface/80', p.isFavorite ? 'text-brand' : 'text-brand-accent')}
          />
        </div>
        <img
          src={nft.image}
          alt={nft.imageAlt}
          width={358}
          height={358}
          fetchPriority="high"
          className="aspect-square w-full rounded-[24px] object-cover"
        />
      </div>

      <div className="relative -mt-[114px] rounded-t-[28px] bg-surface px-6 pt-8 pb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl leading-7 font-bold tracking-[0.03em] text-cream">{nft.name}</h1>
          <p className="flex shrink-0 items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-sm text-cream">
            <Star className="size-3.5 fill-brand text-brand" aria-hidden />
            <span className="font-bold">{nft.rating.toFixed(1)}</span>
            <span className="text-sand">({nft.reviewsCount})</span>
            <span className="sr-only">de 5, {nft.reviewsCount} avaliações</span>
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-sand">{nft.description}</p>
        <div className="mt-3">
          <EditionPicker editions={nft.editions} value={p.editionId} onChange={p.setEditionId} size="lg" />
        </div>
        <MetaLines nft={nft} className="mt-4 flex flex-col gap-1 text-sm leading-8 text-tan" />
      </div>

      <div className="sticky bottom-[72px] z-30 rounded-t-[24px] border-t border-line bg-ink/95 px-6 pt-4 pb-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-sand">Qtd.</span>
            <QuantityStepper value={p.quantity} max={Math.max(1, p.max)} onChange={p.setQuantity} disabled={!!p.blockedReason} label="Quantidade" size="sm" />
          </div>
          <p className="text-xl font-bold text-brand">
            <span className="sr-only">Preço: </span>
            {formatEth(nft.price)}
          </p>
        </div>
        <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs text-brand-accent">
          {p.notice || (p.blockedReason ?? '')}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => p.addToCart(true)}
            disabled={!!p.blockedReason || p.adding}
            className="h-[56px] flex-1 rounded-full bg-gradient-to-r from-brand-soft to-brand text-base font-bold text-ink hover:to-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p.adding ? 'Adicionando…' : p.blockedReason === 'Esgotado' ? 'Esgotado' : 'Comprar NFT'}
          </button>
          <button
            type="button"
            onClick={() => p.addToCart(false)}
            disabled={!!p.blockedReason || p.adding}
            className="grid size-[56px] shrink-0 place-items-center rounded-full border border-line-soft bg-surface text-brand hover:text-brand-accent disabled:opacity-50"
            aria-label={`Adicionar ${nft.name} ao carrinho`}
          >
            <ShoppingCart className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

function NftDetailView({ nft }: { nft: NftDetail }) {
  const p = usePurchase(nft)
  useEffect(() => {
    document.title = `${nft.name} — Kurio`
  }, [nft.name])
  return (
    <>
      <DesktopDetail nft={nft} p={p} />
      <MobileDetail nft={nft} p={p} />
      <DetailTabs nft={nft} />
      <RelatedCarousel title="Mais desta coleção" collection={nft.collection} excludeIds={[nft.id]} />
    </>
  )
}

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const { data: nft, isPending, isError, error, refetch, isFetching } = useNft(nftId)

  if (isPending) {
    return (
      <div aria-busy="true">
        <p className="sr-only" role="status">
          Carregando NFT…
        </p>
        <DetailSkeleton />
      </div>
    )
  }

  if (isError) {
    if (isApiError(error) && error.status === 404) {
      return (
        <section className="container-page flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="nft-404">
          <h1 id="nft-404" className="text-2xl font-bold text-cream">
            NFT não encontrado
          </h1>
          <p className="max-w-md text-sand">Este NFT não existe ou foi removido do mercado.</p>
          <Link to="/" hash="catalogo" className="rounded-sm bg-brand px-6 py-3 font-bold text-ink hover:bg-brand-accent">
            Voltar ao mercado
          </Link>
        </section>
      )
    }
    return (
      <div className="container-page py-16">
        <h1 className="sr-only">Detalhes do NFT</h1>
        <ErrorState
          title="Não foi possível carregar este NFT"
          message={error.message}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </div>
    )
  }

  return <NftDetailView key={nft.id} nft={nft} />
}
