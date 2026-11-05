import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { EditionId, NftSummary } from '@/api/contracts'
import { Price } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/auth/use-session'
import { useAddToCart } from '@/queries/cart'
import { useIsFavorite, useToggleFavorite } from '@/queries/favorites'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const RARITY_LABEL = { raro: 'RARO', lendario: 'LENDÁRIO' } as const

const QUICK_EDITION: EditionId = '1-50'

export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const user = useUser()
  const fav = useIsFavorite(nft.id)
  const toggle = useToggleFavorite()
  const add = useAddToCart()
  const soldOut = nft.totalAvailable === 0
  const headingId = `nft-${nft.id}-title`

  return (
    <article aria-labelledby={headingId} className={cn('group relative flex flex-col gap-3', className)}>
      <div className="relative aspect-[258/300] overflow-hidden rounded-[20px] bg-surface p-[6%]">
        <img
          src={nft.image}
          alt={nft.imageAlt}
          width={432}
          height={432}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="size-full rounded-[18px] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {nft.rarity !== 'comum' && (
          <span className="absolute top-[7%] left-0 bg-brand px-3 py-1 text-sm font-medium text-ink">{RARITY_LABEL[nft.rarity]}</span>
        )}
        {soldOut && (
          <span className="absolute top-[7%] right-0 bg-ink/90 px-3 py-1 text-sm font-medium text-cream">ESGOTADO</span>
        )}
        <div className="absolute top-[8%] right-[8%] flex gap-1.5 transition-opacity md:inset-x-0 md:top-auto md:right-auto md:bottom-[3%] md:justify-center md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            className="hidden size-9 place-items-center rounded-sm bg-surface text-cream hover:text-brand-accent disabled:opacity-50 md:grid"
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            disabled={soldOut || add.isPending}
            onClick={() => add.mutate({ nftId: nft.id, editionId: QUICK_EDITION, quantity: 1, name: nft.name })}
          >
            <ShoppingCart className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className={cn('grid size-9 place-items-center rounded-full bg-ink/75 hover:text-brand-accent md:rounded-sm md:bg-surface', fav ? 'text-brand' : 'text-cream')}
            aria-label={fav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            aria-pressed={fav}
            onClick={() => {
              if (!user) {
                toast.info('Entre na sua conta para favoritar NFTs.')
                return
              }
              toggle.mutate({ nftId: nft.id, on: !fav, name: nft.name })
            }}
          >
            <Heart className={cn('size-5', fav && 'fill-current')} aria-hidden />
          </button>
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="hidden size-9 place-items-center rounded-sm bg-surface text-cream hover:text-brand-accent md:grid"
            aria-label={`Ver detalhes de ${nft.name}`}
            tabIndex={-1}
          >
            <Search className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-0 md:gap-1">
        <h3 id={headingId} className="text-base text-cream">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-brand-accent">
            {nft.name}
          </Link>
        </h3>
        <Price value={nft.price} compareAt={nft.compareAtPrice} className="text-base" />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="aspect-[258/300] rounded-[20px] bg-surface p-[6%]">
        <Skeleton className="size-full rounded-[18px]" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
