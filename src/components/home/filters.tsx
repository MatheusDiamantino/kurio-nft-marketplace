import { useId, useState } from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { Check } from 'lucide-react'
import type { CatalogResponse } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { toggleIn, useHomeSearch } from './use-home-search'

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

function FacetList<T extends string>({
  title,
  items,
  selected,
  onToggle,
  loading,
}: {
  title: string
  items: { value: T; label: string; count: number }[]
  selected: T[]
  onToggle: (v: T) => void
  loading: boolean
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="mb-2 text-base font-bold text-cream">
        {title}
      </h3>
      <ul className="flex flex-col">
        {items.map((item) => {
          const active = selected.includes(item.value)
          return (
            <li key={item.value}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(item.value)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-3 py-[9px] text-left text-sm transition-colors hover:bg-surface-dark hover:text-brand-accent',
                  active ? 'font-bold text-brand' : 'text-sand',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn('grid size-3.5 place-items-center rounded-[3px] border', active ? 'border-brand bg-brand text-ink' : 'border-line-soft')}
                  >
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {item.label}
                </span>
                <span className={cn('tabular-nums', loading && 'opacity-50')}>
                  <span className="sr-only">, </span>({item.count})<span className="sr-only"> itens</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PriceRange({ min, max, bounds }: { min?: string; max?: string; bounds: { min: number; max: number } }) {
  const { update } = useHomeSearch()
  const headingId = useId()
  const lo = bounds.min
  const hi = Math.max(bounds.max, lo + 0.01)
  const initial = (): [number, number] => [min ? Number(min) : lo, max ? Number(max) : hi]
  // The parent remounts this component (key) when the URL range changes,
  // so back/forward and "Limpar filtros" re-sync the thumbs.
  const [value, setValue] = useState<[number, number]>(initial)

  const apply = () => {
    const [a, b] = value
    update({
      min: a > lo ? a.toFixed(2) : undefined,
      max: b < hi ? b.toFixed(2) : undefined,
    })
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="text-base font-bold text-cream">
        Faixa de preço
      </h3>
      <SliderPrimitive.Root
        min={lo}
        max={hi}
        step={0.01}
        minStepsBetweenThumbs={1}
        value={value}
        onValueChange={(v) => setValue([v[0], v[1]] as [number, number])}
        className="relative flex h-5 w-full touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-[3px] grow rounded-full bg-brand/50">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand" />
        </SliderPrimitive.Track>
        {(['Preço mínimo', 'Preço máximo'] as const).map((label, i) => (
          <SliderPrimitive.Thumb
            key={label}
            aria-label={label}
            aria-valuetext={`${fmt(value[i])} ETH`}
            className="block size-4 rounded-full border-2 border-brand bg-[#c27a3c] shadow focus-visible:ring-4 focus-visible:ring-brand-accent/50 focus-visible:outline-none"
          />
        ))}
      </SliderPrimitive.Root>
      <p className="text-sm text-cream" aria-live="polite">
        Preço: {fmt(value[0])} - {fmt(value[1])} ETH
      </p>
      <button
        type="button"
        onClick={apply}
        className="w-fit rounded-sm bg-brand px-3 py-1.5 text-base font-medium text-ink hover:bg-brand-accent"
      >
        Aplicar<span className="sr-only"> faixa de preço</span>
      </button>
    </section>
  )
}

/** Shared by the desktop sidebar and the mobile filter sheet. */
export function CatalogFilters({ data, loading }: { data: CatalogResponse | undefined; loading: boolean }) {
  const { search, update } = useHomeSearch()
  const facets = data?.facets
  const bounds = facets ? { min: Number(facets.priceRange.min), max: Number(facets.priceRange.max) } : { min: 0, max: 13 }

  return (
    <div className="flex flex-col gap-8">
      <FacetList
        title="Coleções"
        items={facets?.collections ?? []}
        selected={search.collection ?? []}
        onToggle={(v) => update({ collection: toggleIn(search.collection, v) })}
        loading={loading}
      />
      {facets && (
        <PriceRange key={`${search.min ?? ''}|${search.max ?? ''}|${bounds.min}|${bounds.max}`} min={search.min} max={search.max} bounds={bounds} />
      )}
      <FacetList
        title="Rede"
        items={facets?.networks ?? []}
        selected={search.network ?? []}
        onToggle={(v) => update({ network: toggleIn(search.network, v) })}
        loading={loading}
      />
    </div>
  )
}
