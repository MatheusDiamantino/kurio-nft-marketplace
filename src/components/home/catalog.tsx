import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, Settings2, X } from 'lucide-react'
import { TABS, type CatalogResponse, type CatalogSort, type CatalogTab } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { EmptyState, ErrorState } from '@/components/shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCatalog } from '@/queries/catalog'
import { PAGE_SIZE, toCatalogQuery } from '@/routes/search'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './filters'
import { useHomeSearch } from './use-home-search'

const TAB_LABELS: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

const SORT_LABELS: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome A–Z',
}

function scrollToCatalogTop() {
  const el = document.getElementById('catalogo')
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export function CatalogSearch({ id, placeholder, className, inputClassName }: { id: string; placeholder: string; className?: string; inputClassName?: string }) {
  const { search, update } = useHomeSearch()
  const urlQ = search.q ?? ''
  const [text, setText] = useState(urlQ)
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ)
  const typingSession = useRef(false)
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ)
    if (urlQ !== text.trim()) setText(urlQ)
  }

  useEffect(() => {
    const next = text.trim()
    if (next === urlQ) return
    const t = setTimeout(() => {
      void update({ q: next || undefined }, { replace: typingSession.current })
      typingSession.current = true
    }, 300)
    return () => clearTimeout(t)
  }, [text])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = text.trim()
    if (next !== urlQ) void update({ q: next || undefined }, { replace: typingSession.current })
    typingSession.current = false
  }

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-sand" aria-hidden />
      <input
        id={id}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          typingSession.current = false
        }}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          'h-10 w-full rounded-sm border border-line bg-surface pr-3 pl-10 text-sm text-cream placeholder:text-sand focus:border-brand-accent',
          inputClassName,
        )}
      />
    </form>
  )
}

