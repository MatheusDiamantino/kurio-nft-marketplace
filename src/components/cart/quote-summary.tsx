import type { Quote } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function QuoteSummary({
  quote,
  loading,
  refreshing,
  className,
  feeAlign = 'right',
}: {
  quote: Quote | undefined
  loading: boolean
  refreshing?: boolean
  className?: string
  feeAlign?: 'right' | 'center'
}) {
  if (loading && !quote) {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Carregando resumo de valores">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-6 items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
        <Skeleton className="ml-auto h-3 w-24" />
        <div className="mt-4 flex h-7 items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
    )
  }
  if (!quote) return null
  const hasDiscount = quote.discount !== '0'
  return (
    <div className={cn('flex flex-col', className)} aria-busy={refreshing ? 'true' : undefined}>
      <p role="status" aria-live="polite" className="sr-only">
        {refreshing ? 'Atualizando valores...' : ''}
      </p>
      <dl className="flex flex-col gap-3 text-[15px] text-cream">
        <div className="flex items-center justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="text-lg tabular-nums">
            {formatEth(quote.subtotal)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Desconto do lançamento{quote.coupon ? ` (${quote.coupon.code})` : ''}</dt>
          <dd className={cn('tabular-nums', hasDiscount && 'text-success')}>
            (-) {hasDiscount ? formatEth(quote.discount) : '00.00'}
          </dd>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
          <dt>Taxa de rede</dt>
          <dd className="text-lg tabular-nums">
            {formatEth(quote.networkFee)}
          </dd>
          <dd className={cn('col-span-2 text-xs text-brand', feeAlign === 'right' ? 'text-right' : 'text-center')}>Taxa estimada</dd>
        </div>
      </dl>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-base font-bold text-cream">Total</span>
        <span className="text-lg font-bold text-brand tabular-nums">
          {formatEth(quote.total)}
        </span>
      </div>
      {refreshing && (
        <p className="mt-2 text-right text-xs text-tan" aria-hidden>
          Atualizando valores...
        </p>
      )}
    </div>
  )
}
