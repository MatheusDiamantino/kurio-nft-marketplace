import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { AlertTriangle, ChevronLeft, Loader2 } from 'lucide-react'
import type { CreateOrderRequest, Network, Quote, Wallet, WalletConnection } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { useUser } from '@/auth/use-session'
import { QuoteSummary } from '@/components/cart/quote-summary'
import { CollectorForm, collectorSchema, type CollectorValues } from '@/components/checkout/collector-form'
import { QuoteChangedAlert } from '@/components/checkout/quote-diff'
import { NETWORK_LABEL, WalletPicker, walletLabel } from '@/components/checkout/wallet-picker'
import { Breadcrumb, EmptyState, ErrorState } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { applyServerErrors } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { useProfile, useWallets } from '@/queries/account'
import { useCart, useQuote } from '@/queries/cart'
import { usePendingOrder, usePlaceOrder } from '@/queries/checkout'
import { keys } from '@/queries/keys'

const draftKey = (uid: string) => `kurio.checkout.draft.${uid}`

const EMPTY: CollectorValues = {
  displayName: '',
  username: '',
  network: 'ethereum',
  profileName: '',
  referralCode: '',
  email: '',
  ensSuffix: '.eth',
  ensName: '',
  note: '',
}

function readDraft(uid: string): (Partial<CollectorValues> & { walletId?: string }) | null {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(uid)) ?? 'null')
  } catch {
    return null
  }
}

/** API field names → form field names. */
const FIELD_MAP = {
  'collector.displayName': 'displayName',
  'collector.username': 'username',
  'collector.email': 'email',
  'collector.profileName': 'profileName',
  'collector.referralCode': 'referralCode',
  'collector.ensName': 'ensName',
  'collector.note': 'note',
  network: 'network',
} as const

