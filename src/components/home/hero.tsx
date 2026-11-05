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

/**
 * Featured slides switcher. No autoplay (WCAG 2.2.2): the user changes the
 * slide with the dots, which are real buttons with aria-current.
 */
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
          className="group grid size-6 place-items-center rounded-full"
        >
          {/* 24×24 touch target, 8px visual dot (Figma) */}
          <span
            aria-hidden
            className={cn('size-2 rounded-full bg-brand transition-opacity', i === index ? 'opacity-100' : 'opacity-50 group-hover:opacity-80')}
          />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]

  return (
    <section aria-label="Boas-vindas" className="container-page">
      {/* Desktop / tablet */}
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
          <img
            key={slide.image}
            src={slide.image}
            alt={slide.alt}
            width={450}
            height={450}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className="size-full object-cover"
          />
          <p className="sr-only" aria-live="polite">
            Destaque {index + 1} de {SLIDES.length}
          </p>
        </div>
      </div>

      {/* Mobile card (Figma "Hero Banner") */}
      <div className="relative mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#3a2418] via-surface to-surface-dark px-4 py-4 md:hidden">
        <span aria-hidden className="pointer-events-none absolute -top-16 left-24 size-56 rounded-full bg-cream/[0.04]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-full bg-cream/[0.04]" />
        <div className="relative flex gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-medium text-cream">Bem-vindo à Kurio</p>
            {/* Only one of the two h1s is rendered at a time (the other is display:none). */}
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
            <img
              src={slide.image}
              alt={slide.alt}
              width={138}
              height={138}
              className="aspect-square w-[138px] rounded-[16px] object-cover"
            />
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
