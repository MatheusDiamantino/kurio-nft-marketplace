import { useId, useRef, useState } from 'react'
import type { CollectionSlug } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { ErrorState } from '@/components/shared'
import { useCatalog } from '@/queries/catalog'
import { cn } from '@/lib/utils'

/**
 * "Mais desta coleção" / "Colecionadores também viram" rail.
 * Scroll-snap row (5 visible on desktop) with page dots, keyboard reachable.
 */
export function RelatedCarousel({
  title,
  collection,
  excludeIds = [],
}: {
  title: string
  collection?: CollectionSlug
  excludeIds?: string[]
}) {
  const headingId = useId()
  const { data, isPending, isError, refetch, isRefetching } = useCatalog({
    collections: collection ? [collection] : undefined,
    sort: 'recent',
    tab: 'all',
    page: 1,
    pageSize: 16,
  })
  const items = (data?.items ?? []).filter((n) => !excludeIds.includes(n.id)).slice(0, 15)
  const trackRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / 5))

  const goTo = (p: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: p * track.clientWidth, behavior: 'smooth' })
    setPage(p)
  }

  return (
    <section aria-labelledby={headingId} className="container-page mt-16 md:mt-24">
      <h2 id={headingId} className="border-b border-line pb-3 text-base font-bold text-brand">
        {title}
      </h2>
      {isError ? (
        <ErrorState className="mt-6" message="Não foi possível carregar sugestões." onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <ul
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget
            setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          className="scrollbar-none mt-8 grid snap-x snap-mandatory auto-cols-[calc((100%-1rem)/2)] grid-flow-col gap-4 overflow-x-auto sm:auto-cols-[calc((100%-2rem)/3)] lg:auto-cols-[calc((100%-6.5rem)/5)] lg:gap-[1.625rem]"
        >
          {isPending
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="snap-start">
                  <NftCardSkeleton />
                </li>
              ))
            : items.map((nft) => (
                <li key={nft.id} className="snap-start">
                  <NftCard nft={nft} />
                </li>
              ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-6 flex justify-center" role="group" aria-label={`Páginas de ${title}`}>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir para a página ${i + 1} de ${pages}`}
              aria-current={page === i ? 'true' : undefined}
              className="grid size-6 place-items-center rounded-full"
            >
              <span aria-hidden className={cn('size-3 rounded-full border border-brand', page === i && 'bg-brand')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
