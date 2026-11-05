import { useEffect, useState } from 'react'
import { WalletForm } from '@/components/account/wallet-form'
import { ErrorState } from '@/components/shared'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useWallets } from '@/queries/account'

function WalletsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando carteiras" className="grid gap-x-7 gap-y-6 md:grid-cols-2">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export function WalletsPage() {
  const wallets = useWallets()
  const primary = wallets.data?.find((w) => w.slot === 'primary')
  const secondary = wallets.data?.find((w) => w.slot === 'secondary')
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const showSecondary = !!secondary || addingSecondary

  useEffect(() => {
    document.title = 'Carteiras — Kurio'
  }, [])

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Carteiras</h1>

      <section aria-labelledby="primary-title" className="flex flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="primary-title" className="text-lg font-bold text-cream md:pt-1">
              Carteira principal
            </h2>
            <p className="mt-1 text-[13px] text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && wallets.isSuccess && (
            <button
              type="button"
              onClick={() => document.querySelector<HTMLInputElement>('#primary-form input')?.focus()}
              className="text-base font-bold text-brand hover:text-brand-accent"
            >
              Adicionar<span className="sr-only"> carteira principal</span>
            </button>
          )}
        </header>
        {wallets.isPending ? (
          <WalletsSkeleton />
        ) : wallets.isError ? (
          <ErrorState message={wallets.error.message} onRetry={() => void wallets.refetch()} retrying={wallets.isRefetching} />
        ) : (
          <WalletForm slot="primary" wallet={primary} idPrefix="primary" />
        )}
      </section>

      {wallets.isSuccess && (
        <section aria-labelledby="secondary-title" className="flex flex-col gap-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="secondary-title" className="text-lg font-bold text-cream">
                Carteira secundária
              </h2>
              {!showSecondary && <p className="mt-1 text-[13px] text-sand">Você ainda não adicionou uma carteira secundária.</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="same-as-primary"
                  checked={sameAsPrimary}
                  disabled={!primary}
                  onCheckedChange={(checked) => {
                    const on = checked === true
                    setSameAsPrimary(on)
                    if (on) setAddingSecondary(true)
                  }}
                />
                <Label htmlFor="same-as-primary" className="text-sm">
                  Igual à carteira principal
                </Label>
              </div>
              {!showSecondary && (
                <button
                  type="button"
                  onClick={() => setAddingSecondary(true)}
                  aria-controls="secondary-form"
                  aria-expanded={false}
                  className="text-base font-bold text-brand hover:text-brand-accent"
                >
                  Adicionar
                  <span className="sr-only"> carteira secundária</span>
                </button>
              )}
            </div>
          </header>
          {!primary && showSecondary && (
            <p className="text-xs text-sand" role="note">
              Cadastre a carteira principal antes da secundária.
            </p>
          )}
          {showSecondary && (
            <WalletForm slot="secondary" wallet={secondary} copyFrom={sameAsPrimary ? primary : undefined} idPrefix="secondary" />
          )}
        </section>
      )}
    </div>
  )
}
