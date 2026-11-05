import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { EmptyState, ErrorState } from '@/components/shared'
import { useFavorites } from '@/queries/favorites'

export function FavoritesPage() {
  const favorites = useFavorites()
  const items = favorites.data?.items ?? []

  useEffect(() => {
    document.title = 'Lista de interesse — Kurio'
  }, [])

  return (
    <section aria-labelledby="fav-title" className="flex flex-col gap-6">
      <h1 id="fav-title" className="text-lg font-bold text-cream md:pt-1">
        Lista de interesse
        {favorites.isSuccess && <span className="ml-2 text-sm font-normal text-sand">({items.length})</span>}
      </h1>
      {favorites.isPending ? (
        <ul aria-busy="true" aria-label="Carregando favoritos" className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-7">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.isError ? (
        <ErrorState message={favorites.error.message} onRetry={() => void favorites.refetch()} retrying={favorites.isRefetching} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum NFT favoritado ainda"
          message="Toque no coração de um NFT para acompanhá-lo aqui."
          action={
            <Link to="/" hash="catalogo" className="rounded-sm bg-brand px-5 py-2.5 text-sm font-bold text-ink hover:bg-brand-accent">
              Explorar catálogo
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-7" data-testid="favorites-grid">
          {items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
