import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  Cart,
  CatalogResponse,
  FavoritesResponse,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  RealtimeEvent,
} from '@/api/contracts'
import { compare, formatEth } from '@/lib/eth'
import { keys } from '@/queries/keys'
import { noticeStore } from './notices'

/**
 * Applies a Socket.IO event to the TanStack Query cache.
 *
 * Guarantees:
 * - idempotent: an event id is applied at most once (duplicates ignored);
 * - monotonic: an event whose version is ≤ the newest known version of the
 *   resource is ignored, so an old event never regresses newer state;
 * - user isolation: order events for anyone but the current user are dropped.
 */
export class EventApplier {
  private seen = new Set<string>()
  private seenOrder: string[] = []
  private versions = new Map<string, number>()

  private readonly qc: QueryClient
  private readonly currentUserId: () => string | null

  constructor(qc: QueryClient, currentUserId: () => string | null) {
    this.qc = qc
    this.currentUserId = currentUserId
  }

  /** Returns true when the event changed client state. */
  apply(event: RealtimeEvent): boolean {
    if (!event || typeof event.id !== 'string' || !event.resource) return false
    if (this.seen.has(event.id)) return false
    this.remember(event.id)

    const resourceKey = `${event.resource.type}:${event.resource.id}`
    const known = Math.max(this.versions.get(resourceKey) ?? 0, this.cachedVersion(event))
    if (event.version <= known) return false
    this.versions.set(resourceKey, event.version)

    if (event.type === 'nft.updated') return this.applyNft(event)
    if (event.type === 'order.updated') return this.applyOrder(event)
    return false
  }

  reset() {
    this.seen.clear()
    this.seenOrder = []
    this.versions.clear()
  }

  private remember(id: string) {
    this.seen.add(id)
    this.seenOrder.push(id)
    if (this.seenOrder.length > 500) this.seen.delete(this.seenOrder.shift()!)
  }

  private cachedVersion(event: RealtimeEvent): number {
    if (event.type === 'nft.updated') {
      return this.qc.getQueryData<NftDetail>(keys.catalog.detail(event.resource.id))?.version ?? 0
    }
    const uid = this.currentUserId()
    if (!uid) return 0
    return this.qc.getQueryData<Order>(keys.private.order(uid, event.resource.id))?.version ?? 0
  }

  private applyNft(event: NftUpdatedEvent) {
    const id = event.resource.id
    const { data, version } = event
    const patchSummary = <T extends NftSummary>(n: T): T =>
      n.id === id && n.version < version
        ? { ...n, price: data.price, compareAtPrice: data.compareAtPrice, totalAvailable: data.totalAvailable, version }
        : n

    // Detail
    this.qc.setQueryData<NftDetail>(keys.catalog.detail(id), (old) => {
      if (!old || old.version >= version) return old
      return {
        ...patchSummary(old),
        editions: old.editions.map((e) => {
          const next = data.editions.find((x) => x.id === e.id)
          return next ? { ...e, available: next.available } : e
        }),
      }
    })

    // Catalog pages
    this.qc.setQueriesData<CatalogResponse>({ queryKey: keys.catalog.lists() }, (old) => {
      if (!old) return old
      const hit = old.items.find((i) => i.id === id)
      if (!hit) return old
      return { ...old, items: old.items.map(patchSummary) }
    })

    // Favorites lists
    this.qc.setQueriesData<FavoritesResponse>({ queryKey: keys.private.all }, (old) => {
      if (!old || !Array.isArray((old as FavoritesResponse).items)) return old
      return { ...old, items: old.items.map(patchSummary) }
    })

    // Cart: if the NFT is in any cached cart, inform and refetch cart + quote
    // from the API (the server is the authority for totals).
    const carts = this.qc.getQueriesData<Cart>({ queryKey: keys.cart.all })
    for (const [key, cart] of carts) {
      const lines = cart?.lines.filter((l) => l.nftId === id) ?? []
      if (lines.length === 0) continue
      const line = lines[0]
      const before = line.unitPrice
      if (compare(before, data.price) !== 0) {
        const message = `O preço de ${line.name} mudou de ${formatEth(before)} para ${formatEth(data.price)}.`
        noticeStore.push({ id: event.id, nftId: id, kind: 'price', message, at: Date.now() })
        toast.info('Preço atualizado no seu carrinho', { description: message })
      }
      for (const l of lines) {
        const avail = data.editions.find((e) => e.id === l.editionId)?.available ?? l.available
        if (avail < l.quantity) {
          const message =
            avail === 0
              ? `A edição ${l.editionLabel} de ${l.name} esgotou.`
              : `Restam apenas ${avail} unidade(s) de ${l.name} (${l.editionLabel}); você tem ${l.quantity} no carrinho.`
          noticeStore.push({ id: `${event.id}:${l.editionId}`, nftId: id, kind: 'availability', message, at: Date.now() })
          toast.warning('Disponibilidade alterada', { description: message })
        }
      }
      void this.qc.invalidateQueries({ queryKey: key })
      void this.qc.invalidateQueries({ queryKey: keys.quote.all })
    }
    return true
  }

  private applyOrder(event: OrderUpdatedEvent) {
    const uid = this.currentUserId()
    if (!uid || event.data.userId !== uid) return false
    const key = keys.private.order(uid, event.resource.id)
    const before = this.qc.getQueryData<Order>(key)
    if (before && before.status !== 'pending') return false // terminal states never change
    if (before) {
      this.qc.setQueryData<Order>(key, {
        ...before,
        status: event.data.status,
        txHash: event.data.txHash,
        explorerUrl: event.data.explorerUrl,
        declineReason: event.data.declineReason,
        version: event.version,
      })
    }
    void this.qc.invalidateQueries({ queryKey: key })
    if (event.data.status !== 'pending') {
      // Cart lost the purchased items (confirmed) or keeps them (declined) — resync.
      void this.qc.invalidateQueries({ queryKey: keys.cart.all })
      void this.qc.invalidateQueries({ queryKey: keys.quote.all })
      void this.qc.invalidateQueries({ queryKey: keys.catalog.all })
      if (event.data.status === 'confirmed') toast.success('Pagamento confirmado na rede.')
      else toast.error('Pagamento recusado.', { description: event.data.declineReason ?? undefined })
    }
    return true
  }
}
