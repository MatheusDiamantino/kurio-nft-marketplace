import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const SLIDES = [
  {
    image: '/nfts/emerald-ape.webp',
    alt: 'Emerald Ape #042: macaco marrom com óculos redondos verdes e jaqueta college verde',
  },
  {
    image: '/nfts/sage-nomad.webp',
    alt: 'Sage Nomad #009: gorila cinza com chapéu bucket verde-sálvia e moletom roxo',
  },
  {
    image: '/nfts/golden-beat.webp',
    alt: 'Golden Beat #207: macaco dourado com fones de ouvido verdes',
  },
]

function scrollToCatalog() {
  const el = document.getElementById('catalogo')
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

function SlideDots({ index, onChange, className }: { index: number; onChange: (i: number) => void; className?: string }) {
  return (
    <div role="group" aria-label="Destaques" className={cn('flex items-center', className)}>
      {SLIDES.map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`Mostrar destaque ${i + 1} de ${SLIDES.length}`}
          aria-current={i === index ? 'true' : undefined}
          className="group grid h-6 w-4 place-items-center rounded-full"
        >
          <span
            aria-hidden
            className={cn('size-2 rounded-full bg-brand transition-opacity', i === index ? 'opacity-100' : 'opacity-50 group-hover:opacity-80')}
          />
        </button>
      ))}
    </div>
  )
}

function SlideTrack({ index, size, priority }: { index: number; size: number; priority?: boolean }) {
  return (
    <div
      className="flex size-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ transform: `translateX(-${index * 100}%)` }}
    >
      {SLIDES.map((s, i) => (
        <img
          key={s.image}
          src={s.image}
          alt={i === index ? s.alt : ''}
          aria-hidden={i !== index}
          width={size}
          height={size}
          fetchPriority={priority && i === 0 ? 'high' : 'auto'}
          decoding="async"
          className="size-full shrink-0 object-cover"
        />
      ))}
    </div>
  )
}

export function Hero() {
  const [index, setIndex] = useState(0)

  return (
    <section aria-label="Boas-vindas" className="container-page">
      <div className="mt-8 hidden min-h-[450px] items-center gap-10 md:flex lg:pl-10">
        <div className="flex max-w-[600px] flex-1 flex-col">
          <p className="text-sm tracking-[0.1em] text-cream">Bem-vindo à Kurio</p>
          <h1
            className="mt-6 text-[32px] leading-[52px] font-bold tracking-[0.04em] text-cream uppercase lg:text-[43px] lg:leading-[70px]"
          >
            Seja dono do futuro da arte digital
          </h1>
          <p className="mt-1 max-w-[557px] text-sm leading-6 text-sand">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <div className="mt-8 flex items-end justify-between">
            <button
              type="button"
              onClick={scrollToCatalog}
              className="h-10 w-[140px] rounded-sm bg-brand text-sm font-bold tracking-[0.04em] text-ink hover:bg-brand-accent"
            >
              EXPLORAR
            </button>
            <SlideDots index={index} onChange={setIndex} className="mb-0.5" />
          </div>
        </div>
        <div className="relative ml-auto aspect-square w-[min(450px,42vw)] shrink-0 overflow-hidden rounded-[20px] bg-surface">
          <SlideTrack index={index} size={450} priority />
          <p className="sr-only" aria-live="polite">
            Destaque {index + 1} de {SLIDES.length}
          </p>
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-hero-from to-hero-to px-4 py-4 md:hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute top-[52%] left-[8%] aspect-square w-[73%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-[52%] left-[58%] aspect-square w-[73%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20"
        />
        <div className="relative flex gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-medium text-cream">Bem-vindo à Kurio</p>
            <h1 className="mt-2 text-[17px] leading-7 font-bold tracking-[0.03em] text-cream uppercase">Seja dono da cultura digital</h1>
            <p className="mt-2 text-xs leading-[18px] text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <button
              type="button"
              onClick={scrollToCatalog}
              className="mt-2 inline-flex w-fit items-center gap-2 py-1 text-xs font-bold text-brand hover:text-brand-accent"
            >
              EXPLORAR <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="relative w-[138px] shrink-0">
            <div className="aspect-square w-[138px] overflow-hidden rounded-[16px]">
              <SlideTrack index={index} size={138} />
            </div>
            <img
              src={SLIDES[(index + 1) % SLIDES.length].image}
              alt=""
              width={58}
              height={58}
              loading="lazy"
              className="absolute -bottom-3 -left-3 size-[58px] rounded-[12px] border-2 border-surface object-cover"
            />
          </div>
        </div>
        <SlideDots index={index} onChange={setIndex} className="relative mt-3 justify-center" />
      </div>
    </section>
  )
}
