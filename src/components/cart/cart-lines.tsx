import { Link } from '@tanstack/react-router'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import type { CartLine } from '@/api/contracts'
import { QuantityStepper } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useRemoveCartItem, useUpdateCartItem } from '@/queries/cart'
import { noticeStore, useLiveNotices } from '@/realtime/notices'

export function lineKey(l: Pick<CartLine, 'nftId' | 'editionId'>) {
  return `${l.nftId}:${l.editionId}`
}

export function lineProblem(l: CartLine): string | null {
  if (l.available === 0) return `Indisponível: edição ${l.editionLabel} esgotada`
  if (l.quantity > l.available) return `Indisponível: restam ${l.available}`
  return null
}

/** Realtime notices (price / availability) concerning NFTs in the cart. */
export function CartLiveNotices({ nftIds }: { nftIds: string[] }) {
  const notices = useLiveNotices().filter((n) => nftIds.includes(n.nftId))
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 empty:hidden">
      {notices.map((n) => (
        <div
          key={n.id}
          data-testid="live-notice"
          className="flex items-start justify-between gap-3 rounded-sm border border-brand bg-surface-dark/60 px-4 py-3 text-sm text-cream"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>
              <strong className="mr-1 font-bold text-brand">{n.kind === 'price' ? 'Preço alterado:' : 'Disponibilidade alterada:'}</strong>
              {n.message}
            </span>
          </p>
          <button
            type="button"
            onClick={() => noticeStore.dismiss(n.id)}
            className="shrink-0 text-sand hover:text-brand-accent"
            aria-label="Dispensar aviso"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}

function useLineActions(line: CartLine) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const setQty = (quantity: number) => update.mutate({ nftId: line.nftId, editionId: line.editionId, quantity })
  const removeLine = () => remove.mutate({ nftId: line.nftId, editionId: line.editionId, name: line.name })
  const fix = () => (line.available > 0 ? setQty(Math.min(line.available, line.maxQuantity)) : removeLine())
  return { setQty, removeLine, fix, busy: update.isPending || remove.isPending }
}

function Badges({ line, priceChanged }: { line: CartLine; priceChanged: boolean }) {
  const problem = lineProblem(line)
  if (!problem && !priceChanged) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {priceChanged && (
        <span className="rounded-sm border border-brand px-1.5 py-0.5 text-[11px] font-bold text-brand">Preço atualizado</span>
      )}
      {problem && (
        <span className="inline-flex items-center gap-1 rounded-sm border border-danger px-1.5 py-0.5 text-[11px] font-bold text-danger">
          <AlertTriangle className="size-3" aria-hidden />
          {problem}
        </span>
      )}
    </span>
  )
}

function FixButton({ line, onFix }: { line: CartLine; onFix: () => void }) {
  if (!lineProblem(line)) return null
  return (
    <button type="button" onClick={onFix} className="text-xs font-bold text-brand-accent underline underline-offset-2 hover:text-brand">
      {line.available > 0 ? `Ajustar quantidade para ${Math.min(line.available, line.maxQuantity)}` : 'Remover item esgotado'}
    </button>
  )
}

function Thumb({ line, size }: { line: CartLine; size: number }) {
  return (
    <img
      src={line.image}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-sm object-cover"
    />
  )
}

function DesktopRow({ line, priceChanged }: { line: CartLine; priceChanged: boolean }) {
  const a = useLineActions(line)
  return (
    <tr data-testid="cart-line" data-nft={line.nftId} className="bg-surface">
      <td className="py-0 pr-3">
        <div className="flex items-center gap-4">
          <Thumb line={line} size={70} />
          <div className="flex flex-col gap-1 py-2">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="text-[15px] font-bold text-cream hover:text-brand-accent">
              {line.name}
            </Link>
            <span className="text-sm text-tan">ID do token: {line.tokenId}</span>
            <span className="text-xs text-sand">Edição: {line.editionLabel}</span>
            <Badges line={line} priceChanged={priceChanged} />
            <FixButton line={line} onFix={a.fix} />
          </div>
        </div>
      </td>
      <td className="px-2 text-[15px] font-bold text-brand tabular-nums">{formatEth(line.unitPrice)}</td>
      <td className="px-2">
        <QuantityStepper
          size="sm"
          value={line.quantity}
          max={Math.max(line.maxQuantity, 1)}
          onChange={a.setQty}
          disabled={a.busy}
          label={`Quantidade de ${line.name}`}
        />
      </td>
      <td className="px-2 text-[15px] font-bold text-brand tabular-nums" data-testid="line-total">
        {formatEth(line.lineTotal)}
      </td>
      <td className="pr-6 text-right">
        <button
          type="button"
          onClick={a.removeLine}
          disabled={a.busy}
          className="inline-grid size-9 place-items-center rounded-sm text-sand hover:text-danger disabled:opacity-50"
          aria-label={`Remover ${line.name} do carrinho`}
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function MobileCard({ line, priceChanged }: { line: CartLine; priceChanged: boolean }) {
  const a = useLineActions(line)
  return (
    <li data-testid="cart-line-mobile" className="flex gap-3 overflow-hidden rounded-[18px] bg-surface">
      <Thumb line={line} size={100} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-2 pr-3">
        <div className="flex items-start justify-between gap-2">
          <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="truncate text-[15px] font-bold text-cream hover:text-brand-accent">
            {line.name}
          </Link>
          <button
            type="button"
            onClick={a.removeLine}
            disabled={a.busy}
            className="-mt-1 -mr-1 inline-grid size-8 shrink-0 place-items-center text-sand hover:text-danger"
            aria-label={`Remover ${line.name} do carrinho`}
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </div>
        <span className="text-sm text-sand">Edição: {line.editionLabel}</span>
        <Badges line={line} priceChanged={priceChanged} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-brand tabular-nums">{formatEth(line.lineTotal)}</span>
          <QuantityStepper
            size="sm"
            value={line.quantity}
            max={Math.max(line.maxQuantity, 1)}
            onChange={a.setQty}
            disabled={a.busy}
            label={`Quantidade de ${line.name}`}
          />
        </div>
        <FixButton line={line} onFix={a.fix} />
      </div>
    </li>
  )
}

export function CartLines({ lines }: { lines: CartLine[] }) {
  const notices = useLiveNotices()
  const changed = (id: string) => notices.some((n) => n.nftId === id && n.kind === 'price')
  return (
    <>
      <table className="hidden w-full border-separate border-spacing-y-3 md:table">
        <caption className="sr-only">Itens no carrinho</caption>
        <thead>
          <tr className="text-left text-[15px] font-bold text-cream">
            <th scope="col" className="border-b border-line pb-3 font-bold">
              NFTs
            </th>
            <th scope="col" className="border-b border-line px-2 pb-3 font-bold">
              Preço
            </th>
            <th scope="col" className="border-b border-line px-2 pb-3 font-bold">
              Edições
            </th>
            <th scope="col" className="border-b border-line px-2 pb-3 font-bold">
              Total
            </th>
            <th scope="col" className="border-b border-line pb-3">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <DesktopRow key={lineKey(l)} line={l} priceChanged={changed(l.nftId)} />
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-4 md:hidden" aria-label="Itens no carrinho">
        {lines.map((l) => (
          <MobileCard key={lineKey(l)} line={l} priceChanged={changed(l.nftId)} />
        ))}
      </ul>
    </>
  )
}

export function CartLinesSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="hidden h-6 w-full md:block" />
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn('flex items-center gap-4 rounded-[18px] bg-surface md:rounded-none')}>
          <Skeleton className="size-[100px] shrink-0 md:size-[70px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
