import { Mail, Star } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NftDetail } from '@/api/contracts'
import { LinkedinIcon, TwitterIcon } from '@/components/brand-icons'
import { Skeleton } from '@/components/ui/skeleton'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { NETWORK_LABEL } from './labels'

export function Stars({ rating, className }: { rating: number; className?: string }) {
  const full = Math.round(rating)
  return (
    <span className={className} role="img" aria-label={`Nota ${rating.toFixed(1).replace('.', ',')} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden className={i < full ? 'inline size-3.5 fill-current' : 'inline size-3.5'} />
      ))}
    </span>
  )
}

export function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${nft.name} na Kurio`
  const links = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, Icon: LinkedinIcon, external: true },
    { label: 'e-mail', href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, Icon: Mail, external: false },
    {
      label: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      Icon: TwitterIcon,
      external: true,
    },
  ]
  return (
    <div className="flex items-center gap-3 text-sm font-bold text-cream">
      <span>Compartilhar este NFT:</span>
      <ul className="flex items-center gap-1">
        {links.map(({ label, href, Icon, external }) => (
          <li key={label}>
            <a
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              aria-label={`Compartilhar por ${label}${external ? ' (abre em nova aba)' : ''}`}
              className="grid size-7 place-items-center rounded-sm text-cream hover:text-brand-accent"
            >
              <Icon className="size-4" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MetaLines({ nft, className }: { nft: NftDetail; className?: string }) {
  return (
    <dl className={className}>
      {[
        ['ID do token', nft.tokenId],
        ['Coleção', nft.collectionName],
        ['Atributos', nft.attributes.join(', ')],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <dt>{k}:</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DetailTabs({ nft }: { nft: NftDetail }) {
  const dragRef = useDragScroll<HTMLDivElement>()
  const short = `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}`
  return (
    <Tabs defaultValue="details" className="container-page mt-16 md:mt-20">
      <TabsList ref={dragRef} aria-label="Informações do NFT" className="scrollbar-none overflow-x-auto">
        <TabsTrigger value="details">
          Detalhes do NFT
        </TabsTrigger>
        <TabsTrigger value="reviews">
          Avaliações de colecionadores ({nft.reviewsCount})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="mt-4 flex flex-col gap-5 text-[13px] leading-[22px] text-sand outline-none">
        {nft.longDescription.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <dl className="flex flex-col gap-4">
          <div>
            <dt className="font-bold text-cream">Rede:</dt>
            <dd>Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no IPFS.</dd>
          </div>
          <div>
            <dt className="font-bold text-cream">Contrato:</dt>
            <dd>
              Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-cream">Direitos autorais:</dt>
            <dd>
              <span title={nft.contractAddress}>{short}</span> <span aria-hidden>•</span> Contrato inteligente ERC-721 verificado.
            </dd>
          </div>
        </dl>
      </TabsContent>
      <TabsContent value="reviews" className="mt-4 flex flex-col gap-3 text-sm text-sand outline-none">
        <p className="flex items-center gap-2 text-cream">
          <Stars rating={nft.rating} className="text-brand" />
          <span>
            {nft.rating.toFixed(1).replace('.', ',')} de 5 · {nft.reviewsCount} avaliações de colecionadores
          </span>
        </p>
        <p>A leitura completa das avaliações ainda não está disponível nesta demonstração.</p>
      </TabsContent>
    </Tabs>
  )
}

export function DetailSkeleton() {
  return (
    <div aria-hidden>

      <div className="container-page mt-6 hidden md:block">
        <Skeleton className="h-4 w-40" />
        <div className="mt-6 flex flex-wrap gap-8 lg:flex-nowrap">
          <div className="flex gap-6">
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="size-[100px] rounded-[8px]" />
              ))}
            </div>
            <Skeleton className="aspect-square w-[443px] max-w-[60vw]" />
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-12 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <div className="px-7 pt-16">
          <Skeleton className="h-[326px] w-full rounded-[24px]" />
        </div>
        <div className="mt-6 flex flex-col gap-3 px-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-6 w-1/2 rounded-full" />
        </div>
      </div>
    </div>
  )
}
