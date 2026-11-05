import { Link } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Plug, Unplug } from 'lucide-react'
import type { Network, Wallet, WalletConnection } from '@/api/contracts'
import { WalletChip } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const WALLET_LABEL: Record<Wallet['kind'], string> = {
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
  walletconnect: 'WalletConnect',
}

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function walletLabel(w: Wallet) {
  return `${WALLET_LABEL[w.kind]} — ${w.nickname} — ${shortAddress(w.address)}`
}

export function WalletPicker({
  wallets,
  selectedId,
  onSelect,
  network,
  connection,
  connecting,
  connectError,
  onConnect,
  onDisconnect,
}: {
  wallets: Wallet[]
  selectedId: string | null
  onSelect: (id: string) => void
  network: Network
  connection: WalletConnection | null
  connecting: boolean
  connectError: string | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (wallets.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-sm border border-line-soft p-4 text-sm text-sand">
        <p>Você ainda não cadastrou uma carteira. Cadastre uma carteira para concluir a compra.</p>
        <Link to="/account/wallets" className="self-start font-bold text-brand-accent underline underline-offset-2">
          Cadastrar carteira
        </Link>
      </div>
    )
  }
  const connected = connection && connection.walletId === selectedId && connection.network === network
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Carteira para pagamento</legend>
        <div className="flex h-[45px] items-center gap-3 rounded-sm border border-line px-4" aria-hidden>
          <span className="size-4 rounded-full border border-brand" />
          <WalletChip />
        </div>
        {wallets.map((w) => {
          const checked = w.id === selectedId
          return (
            <label
              key={w.id}
              className={cn(
                'flex min-h-[45px] cursor-pointer items-center gap-3 rounded-sm border px-4 py-2 text-[15px] text-cream',
                checked ? 'border-cream' : 'border-line',
              )}
            >
              <input
                type="radio"
                name="checkout-wallet"
                value={w.id}
                checked={checked}
                onChange={() => onSelect(w.id)}
                className="size-4 shrink-0 accent-[var(--kurio-primary)]"
              />
              <span className="flex min-w-0 flex-col">
                <span>
                  {WALLET_LABEL[w.kind]} <span className="text-sand">· {w.slot === 'primary' ? 'principal' : 'secundária'}</span>
                </span>
                <span className="truncate text-xs text-tan">
                  {w.nickname} — {shortAddress(w.address)}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface px-3 py-2" aria-live="polite">
        {connected ? (
          <>
            <p className="flex items-center gap-2 text-sm text-success" data-testid="wallet-status">
              <CheckCircle2 className="size-4" aria-hidden />
              Conectada em {NETWORK_LABEL[network]}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onDisconnect}>
              <Unplug aria-hidden />
              Desconectar
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-sand" data-testid="wallet-status">
              Carteira não conectada
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onConnect} disabled={!selectedId || connecting}>
              <Plug aria-hidden />
              {connecting ? 'Conectando…' : 'Conectar carteira'}
            </Button>
          </>
        )}
      </div>
      {connectError && (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {connectError}
        </p>
      )}
    </div>
  )
}
