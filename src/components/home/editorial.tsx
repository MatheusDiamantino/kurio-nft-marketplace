import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { CollectionSlug } from '@/api/contracts'
import { SoonLink } from '@/components/soon'
import { useDragScroll } from '@/lib/use-drag-scroll'

const PROMOS: { title: string; text: string; image: string; collection: CollectionSlug; tab?: 'new' }[] = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald-ape.webp',
    collection: 'colecionaveis',
    tab: 'new',
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/ivory-baron.webp',
    collection: 'arte-digital',
  },
]

export function Promos() {
  const ref = useDragScroll<HTMLElement>()
  return (
    <section ref={ref} aria-label="Destaques do mercado" className="container-page scrollbar-none relative mt-12 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto md:scroll-px-6 md:mt-24 cursor-grab lg:grid lg:cursor-auto lg:grid-cols-2 lg:gap-7 lg:overflow-visible">
      {PROMOS.map((p) => (
        <article key={p.title} className="relative flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-sm bg-surface sm:grid sm:min-h-[250px] sm:w-[70%] sm:grid-cols-2 lg:w-auto">
          <img src={p.image} alt="" width={292} height={250} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover object-[center_30%] sm:aspect-auto sm:h-full sm:min-h-[250px] sm:object-center" />

          <div className="relative flex flex-1 flex-col items-start gap-2 px-5 pt-5 pb-6 text-left sm:items-end sm:justify-center sm:gap-3 sm:px-7 sm:py-6 sm:text-right">
            <h2 className="max-w-[260px] text-base leading-6 font-bold text-cream">{p.title}</h2>
            <p className="mb-4 max-w-[263px] text-[13px] leading-[22px] text-sand sm:mb-0">{p.text}</p>
            <Link
              to="/"
              search={{ collection: [p.collection], tab: p.tab }}
              hash="catalogo"
              className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-brand text-sm font-bold text-ink hover:bg-brand-accent sm:mt-3 sm:w-[140px]"
            >
              Explorar <ArrowRight className="size-4" aria-hidden />
              <span className="sr-only">{p.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/nfts/ivory-baron.webp' },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/nfts/emerald-ape.webp' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/nfts/sage-nomad.webp' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/nfts/golden-beat.webp' },
]

export function Blog() {
  const ref = useDragScroll<HTMLUListElement>()
  return (
    <section aria-labelledby="blog-title" className="container-page mt-16 md:mt-24">
      <header className="text-center">
        <h2 id="blog-title" className="text-2xl font-bold text-cream">
          Diário da Cunhagem
        </h2>
        <p className="mt-3 text-[13px] text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <ul ref={ref} className="scrollbar-none relative mt-8 flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto md:mt-10 md:grid md:cursor-auto md:grid-cols-2 md:gap-6 md:overflow-visible lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title} className="w-[78%] shrink-0 snap-start sm:w-[60%] md:w-auto">
            <article className="flex h-full flex-col overflow-hidden rounded-sm bg-surface">
              <img
                src={post.image}
                alt=""
                width={281}
                height={205}
                loading="lazy"
                decoding="async"
                className="aspect-[281/205] w-full rounded-t-sm object-cover object-center"
              />
              <div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-5">
                <p className="text-[13px] leading-5 text-sand">
                  <time>{post.date}</time>
                  <span aria-hidden className="mx-2">
                    |
                  </span>
                  Leitura de {post.read}
                </p>
                <h3 className="text-[17px] leading-6 font-bold text-cream">{post.title}</h3>
                <p className="text-[13px] leading-[22px] text-sand">{post.text}</p>
                <SoonLink label={`Artigo "${post.title}"`} className="mt-auto pt-1 text-[13px] font-bold text-brand">
                  Ler mais <span aria-hidden>→</span>
                  <span className="sr-only">: {post.title}</span>
                </SoonLink>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
