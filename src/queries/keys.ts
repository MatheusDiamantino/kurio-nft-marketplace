import type { CatalogQuery, Network } from '@/api/contracts'

/**
 * Query-key factory. Private data is namespaced under ['private', userId] so
 * (a) caches of different users can never collide and (b) logout/switch can
 * drop everything private with a single `removeQueries({ queryKey: ['private'] })`.
 * The cart is keyed by owner ('guest' or the user id) for the same reason.
 */
export const keys = {
  catalog: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (q: CatalogQuery) => ['nfts', 'list', q] as const,
    details: () => ['nfts', 'detail'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  cart: {
    all: ['cart'] as const,
    of: (owner: string) => ['cart', owner] as const,
  },
  quote: {
    all: ['quote'] as const,
    of: (owner: string, network: Network, cartVersion: number) => ['quote', owner, network, cartVersion] as const,
  },
  private: {
    all: ['private'] as const,
    user: (userId: string) => ['private', userId] as const,
    favorites: (userId: string) => ['private', userId, 'favorites'] as const,
    profile: (userId: string) => ['private', userId, 'profile'] as const,
    wallets: (userId: string) => ['private', userId, 'wallets'] as const,
    orders: (userId: string) => ['private', userId, 'orders'] as const,
    order: (userId: string, orderId: string) => ['private', userId, 'orders', orderId] as const,
  },
}
