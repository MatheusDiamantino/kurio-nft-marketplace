import { useEffect, useRef, type RefObject } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Loader2, X, XCircle } from 'lucide-react'
import type { Order } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { useUser } from '@/auth/use-session'
import { ThankYouIcon } from '@/components/checkout/thank-you-icon'
import { NETWORK_LABEL, shortAddress } from '@/components/checkout/wallet-picker'
import { ErrorState } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { useOrder } from '@/queries/account'
import { pendingOrderStore } from '@/queries/checkout'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

const STATUS_TEXT: Record<Order['status'], string> = {
  pending: 'Pagamento em processamento',
  confirmed: 'Pagamento confirmado',
  declined: 'Pagamento recusado',
}

export function OrderPage() {
  const { orderId } = useParams({ from: '/orders/$orderId' })
  const user = useUser()
  const query = useOrder(orderId)
  const order = query.data
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastStatus = useRef<Order['status'] | null>(null)

  useEffect(() => {
    if (!order || !user) return
    if (order.status !== 'pending') {
      pendingOrderStore.clear(user.id)
      if (order.status === 'confirmed') {
        try {
          sessionStorage.removeItem(`kurio.checkout.draft.${user.id}`)
        } catch {
        }
      }
    }
    if (lastStatus.current && lastStatus.current !== order.status) headingRef.current?.focus()
    lastStatus.current = order.status
  }, [order, user])

  return (
    <div className="container-page flex justify-center py-8 md:py-16">
      <p role="status" aria-live="polite" className="sr-only">
        {order ? STATUS_TEXT[order.status] : ''}
      </p>
      {query.isPending ? (
        <div className="w-full max-w-[578px] bg-surface p-8" aria-busy="true" aria-label="Carregando pedido">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto mt-6 h-5 w-64" />
          <Skeleton className="mt-8 h-16 w-full" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState
          className="w-full max-w-[578px]"
          title={
            isApiError(query.error) && query.error.code === 'FORBIDDEN'
              ? 'Este pedido pertence a outra conta'
              : isApiError(query.error) && query.error.code === 'NOT_FOUND'
                ? 'Pedido não encontrado'
                : 'Não foi possível carregar o pedido'
          }
          message={query.error.message}
          onRetry={isApiError(query.error) && query.error.isTransient ? () => void query.refetch() : undefined}
          retrying={query.isRefetching}
        />
      ) : order?.status === 'confirmed' ? (
        <Receipt order={order} headingRef={headingRef} />
      ) : order?.status === 'declined' ? (
        <Declined order={order} headingRef={headingRef} />
      ) : order ? (
        <Pending order={order} headingRef={headingRef} />
      ) : null}
    </div>
  )
}

type HeadingRef = RefObject<HTMLHeadingElement | null>

function Pending({ order, headingRef }: { order: Order; headingRef: HeadingRef }) {
  return (
    <section
      aria-labelledby="order-title"
      data-testid="order-pending"
      className="flex w-full max-w-[578px] flex-col items-center gap-4 bg-surface px-6 py-10 text-center"
    >
      <Loader2 className="size-12 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
      <h1 id="order-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-cream outline-none">
        Pagamento em processamento
      </h1>
      <p className="max-w-md text-sm text-sand">
        Aguardando a confirmação da transação na rede {NETWORK_LABEL[order.network]} (simulada). Você pode recarregar ou sair desta página:
        o status será recuperado sem criar outra compra.
      </p>
      <dl className="mt-2 grid w-full grid-cols-2 gap-3 border-t border-line pt-4 text-left text-sm">
        <div>
          <dt className="text-tan">Pedido</dt>
          <dd className="truncate text-cream" data-testid="order-id">
            {order.id}
          </dd>
        </div>
        <div>
          <dt className="text-tan">Total</dt>
          <dd className="font-bold text-brand">{formatEth(order.total)}</dd>
        </div>
      </dl>
    </section>
  )
}

function Declined({ order, headingRef }: { order: Order; headingRef: HeadingRef }) {
  return (
    <section
      aria-labelledby="order-title"
      data-testid="order-declined"
      className="flex w-full max-w-[578px] flex-col items-center gap-4 bg-surface px-6 py-10 text-center"
    >
      <XCircle className="size-12 text-danger" aria-hidden />
      <h1 id="order-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-cream outline-none">
        Pagamento recusado
      </h1>
      <p className="max-w-md text-sm text-sand">{order.declineReason ?? 'A transação não foi concluída.'}</p>
      <p className="max-w-md text-sm text-sand">Nenhum valor foi cobrado e os itens continuam no seu carrinho.</p>
      <p className="text-xs text-tan" data-testid="order-id">
        Pedido {order.id}
      </p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/cart" className="rounded-sm border border-brand px-6 py-3 text-center font-bold text-brand-accent hover:bg-surface-dark">
          Voltar ao carrinho
        </Link>
        <Link to="/checkout" className="rounded-sm bg-brand px-6 py-3 text-center font-bold text-ink hover:bg-brand-accent">
          Tentar novamente
        </Link>
      </div>
    </section>
  )
}

