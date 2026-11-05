import { request } from './client'
import {
  HEADERS,
  type AddCartItemRequest,
  type Cart,
  type CatalogQuery,
  type CatalogResponse,
  type ChangePasswordRequest,
  type CreateOrderRequest,
  type EditionId,
  type FavoritesResponse,
  type LoginRequest,
  type Network,
  type NftDetail,
  type Order,
  type OrderStatus,
  type Quote,
  type RegisterRequest,
  type Session,
  type UpdateProfileRequest,
  type UpsertWalletRequest,
  type User,
  type Wallet,
  type WalletConnection,
  type WalletSlot,
} from './contracts'
import { guestCart, sessionStore } from '@/auth/session-store'

type Opts = { signal?: AbortSignal }

export function catalogSearchParams(q: CatalogQuery) {
  const p = new URLSearchParams()
  if (q.q) p.set('q', q.q)
  for (const c of q.collections ?? []) p.append('collection', c)
  for (const n of q.networks ?? []) p.append('network', n)
  if (q.minPrice) p.set('minPrice', q.minPrice)
  if (q.maxPrice) p.set('maxPrice', q.maxPrice)
  if (q.sort) p.set('sort', q.sort)
  if (q.tab) p.set('tab', q.tab)
  if (q.page) p.set('page', String(q.page))
  if (q.pageSize) p.set('pageSize', String(q.pageSize))
  return p
}

function trackCart(cart: Cart) {
  if (!sessionStore.get() && cart.ownerId === null) guestCart.set(cart.id)
  return cart
}

export const api = {
  auth: {
    login: (body: LoginRequest) => request<Session>({ method: 'POST', url: '/auth/login', data: body }),
    register: (body: RegisterRequest) => request<Session>({ method: 'POST', url: '/auth/register', data: body }),
    session: (o: Opts = {}) => request<Session>({ method: 'GET', url: '/auth/session', signal: o.signal }),
    logout: () => request<void>({ method: 'POST', url: '/auth/logout' }),
  },

  nfts: {
    list: (query: CatalogQuery, o: Opts = {}) =>
      request<CatalogResponse>({ method: 'GET', url: '/nfts', params: catalogSearchParams(query), signal: o.signal }),
    get: (id: string, o: Opts = {}) => request<NftDetail>({ method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal: o.signal }),
  },

  favorites: {
    list: (o: Opts = {}) => request<FavoritesResponse>({ method: 'GET', url: '/favorites', signal: o.signal }),
    add: (nftId: string) => request<{ nftIds: string[] }>({ method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }),
    remove: (nftId: string) => request<{ nftIds: string[] }>({ method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }),
  },

  cart: {
    get: async (o: Opts = {}) => trackCart(await request<Cart>({ method: 'GET', url: '/cart', signal: o.signal })),
    add: async (body: AddCartItemRequest) => trackCart(await request<Cart>({ method: 'POST', url: '/cart/items', data: body })),
    update: async (nftId: string, editionId: EditionId, quantity: number) =>
      trackCart(await request<Cart>({ method: 'PATCH', url: `/cart/items/${encodeURIComponent(nftId)}/${editionId}`, data: { quantity } })),
    remove: async (nftId: string, editionId: EditionId) =>
      trackCart(await request<Cart>({ method: 'DELETE', url: `/cart/items/${encodeURIComponent(nftId)}/${editionId}` })),
    applyCoupon: async (code: string) => trackCart(await request<Cart>({ method: 'POST', url: '/cart/coupon', data: { code } })),
    removeCoupon: async () => trackCart(await request<Cart>({ method: 'DELETE', url: '/cart/coupon' })),
  },

  quote: {
    create: (network: Network, o: Opts = {}) => request<Quote>({ method: 'POST', url: '/quote', data: { network }, signal: o.signal }),
  },

  orders: {
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      request<Order>({
        method: 'POST',
        url: '/orders',
        data: body,
        headers: { [HEADERS.idempotencyKey]: idempotencyKey },
        timeout: 10_000,
      }),
    get: (id: string, o: Opts = {}) => request<Order>({ method: 'GET', url: `/orders/${encodeURIComponent(id)}`, signal: o.signal }),
    list: (status?: OrderStatus, o: Opts = {}) =>
      request<{ items: Order[] }>({ method: 'GET', url: '/orders', params: status ? { status } : undefined, signal: o.signal }),
  },

  profile: {
    get: (o: Opts = {}) => request<User>({ method: 'GET', url: '/me/profile', signal: o.signal }),
    update: (body: UpdateProfileRequest) => request<User>({ method: 'PATCH', url: '/me/profile', data: body }),
    setAvatar: (dataUrl: string) => request<User>({ method: 'PUT', url: '/me/avatar', data: { dataUrl } }),
    removeAvatar: () => request<User>({ method: 'DELETE', url: '/me/avatar' }),
    changePassword: (body: ChangePasswordRequest) => request<void>({ method: 'POST', url: '/me/password', data: body }),
  },

  wallets: {
    list: (o: Opts = {}) => request<{ items: Wallet[] }>({ method: 'GET', url: '/me/wallets', signal: o.signal }),
    upsert: (slot: WalletSlot, body: UpsertWalletRequest) => request<Wallet>({ method: 'PUT', url: `/me/wallets/${slot}`, data: body }),
    connect: (walletId: string, network: Network) =>
      request<WalletConnection>({ method: 'POST', url: `/me/wallets/${encodeURIComponent(walletId)}/connect`, data: { network } }),
    disconnect: (connectionId: string) =>
      request<void>({ method: 'DELETE', url: `/me/wallet-connections/${encodeURIComponent(connectionId)}` }),
  },
}