export function CheckoutPage() {
  const user = useUser()
  const uid = user?.id ?? 'anonymous'
  const qc = useQueryClient()
  const profile = useProfile()
  const walletsQuery = useWallets()
  const wallets = useMemo(() => walletsQuery.data ?? [], [walletsQuery.data])
  const cart = useCart()
  const pending = usePendingOrder()
  const place = usePlaceOrder()

  const draft = useMemo(() => readDraft(uid), [uid])
  const form = useForm<CollectorValues>({
    resolver: zodResolver(collectorSchema),
    defaultValues: { ...EMPTY, ...draft },
    mode: 'onTouched',
  })
  const network = form.watch('network') as Network

  const [walletId, setWalletId] = useState<string | null>(draft?.walletId ?? null)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [reviewed, setReviewed] = useState<Quote | null>(null)
  const [conflict, setConflict] = useState<Quote | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)

  const quote = useQuote(network, { enabled: (cart.data?.lines.length ?? 0) > 0 })
  const selectedWallet: Wallet | null = wallets.find((w) => w.id === walletId) ?? null
  const secondary = wallets.find((w) => w.slot === 'secondary') ?? null
  const primary = wallets.find((w) => w.slot === 'primary') ?? null

  // Prefill once profile + wallets arrive (only fields the draft didn't set).
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !profile.data || !walletsQuery.data) return
    prefilled.current = true
    const w = wallets.find((x) => x.id === draft?.walletId) ?? wallets.find((x) => x.slot === 'primary') ?? wallets[0]
    if (w && !walletId) setWalletId(w.id)
    const base: CollectorValues = {
      ...EMPTY,
      displayName: w?.displayName || profile.data.displayName,
      username: profile.data.username,
      network: w?.network ?? 'ethereum',
      profileName: w?.profileName || profile.data.username,
      referralCode: w?.referralCode ?? '',
      email: w?.email || profile.data.email,
      ensName: w?.ensName || profile.data.ensName,
    }
    form.reset({ ...base, ...Object.fromEntries(Object.entries(draft ?? {}).filter(([, v]) => v !== '' && v !== undefined)) })
  }, [profile.data, walletsQuery.data, wallets, draft, form, walletId])

  // Persist the draft so a session expiry → login → redirect resumes here.
  useEffect(() => {
    const sub = form.watch((values) => {
      try {
        sessionStorage.setItem(draftKey(uid), JSON.stringify({ ...values, walletId }))
      } catch {
        /* ignore */
      }
    })
    return () => sub.unsubscribe()
  }, [form, uid, walletId])

  // Changing wallet or network invalidates the connection.
  useEffect(() => {
    if (connection && (connection.walletId !== walletId || connection.network !== network)) {
      void api.wallets.disconnect(connection.connectionId).catch(() => undefined)
      setConnection(null)
    }
  }, [walletId, network, connection])

  const connect = useMutation({
    mutationFn: () => api.wallets.connect(walletId!, network),
    onMutate: () => setConnectError(null),
    onSuccess: (c) => setConnection(c),
    onError: (e) =>
      setConnectError(
        isApiError(e) && e.code === 'WALLET_REJECTED'
          ? 'Conexão recusada na carteira. Aprove a solicitação e tente novamente.'
          : `Não foi possível conectar: ${e.message}`,
      ),
  })
  const disconnect = () => {
    if (connection) void api.wallets.disconnect(connection.connectionId).catch(() => undefined)
    setConnection(null)
  }

  // Live quote changed after review → must re-accept.
  const live = quote.data
  const newer = conflict ?? (step === 'review' && reviewed && live && live.fingerprint !== reviewed.fingerprint ? live : null)
  const reviewedHasIssues = (reviewed?.issues.length ?? 0) > 0

  const toReview = form.handleSubmit(
    () => {
      setFormError(null)
      if (!live) return
      if (live.issues.length > 0) {
        setFormError('Alguns itens não estão mais disponíveis. Ajuste o carrinho para continuar.')
        return
      }
      if (!selectedWallet) {
        setFormError('Selecione uma carteira cadastrada para continuar.')
        return
      }
      setReviewed(live)
      setConflict(null)
      setStep('review')
      requestAnimationFrame(() => reviewHeading.current?.focus())
    },
    () => setFormError('Revise os campos destacados.'),
  )

  const confirm = () => {
    if (!reviewed || !selectedWallet || !connection || newer) return
    const v = form.getValues()
    const body: CreateOrderRequest = {
      quoteId: reviewed.id,
      quoteFingerprint: reviewed.fingerprint,
      walletId: selectedWallet.id,
      connectionId: connection.connectionId,
      network,
      collector: {
        displayName: v.displayName,
        username: v.username,
        profileName: v.profileName,
        email: v.email,
        ensName: `${v.ensName}${v.ensSuffix}`,
        referralCode: v.referralCode,
        note: v.note,
      },
    }
    place.submit(body)
  }

  // React to order errors.
  const err = place.error
  useEffect(() => {
    if (!err) return
    if ((err.code === 'QUOTE_STALE' || err.code === 'OUT_OF_STOCK') && err.details && typeof err.details === 'object') {
      const fresh = (err.details as { quote?: Quote }).quote
      if (fresh) setConflict(fresh)
      void qc.invalidateQueries({ queryKey: keys.cart.all })
      void qc.invalidateQueries({ queryKey: keys.quote.all })
    } else if (err.code === 'WALLET_DISCONNECTED') {
      setConnection(null)
    } else if (err.code === 'VALIDATION_ERROR' && Object.keys(err.fields).length > 0) {
      setStep('form')
      applyServerErrors(form, err, FIELD_MAP)
    }
  }, [err, qc, form])

  const acceptNew = () => {
    if (!newer) return
    setReviewed(newer)
    setConflict(null)
    place.reset()
  }

  const busy = place.isPending
  const canConfirm = step === 'review' && !!reviewed && !reviewedHasIssues && !newer && !!connection && !busy && !pending.order

  if (cart.isPending || profile.isPending || walletsQuery.isPending) {
    return (
      <div className="container-page py-8" aria-busy="true" aria-label="Carregando pagamento">
        <Skeleton className="h-5 w-64" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_405px]">
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-[66px]" />
            ))}
          </div>
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    )
  }
  if (cart.isError || profile.isError || walletsQuery.isError) {
    return (
      <div className="container-page py-8">
        <ErrorState
          message="Não foi possível carregar os dados do pagamento."
          onRetry={() => {
            void cart.refetch()
            void profile.refetch()
            void walletsQuery.refetch()
          }}
        />
      </div>
    )
  }
  if ((cart.data?.lines.length ?? 0) === 0 && !busy) {
    return (
      <div className="container-page py-8">
        <EmptyState
          title="Seu carrinho está vazio"
          message="Adicione NFTs ao carrinho para finalizar uma compra."
          action={
            <Link to="/" hash="catalogo" className="rounded-sm bg-brand px-6 py-3 font-bold text-ink hover:bg-brand-accent">
              Explorar NFTs
            </Link>
          }
        />
      </div>
    )
  }

  const summaryQuote = step === 'review' ? (reviewed ?? undefined) : live

  return (
    <div className="container-page pt-4 md:pt-8">
      <div className="relative mb-4 flex h-11 items-center justify-center md:hidden">
        <Link
          to="/cart"
          className="absolute left-0 grid size-[35px] place-items-center rounded-full border border-line-soft text-cream"
          aria-label="Voltar ao carrinho"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <span className="text-base font-bold text-cream" aria-hidden>
          Pagamento
        </span>
      </div>
      <div className="hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]} />
      </div>
      <h1 className="sr-only">Pagamento</h1>

      {pending.order && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-brand bg-surface-dark/60 px-4 py-3 text-sm text-cream">
          <p>
            <strong className="text-brand">Você tem um pedido em processamento.</strong> Aguarde a confirmação antes de iniciar outra compra.
          </p>
          <Link
            to="/orders/$orderId"
            params={{ orderId: pending.order.id }}
            className="font-bold text-brand-accent underline underline-offset-2"
          >
            Acompanhar pedido
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[763px_405px] xl:gap-8">
        <section aria-label="Dados do pedido" className="min-w-0">
          {step === 'form' ? (
            <form id="checkout-form" onSubmit={toReview} noValidate>
              <CollectorForm
                form={form}
                wallet={selectedWallet}
                hasSecondary={!!secondary}
                useSecondary={selectedWallet?.slot === 'secondary'}
                onToggleSecondary={(on) => setWalletId(on ? (secondary?.id ?? null) : (primary?.id ?? wallets[0]?.id ?? null))}
                disabled={busy}
              />
            </form>
          ) : (
            reviewed && (
              <div className="flex flex-col gap-5">
                <h2 ref={reviewHeading} tabIndex={-1} className="text-lg font-bold text-cream outline-none">
                  Revisão do pedido
                </h2>
                {newer && reviewed && <QuoteChangedAlert before={reviewed} after={newer} onAccept={acceptNew} />}
                <dl className="grid gap-x-6 gap-y-3 rounded-sm bg-surface p-5 text-sm md:grid-cols-2">
                  {(
                    [
                      ['Nome de exibição', form.getValues('displayName')],
                      ['Nome de usuário', form.getValues('username')],
                      ['E-mail', form.getValues('email')],
                      ['Nome ENS', `${form.getValues('ensName')}${form.getValues('ensSuffix')}`],
                      ['Rede', NETWORK_LABEL[network]],
                      ['Carteira', selectedWallet ? walletLabel(selectedWallet) : '—'],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-tan">{k}</dt>
                      <dd className="truncate text-cream">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-sand">
                  Os valores abaixo são a cotação revisada em {new Date(reviewed.createdAt).toLocaleTimeString('pt-BR')}. Eles são
                  revalidados pelo servidor ao confirmar.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('form')
                    place.reset()
                  }}
                  disabled={busy}
                  className="self-start text-sm font-bold text-brand-accent underline underline-offset-2 disabled:opacity-50"
                >
                  Editar dados
                </button>
              </div>
            )
          )}
        </section>

        <aside aria-labelledby="checkout-nfts" className="flex flex-col gap-5">
          <div>
            <h2 id="checkout-nfts" className="text-lg font-bold text-cream">
              Seus NFTs
            </h2>
            <div className="mt-3 flex justify-between border-b border-line pb-2 text-[15px] font-bold text-cream" aria-hidden>
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>
            {!summaryQuote ? (
              <div className="mt-3 flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[70px]" />
                ))}
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-3" aria-label="Itens do pedido">
                {summaryQuote.lines.map((l) => (
                  <li key={`${l.nftId}:${l.editionId}`} className="flex items-center gap-3 bg-surface p-1 pr-4">
                    <img src={l.image} alt="" width={62} height={62} className="size-[62px] shrink-0 rounded-sm object-cover" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold text-cream">{l.name}</span>
                      <span className="text-sm text-tan">ID do token: {l.tokenId}</span>
                    </div>
                    <span className="text-sm text-sand">(x {l.quantity})</span>
                    <span className="text-[15px] font-bold text-brand tabular-nums">{formatEth(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-center text-[15px] text-cream">
              Tem um código promocional?{' '}
              <Link to="/cart" className="text-brand-accent hover:underline">
                Aplique aqui
              </Link>
            </p>
          </div>

          {quote.isError && step === 'form' ? (
            <ErrorState message={quote.error.message} onRetry={() => void quote.refetch()} retrying={quote.isRefetching} />
          ) : (
            <QuoteSummary
              quote={summaryQuote}
              loading={!summaryQuote}
              refreshing={step === 'form' && quote.isFetching && !!quote.data}
              feeAlign="center"
            />
          )}

          <div>
            <h2 className="mb-3 text-center text-base font-bold text-cream">Carteira e rede</h2>
            <WalletPicker
              wallets={wallets}
              selectedId={walletId}
              onSelect={setWalletId}
              network={network}
              connection={connection}
              connecting={connect.isPending}
              connectError={connectError}
              onConnect={() => connect.mutate()}
              onDisconnect={disconnect}
            />
          </div>

          <OrderFeedback phase={place.phase} error={place.error} onRetry={confirm} />
          {formError && (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {formError}
            </p>
          )}

          {step === 'form' ? (
            <button
              type="submit"
              form="checkout-form"
              disabled={busy || !!pending.order}
              className="h-[45px] w-full rounded-sm bg-brand text-base font-bold text-ink hover:bg-brand-accent disabled:opacity-50"
            >
              Revisar pedido
            </button>
          ) : (
            <>
              {!connection && step === 'review' && (
                <p id="confirm-hint" className="text-center text-xs text-sand">
                  Conecte a carteira para confirmar a compra.
                </p>
              )}
              <button
                type="button"
                onClick={confirm}
                disabled={!canConfirm}
                aria-describedby={!connection ? 'confirm-hint' : undefined}
                className={cn(
                  'flex h-[45px] w-full items-center justify-center gap-2 rounded-sm bg-brand text-base font-bold text-ink hover:bg-brand-accent disabled:opacity-50',
                )}
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {busy ? 'Confirmando…' : 'Confirmar compra'}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function OrderFeedback({
  phase,
  error,
  onRetry,
}: {
  phase: ReturnType<typeof usePlaceOrder>['phase']
  error: ReturnType<typeof usePlaceOrder>['error']
  onRetry: () => void
}) {
  let content: ReactNode = null
  if (phase === 'recovering') {
    content = <p className="text-sm text-sand">Não recebemos a confirmação, recuperando seu pedido…</p>
  } else if (phase === 'failed' && error) {
    content = (
      <div className="flex flex-col gap-2 rounded-sm border border-danger p-3 text-sm text-cream">
        <p>Não foi possível confirmar se o pedido foi criado ({error.message}). Tentar novamente não gera uma compra duplicada.</p>
        <button type="button" onClick={onRetry} className="self-start font-bold text-brand-accent underline underline-offset-2">
          Tentar novamente
        </button>
      </div>
    )
  } else if (error && !['QUOTE_STALE', 'OUT_OF_STOCK', 'VALIDATION_ERROR', 'SESSION_EXPIRED', 'UNAUTHENTICATED'].includes(error.code)) {
    content = (
      <p className="text-sm text-danger">
        {error.code === 'WALLET_DISCONNECTED' ? 'A carteira foi desconectada. Conecte novamente para assinar a compra.' : error.message}
      </p>
    )
  }
  return (
    <div role="status" aria-live="polite" data-testid="order-feedback">
      {content}
    </div>
  )
}