function CatalogTabs({ tab, onChange }: { tab: CatalogTab; onChange: (t: CatalogTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const dragRef = useDragScroll<HTMLDivElement>()
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (i + dir + TABS.length) % TABS.length
    refs.current[next]?.focus()
    onChange(TABS[next])
  }
  return (
    <div ref={dragRef} role="tablist" aria-label="Exibir" className="scrollbar-none flex min-w-0 justify-between gap-2 overflow-x-auto min-[380px]:gap-3 md:justify-start md:gap-6">
      {TABS.map((t, i) => {
        const active = t === tab
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`catalog-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="catalog-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'shrink-0 border-b-2 pb-1 text-sm whitespace-nowrap transition-colors hover:text-brand-accent md:text-sm',
              active ? 'border-brand font-bold text-brand' : 'border-transparent text-cream',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        )
      })}
    </div>
  )
}

function SortSelect({ value, onChange, className }: { value: CatalogSort; onChange: (s: CatalogSort) => void; className?: string }) {
  const labelId = useId()
  return (
    <div className={cn('flex items-center gap-1 text-sm text-cream', className)}>
      <span id={labelId}>Ordenar por:</span>
      <Select value={value} onValueChange={(v) => onChange(v as CatalogSort)}>
        <SelectTrigger
          aria-labelledby={labelId}
          data-testid="sort-select"
          className="h-8 border-0 bg-transparent px-1 text-sm text-cream shadow-none hover:text-brand-accent dark:bg-transparent dark:hover:bg-transparent [&_svg:not([class*='text-'])]:text-cream"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end" className="border-line-soft bg-surface text-cream">
          {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => (
            <SelectItem key={s} value={s} className="focus:bg-surface-dark focus:text-brand-accent">
              {SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const windowSize = 4
  const start = Math.max(1, Math.min(page - 1, totalPages - windowSize + 1))
  const pages = Array.from({ length: Math.min(windowSize, totalPages) }, (_, i) => start + i)
  const btn = 'grid size-[26px] place-items-center rounded-[3px] border border-line-soft text-sm text-cream hover:border-brand hover:text-brand-accent disabled:opacity-40 disabled:hover:border-line-soft'
  return (
    <nav aria-label="Paginação do catálogo" className="mt-12 flex justify-center md:mt-16 md:justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={btn} onClick={() => onChange(page - 1)} aria-label="Página anterior">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          </li>
        )}
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={cn(btn, p === page && 'border-brand bg-brand font-bold text-ink hover:text-ink')}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={btn} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}

function FeaturedBanner() {
  return (
    <aside aria-labelledby="featured-title" className="hidden flex-col gap-4 bg-surface pt-6 lg:flex">
      <div className="flex flex-col gap-4 px-3">
        <h2 id="featured-title" className="text-[22px] leading-8 font-bold tracking-[0.03em] text-brand">
          NFT EM DESTAQUE
        </h2>
        <p className="text-center text-[22px] font-bold tracking-[0.04em] text-cream">OFERTA LIMITADA</p>
      </div>
      <Link to="/nft/$nftId" params={{ nftId: 'sage-nomad-009' }} className="group block overflow-hidden rounded-[18px]">
        <img
          src="/nfts/sage-nomad.webp"
          alt="Sage Nomad #009 em oferta limitada: gorila cinza com chapéu bucket e moletom roxo"
          width={310}
          height={368}
          loading="lazy"
          decoding="async"
          className="h-[368px] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </Link>
    </aside>
  )
}

function activeFilterCount(s: ReturnType<typeof useHomeSearch>['search']) {
  return (s.collection?.length ?? 0) + (s.network?.length ?? 0) + (s.min || s.max ? 1 : 0)
}

function MobileFilters({ data, loading, total }: { data: CatalogResponse | undefined; loading: boolean; total: number }) {
  const { search, update, clear } = useHomeSearch()
  const count = activeFilterCount(search)
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative grid size-[45px] shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-brand to-brand-strong text-ink shadow-md hover:from-brand-accent hover:to-brand"
          aria-label={count ? `Filtros e ordenação (${count} ativos)` : 'Filtros e ordenação'}
        >
          <Settings2 className="size-5" strokeWidth={2.25} aria-hidden />
          {count > 0 && (
            <span aria-hidden className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-cream text-[10px] font-bold text-ink">
              {count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="w-[88vw] gap-0 border-line bg-ink p-0 sm:max-w-sm">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <SheetTitle className="text-base font-bold text-cream">Filtros</SheetTitle>
          <SheetClose className="grid size-9 place-items-center rounded-sm text-sand hover:text-brand-accent" aria-label="Fechar filtros">
            <X className="size-5" aria-hidden />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">Refine o catálogo por coleção, preço e rede.</SheetDescription>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <SortSelect value={search.sort ?? 'recent'} onChange={(s) => void update({ sort: s })} className="mb-6" />
          <CatalogFilters data={data} loading={loading} />
        </div>
        <div className="flex gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={() => void clear()}
            className="h-11 flex-1 rounded-sm border border-brand text-sm font-bold text-brand-accent hover:bg-surface-dark"
          >
            Limpar
          </button>
          <SheetClose className="h-11 flex-1 rounded-sm bg-brand text-sm font-bold text-ink hover:bg-brand-accent">
            Ver {total} {total === 1 ? 'resultado' : 'resultados'}
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MobileSearchBar() {
  const { search } = useHomeSearch()
  const { data, isFetching } = useCatalog(toCatalogQuery(search))
  return (
    <div className="container-page flex gap-3 pt-6 md:hidden">
      <CatalogSearch
        id="mobile-search"
        placeholder="Explorar coleções"
        className="flex-1"
        inputClassName="h-[45px] rounded-[12px] border-transparent bg-surface text-base font-medium"
      />
      <MobileFilters data={data} loading={isFetching} total={data?.total ?? 0} />
    </div>
  )
}

function useDelayedFlag(flag: boolean, delayMs = 300) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!flag) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), delayMs)
    return () => clearTimeout(t)
  }, [flag, delayMs])
  return shown
}

export function Catalog() {
  const { search, update, setPage, clear } = useHomeSearch()
  const query = toCatalogQuery(search)
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch, error } = useCatalog(query)
  const tab = search.tab ?? 'all'
  const page = query.page ?? 1
  const updating = useDelayedFlag(isFetching && !isPending)
  const dimmed = useDelayedFlag(isPlaceholderData)
  const hasFilters = activeFilterCount(search) > 0 || !!search.q || !!search.tab

  const goToPage = (p: number) => {
    void setPage(p)
    scrollToCatalogTop()
  }


  return (
    <section id="catalogo" tabIndex={-1} aria-labelledby="catalog-title" className="container-page mt-8 scroll-mt-6 outline-none md:mt-24">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="flex gap-12">
        <div className="hidden w-[310px] shrink-0 flex-col gap-6 lg:flex">
          <div className="bg-surface px-4 py-6">
            <CatalogFilters data={data} loading={updating} />
          </div>
          <FeaturedBanner />
        </div>

        <div className="min-w-0 flex-1">
          
          <div className="flex items-center justify-between gap-4">
            <CatalogTabs tab={tab} onChange={(t) => void update({ tab: t === 'all' ? undefined : t })} />
            <SortSelect value={search.sort ?? 'recent'} onChange={(s) => void update({ sort: s === 'recent' ? undefined : s })} className="hidden md:flex" />
          </div>
          
          <div id="catalog-panel" role="tabpanel" aria-labelledby={`catalog-tab-${tab}`} aria-busy={isFetching} className="mt-6 md:mt-8">
            {isError && !data ? (
              <ErrorState
                title="Não foi possível carregar o catálogo"
                message={error?.message ?? 'Tente novamente em instantes.'}
                onRetry={() => void refetch()}
                retrying={isFetching}
              />
            ) : isPending ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-8 lg:grid-cols-3 lg:gap-y-[72px] [&>li:nth-child(even)]:mt-8 md:[&>li:nth-child(even)]:mt-0">
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                message="Tente outros termos de busca ou remova alguns filtros."
                action={
                  hasFilters ? (
                    <button type="button" onClick={() => void clear()} className="mt-2 rounded-sm bg-brand px-4 py-2 text-sm font-bold text-ink hover:bg-brand-accent">
                      Limpar filtros
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {isError && (
                  <p role="alert" className="mb-4 rounded-sm border border-danger/40 bg-surface px-3 py-2 text-sm text-danger">
                    Não foi possível atualizar os resultados.{' '}
                    <button type="button" className="underline" onClick={() => void refetch()}>
                      Tentar novamente
                    </button>
                  </p>
                )}
                <ul
                  data-testid="catalog-grid"
                  className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity duration-300 md:gap-x-8 lg:grid-cols-3 lg:gap-y-[72px] [&>li:nth-child(even)]:mt-8 md:[&>li:nth-child(even)]:mt-0',
                    dimmed && 'opacity-60',
                  )}
                >
                  {data?.items.map((nft, i) => (
                    <li
                      key={nft.id}
                      className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300 ease-out"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <NftCard nft={nft} priority={i < 3} />
                    </li>
                  ))}
                </ul>
                <Pagination page={data?.page ?? page} totalPages={data?.totalPages ?? 1} onChange={goToPage} />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
