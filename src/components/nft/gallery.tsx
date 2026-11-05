import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { NftDetail } from '@/api/contracts'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function NftGallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0)
  const images = nft.gallery.length ? nft.gallery : [nft.image]
  const current = images[active] ?? nft.image

  return (
    <div className="flex gap-6 lg:w-[567px] lg:shrink-0">
      <ul aria-label="Imagens do NFT" className="flex w-[100px] shrink-0 flex-col gap-4">
        {images.map((src, i) => (
          <li key={`${src}-${i}`}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1} de ${images.length}`}
              aria-pressed={i === active}
              className={cn(
                'block size-[100px] overflow-hidden rounded-[8px] border-2 transition-colors',
                i === active ? 'border-brand' : 'border-transparent hover:border-line-soft',
              )}
            >
              <img src={src} alt="" width={100} height={100} loading="lazy" decoding="async" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative flex aspect-square w-full max-w-[443px] items-center justify-center bg-surface p-5">
        <img
          src={current}
          alt={nft.imageAlt}
          width={432}
          height={432}
          fetchPriority="high"
          decoding="async"
          className="size-full rounded-[18px] object-cover"
        />
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-ink/85 text-cream hover:text-brand-accent"
              aria-label={`Ampliar imagem de ${nft.name}`}
            >
              <Search className="size-5" aria-hidden />
            </button>
          </DialogTrigger>
          <DialogContent showCloseButton={false} className="max-w-[min(92vw,720px)] border-line-soft bg-surface p-4 sm:max-w-[min(92vw,720px)]">
            <DialogTitle className="pr-10 text-base font-bold text-cream">{nft.name}</DialogTitle>
            <DialogDescription className="sr-only">Imagem ampliada do NFT.</DialogDescription>
            <img src={current} alt={nft.imageAlt} width={720} height={720} className="aspect-square w-full rounded-[18px] object-cover" />
            <DialogClose
              className="absolute top-3 right-3 grid size-9 place-items-center rounded-sm text-sand hover:text-brand-accent"
              aria-label="Fechar imagem ampliada"
            >
              <X className="size-5" aria-hidden />
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