function Receipt({ order, headingRef }: { order: Order; headingRef: HeadingRef }) {
  const navigate = useNavigate()
  const tx = order.txHash ?? ''
  const shortTx = tx ? `${tx.slice(0, 6).toUpperCase().replace('0X', '0x')}…${tx.slice(-4).toUpperCase()}` : '—'
  return (
    <section
      aria-labelledby="order-title"
      data-testid="order-confirmed"
      className="relative w-full max-w-[578px] overflow-hidden bg-surface pb-12"
    >
      <button
        type="button"
        onClick={() => void navigate({ to: '/' })}
        className="absolute top-4 right-4 grid size-8 place-items-center text-brand hover:text-brand-accent"
        aria-label="Fechar recibo e voltar ao início"
      >
        <X className="size-5" aria-hidden />
      </button>
      <div className="flex flex-col items-center gap-5 px-6 pt-6 pb-5">
        <ThankYouIcon className="text-brand" />
        <h1 id="order-title" ref={headingRef} tabIndex={-1} className="text-center text-[15px] font-bold text-sand outline-none">
          Seus NFTs agora estão na sua carteira
        </h1>
      </div>

      <dl className="grid grid-cols-2 gap-y-3 border-y border-brand px-6 py-3 text-sm sm:grid-cols-[auto_auto_auto_auto] sm:justify-between sm:px-9 [&_dt]:whitespace-nowrap">
        <div className="sm:border-r sm:border-brand sm:pr-4">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand" data-testid="order-tx">
            <span title={tx}>{shortTx}</span>
          </dd>
        </div>
        <div className="sm:border-r sm:border-brand sm:px-4">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{formatDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:border-r sm:border-brand sm:px-4">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-4">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand" title={order.wallet.address}>
            {order.wallet.label}
          </dd>
        </div>
      </dl>

      <div className="px-6 pt-6 sm:px-11">
        <table className="w-full text-left">
          <caption className="mb-2 text-left text-[15px] font-bold text-cream">Detalhes da transação</caption>
          <thead>
            <tr className="border-b border-line text-[15px] text-cream">
              <th scope="col" className="pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="hidden pb-2 text-center font-bold sm:table-cell">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={`${l.nftId}:${l.editionId}`} data-testid="receipt-line">
                <td className="pt-3">
                  <div className="flex items-center gap-3">
                    <img src={l.image} alt="" width={66} height={66} className="size-12 shrink-0 rounded-sm object-cover sm:size-[66px]" />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-bold text-cream sm:text-[15px]">{l.name}</span>
                      <span className="text-xs whitespace-nowrap text-tan sm:text-sm">ID do token: {l.tokenId}</span>
                      <span className="text-xs text-sand sm:hidden">Edições: x {l.quantity}</span>
                    </div>
                  </div>
                </td>
                <td className="hidden pt-3 text-center text-sm whitespace-nowrap text-sand sm:table-cell">(x {l.quantity})</td>
                <td className="pt-3 text-right text-[15px] font-bold whitespace-nowrap text-brand tabular-nums sm:text-[17px]">{formatEth(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-5 flex flex-col gap-2 border-b border-line pb-3 text-[15px]">
          {order.discount !== '0' && (
            <div className="flex justify-between gap-4 sm:pl-[170px]">
              <dt className="text-cream">Desconto{order.coupon ? ` (${order.coupon.code})` : ''}</dt>
              <dd className="text-success tabular-nums">(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 sm:pl-[170px]">
            <dt className="text-cream">Taxa de rede</dt>
            <dd className="text-lg text-cream tabular-nums">{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:pl-[170px]">
            <dt className="font-bold text-cream">Total</dt>
            <dd className="text-lg font-bold text-brand tabular-nums" data-testid="receipt-total">
              {formatEth(order.total)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-center text-sm leading-[22px] text-sand">
          Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi transferida para sua carteira conectada (
          {shortAddress(order.wallet.address)}) e registrada na rede.
        </p>
        <div className="mt-5 flex justify-center">
          {order.explorerUrl && (
            <a
              href={order.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm bg-brand px-4 py-3 text-base font-bold text-ink hover:bg-brand-accent"
            >
              Ver no Etherscan<span className="sr-only"> (simulado, abre em nova aba)</span>
            </a>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2.5 bg-brand" aria-hidden />
    </section>
  )
}
