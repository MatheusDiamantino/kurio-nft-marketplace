import type {
  AppliedCoupon,
  Cart,
  CartLine,
  CatalogQuery,
  CatalogResponse,
  CollectionSlug,
  CollectorDetails,
  EditionId,
  Network,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderStatus,
  OrderUpdatedEvent,
  Quote,
  QuoteIssue,
  QuoteLine,
  RealtimeEvent,
  User,
  Wallet,
  WalletSlot,
} from '@/api/contracts'
import { COLLECTIONS, NETWORKS } from '@/api/contracts'
import { add, compare, eth, mul, percentOf, sub, toEthString } from '@/lib/eth'
import {
  buildCatalog,
  COLLECTION_LABELS,
  COUPONS,
  EDITION_ORDER,
  NETWORK_FEES,
  NETWORK_LABELS,
  SEED_FAVORITES,
  SEED_USERS,
  seedWallets,
  type SeedUser,
} from './fixtures'

/**
 * In-browser "server" state for the MSW handlers. All REST responses and all
 * Socket.IO events are derived from this single store, so catalog, cart,
 * favorites, profile, wallets and orders stay consistent with each other.
 * It is persisted to localStorage to survive refreshes; `resetDb()` restores
 * the deterministic seed.
 */

const STORAGE_KEY = 'kurio.mockdb.v1'
const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const QUOTE_TTL_MS = 10 * 60 * 1000

interface UserRecord extends SeedUser {}

interface SessionRecord {
  token: string
  userId: string
  expiresAt: string
  revoked: boolean
}

interface CartRecord {
  id: string
  ownerId: string | null
  lines: { nftId: string; editionId: EditionId; quantity: number }[]
  couponCode: string | null
  version: number
  updatedAt: string
}

interface OrderRecord extends Order {
  cartId: string
  /** When the simulated chain resolves the payment (ms epoch) or null = manual. */
  resolveAt: number | null
  outcome: Exclude<OrderStatus, 'pending'> | null
  released: boolean
}

interface IdempotencyRecord {
  userId: string
  fingerprint: string
  orderId: string
}

interface ConnectionRecord {
  connectionId: string
  walletId: string
  userId: string
  network: Network
  connectedAt: string
  active: boolean
}

export interface DbState {
  schema: 1
  nfts: NftDetail[]
  users: UserRecord[]
  sessions: SessionRecord[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  userCarts: Record<string, string>
  quotes: Record<string, Quote>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, IdempotencyRecord>
  wallets: Record<string, Wallet[]>
  connections: Record<string, ConnectionRecord>
  eventSeq: number
  idSeq: number
}

function seed(): DbState {
  return {
    schema: 1,
    nfts: buildCatalog(),
    users: SEED_USERS.map((u) => ({ ...u })),
    sessions: [],
    favorites: structuredClone(SEED_FAVORITES),
    carts: {},
    userCarts: {},
    quotes: {},
    orders: {},
    idempotency: {},
    wallets: seedWallets(),
    connections: {},
    eventSeq: 0,
    idSeq: 0,
  }
}

let state: DbState = seed()

export function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === 1) state = parsed
    }
  } catch {
    state = seed()
  }
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded or storage disabled: keep in memory */
  }
}

export function resetDb() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  state = seed()
  saveDb()
}

export function getState(): Readonly<DbState> {
  return state
}

function nextId(prefix: string) {
  state.idSeq += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${state.idSeq.toString(36)}${rand}`
}

const now = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Event bus (consumed by the Socket.IO mock in realtime.ts)
// ---------------------------------------------------------------------------

type Listener = (event: RealtimeEvent) => void
const listeners = new Set<Listener>()
const recentEvents: RealtimeEvent[] = []

export function onEvent(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRecentEvents() {
  return recentEvents
}

function publish(event: RealtimeEvent) {
  recentEvents.push(event)
  if (recentEvents.length > 50) recentEvents.shift()
  for (const l of listeners) l(event)
}

function nextEventId() {
  state.eventSeq += 1
  return `evt_${String(state.eventSeq).padStart(6, '0')}`
}

function publishNft(nft: NftDetail) {
  const event: NftUpdatedEvent = {
    id: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: now(),
    data: {
      price: nft.price,
      compareAtPrice: nft.compareAtPrice,
      editions: nft.editions.map((e) => ({ id: e.id, available: e.available })),
      totalAvailable: nft.totalAvailable,
    },
  }
  publish(event)
}

function publishOrder(order: OrderRecord) {
  const event: OrderUpdatedEvent = {
    id: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: now(),
    data: {
      userId: order.userId,
      status: order.status,
      txHash: order.txHash,
      explorerUrl: order.explorerUrl,
      declineReason: order.declineReason,
    },
  }
  publish(event)
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export function toSummary(n: NftDetail): NftSummary {
  return {
    id: n.id,
    name: n.name,
    tokenId: n.tokenId,
    image: n.image,
    imageAlt: n.imageAlt,
    price: n.price,
    compareAtPrice: n.compareAtPrice,
    collection: n.collection,
    network: n.network,
    rarity: n.rarity,
    listedAt: n.listedAt,
    totalAvailable: n.totalAvailable,
    version: n.version,
  }
}

export function findNft(id: string) {
  return state.nfts.find((n) => n.id === id)
}

export function listCatalog(query: Required<Pick<CatalogQuery, 'sort' | 'tab' | 'page' | 'pageSize'>> & CatalogQuery): CatalogResponse {
  const q = query.q?.trim().toLowerCase()
  const collections = query.collections ?? []
  const networks = query.networks ?? []
  const min = query.minPrice
  const max = query.maxPrice

  const matchesText = (n: NftDetail) =>
    !q || n.name.toLowerCase().includes(q) || n.tokenId.toLowerCase().includes(q) || COLLECTION_LABELS[n.collection].toLowerCase().includes(q)
  const matchesPrice = (n: NftDetail) => (!min || compare(n.price, min) >= 0) && (!max || compare(n.price, max) <= 0)
  const matchesTab = (n: NftDetail, index: number) =>
    query.tab === 'all' ? true : query.tab === 'new' ? index < 18 : n.rarity !== 'comum' || n.compareAtPrice !== null

  // Facet counts respect every other active filter (standard faceted search).
  const base = state.nfts.filter((n, i) => matchesText(n) && matchesPrice(n) && matchesTab(n, i))
  const byNetwork = (n: NftDetail) => networks.length === 0 || networks.includes(n.network)
  const byCollection = (n: NftDetail) => collections.length === 0 || collections.includes(n.collection)

  const filtered = base.filter((n) => byNetwork(n) && byCollection(n))

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case 'price-asc':
        return compare(a.price, b.price) || a.name.localeCompare(b.name)
      case 'price-desc':
        return compare(b.price, a.price) || a.name.localeCompare(b.name)
      case 'name':
        return a.name.localeCompare(b.name)
      case 'recent':
      default:
        return b.listedAt.localeCompare(a.listedAt)
    }
  })

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const page = Math.min(Math.max(1, query.page), totalPages)
  const items = sorted.slice((page - 1) * query.pageSize, page * query.pageSize).map(toSummary)

  const prices = state.nfts.map((n) => n.price).sort(compare)
  return {
    items,
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
    facets: {
      collections: COLLECTIONS.map((c) => ({
        value: c as CollectionSlug,
        label: COLLECTION_LABELS[c],
        count: base.filter((n) => n.collection === c && byNetwork(n)).length,
      })),
      networks: NETWORKS.map((nw) => ({
        value: nw,
        label: NETWORK_LABELS[nw],
        count: base.filter((n) => n.network === nw && byCollection(n)).length,
      })),
      priceRange: { min: prices[0] ?? '0', max: prices[prices.length - 1] ?? '0' },
    },
    applied: {
      q: query.q,
      collections,
      networks,
      minPrice: min,
      maxPrice: max,
      sort: query.sort,
      tab: query.tab,
      page,
      pageSize: query.pageSize,
    },
  }
}

/** Mutates price / availability and broadcasts `nft.updated`. */
export function updateNft(
  id: string,
  patch: { price?: string; compareAtPrice?: string | null; editions?: Partial<Record<EditionId, number>> },
): NftDetail | undefined {
  const nft = findNft(id)
  if (!nft) return undefined
  if (patch.price !== undefined) nft.price = toEthString(eth(patch.price))
  if (patch.compareAtPrice !== undefined) nft.compareAtPrice = patch.compareAtPrice
  if (patch.editions) {
    for (const e of nft.editions) {
      const next = patch.editions[e.id]
      if (next !== undefined) e.available = Math.max(0, Math.floor(next))
    }
  }
  nft.totalAvailable = nft.editions.reduce((n, e) => n + e.available, 0)
  nft.version += 1
  saveDb()
  publishNft(nft)
  return nft
}

// ---------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------

export async function hashPassword(salt: string, password: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function toUser(u: UserRecord): User {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    ensName: u.ensName,
    walletNickname: u.walletNickname,
    avatarUrl: u.avatarUrl,
  }
}

export function findUserByEmail(email: string) {
  return state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
}
export function findUserByUsername(username: string) {
  return state.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())
}
export function findUser(id: string) {
  return state.users.find((u) => u.id === id)
}

export async function createUser(input: { email: string; username: string; password: string }) {
  const salt = `s-${Math.random().toString(36).slice(2, 10)}`
  const user: UserRecord = {
    id: nextId('u'),
    email: input.email.trim().toLowerCase(),
    username: input.username.trim(),
    displayName: input.username.trim(),
    ensName: '',
    walletNickname: '',
    avatarUrl: null,
    salt,
    passwordHash: await hashPassword(salt, input.password),
  }
  state.users.push(user)
  state.favorites[user.id] = []
  state.wallets[user.id] = []
  saveDb()
  return user
}

export async function verifyPassword(user: UserRecord, password: string) {
  return (await hashPassword(user.salt, password)) === user.passwordHash
}

export async function setPassword(user: UserRecord, password: string) {
  user.salt = `s-${Math.random().toString(36).slice(2, 10)}`
  user.passwordHash = await hashPassword(user.salt, password)
  saveDb()
}

export function createSession(userId: string) {
  const session: SessionRecord = {
    token: `tok_${crypto.randomUUID().replace(/-/g, '')}`,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    revoked: false,
  }
  state.sessions.push(session)
  saveDb()
  return session
}

export type SessionLookup =
  | { status: 'valid'; session: SessionRecord; user: UserRecord }
  | { status: 'expired' }
  | { status: 'missing' }

export function lookupSession(token: string | null | undefined): SessionLookup {
  if (!token) return { status: 'missing' }
  const session = state.sessions.find((s) => s.token === token)
  if (!session) return { status: 'missing' }
  if (session.revoked || Date.parse(session.expiresAt) <= Date.now()) return { status: 'expired' }
  const user = findUser(session.userId)
  if (!user) return { status: 'missing' }
  return { status: 'valid', session, user }
}

export function revokeSession(token: string) {
  const s = state.sessions.find((x) => x.token === token)
  if (s) s.revoked = true
  saveDb()
}

/** Test/demo hook: expire every active session (simulates TTL elapsing). */
export function expireAllSessions() {
  for (const s of state.sessions) s.expiresAt = new Date(Date.now() - 1000).toISOString()
  saveDb()
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function listFavorites(userId: string) {
  return state.favorites[userId] ?? []
}

export function setFavorite(userId: string, nftId: string, on: boolean) {
  const list = new Set(state.favorites[userId] ?? [])
  if (on) list.add(nftId)
  else list.delete(nftId)
  state.favorites[userId] = [...list]
  saveDb()
  return state.favorites[userId]
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

function newCart(ownerId: string | null): CartRecord {
  const cart: CartRecord = { id: nextId('cart'), ownerId, lines: [], couponCode: null, version: 1, updatedAt: now() }
  state.carts[cart.id] = cart
  if (ownerId) state.userCarts[ownerId] = cart.id
  return cart
}

/**
 * Resolve the cart for a request: the user's cart when authenticated,
 * otherwise the guest cart identified by the X-Cart-Id header (created on demand).
 */
export function resolveCart(userId: string | null, guestCartId: string | null, create = true): CartRecord | null {
  if (userId) {
    const id = state.userCarts[userId]
    const existing = id ? state.carts[id] : undefined
    if (existing) return existing
    return create ? newCart(userId) : null
  }
  if (guestCartId) {
    const guest = state.carts[guestCartId]
    if (guest && guest.ownerId === null) return guest
  }
  return create ? newCart(null) : null
}

function touch(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = now()
  saveDb()
}

export function maxQuantityFor(nft: NftDetail, editionId: EditionId) {
  const edition = nft.editions.find((e) => e.id === editionId)
  return Math.min(edition?.available ?? 0, nft.maxPerOrder)
}

/** Merge a guest cart into the user's cart on login/register (quantities summed, capped). */
export function mergeGuestCart(userId: string, guestCartId: string | undefined) {
  const userCart = resolveCart(userId, null)!
  if (!guestCartId) return userCart
  const guest = state.carts[guestCartId]
  if (!guest || guest.ownerId !== null || guest.lines.length === 0) return userCart
  for (const line of guest.lines) {
    const nft = findNft(line.nftId)
    if (!nft) continue
    const existing = userCart.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
    const cap = Math.max(1, maxQuantityFor(nft, line.editionId))
    if (existing) existing.quantity = Math.min(existing.quantity + line.quantity, cap)
    else userCart.lines.push({ ...line, quantity: Math.min(line.quantity, cap) })
  }
  if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode
  delete state.carts[guest.id]
  touch(userCart)
  return userCart
}

function couponFor(code: string | null): AppliedCoupon | null {
  if (!code) return null
  const def = COUPONS.find((c) => c.code === code)
  if (!def) return null
  return { code: def.code, description: def.description, percentOff: def.percentOff }
}

export function cartView(cart: CartRecord): Cart {
  const lines: CartLine[] = []
  for (const l of cart.lines) {
    const nft = findNft(l.nftId)
    if (!nft) continue
    const edition = nft.editions.find((e) => e.id === l.editionId)
    lines.push({
      nftId: nft.id,
      editionId: l.editionId,
      editionLabel: edition?.label ?? l.editionId,
      quantity: l.quantity,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      imageAlt: nft.imageAlt,
      unitPrice: nft.price,
      lineTotal: mul(nft.price, l.quantity),
      available: edition?.available ?? 0,
      maxQuantity: maxQuantityFor(nft, l.editionId),
      nftVersion: nft.version,
    })
  }
  return {
    id: cart.id,
    ownerId: cart.ownerId,
    lines,
    coupon: couponFor(cart.couponCode),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

export type CartMutationError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'OUT_OF_STOCK'; message: string; details: { available: number; maxQuantity: number } }
  | { code: 'VALIDATION_ERROR'; message: string; fields: Record<string, string> }

export function setCartItem(
  cart: CartRecord,
  nftId: string,
  editionId: EditionId,
  quantity: number,
  mode: 'add' | 'set',
): CartMutationError | null {
  const nft = findNft(nftId)
  if (!nft) return { code: 'NOT_FOUND', message: 'NFT não encontrado.' }
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) return { code: 'NOT_FOUND', message: 'Edição não encontrada.' }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { code: 'VALIDATION_ERROR', message: 'Quantidade inválida.', fields: { quantity: 'Informe uma quantidade inteira maior que zero.' } }
  }
  const existing = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
  const target = mode === 'add' ? (existing?.quantity ?? 0) + quantity : quantity
  const max = maxQuantityFor(nft, editionId)
  if (target > max) {
    return {
      code: 'OUT_OF_STOCK',
      message:
        edition.available === 0
          ? `A edição ${edition.label} de ${nft.name} está esgotada.`
          : `Só é possível ter até ${max} unidade(s) de ${nft.name} (${edition.label}).`,
      details: { available: edition.available, maxQuantity: max },
    }
  }
  if (existing) existing.quantity = target
  else cart.lines.push({ nftId, editionId, quantity: target })
  touch(cart)
  return null
}

export function removeCartItem(cart: CartRecord, nftId: string, editionId: EditionId) {
  const before = cart.lines.length
  cart.lines = cart.lines.filter((l) => !(l.nftId === nftId && l.editionId === editionId))
  if (cart.lines.length !== before) touch(cart)
  return before !== cart.lines.length
}

export type CouponResult = { ok: true } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED'; message: string }

export function applyCoupon(cart: CartRecord, rawCode: string): CouponResult {
  const code = rawCode.trim().toUpperCase()
  const def = COUPONS.find((c) => c.code === code)
  if (!def) return { ok: false, code: 'COUPON_INVALID', message: `O cupom "${code}" não existe.` }
  if (Date.parse(def.expiresAt) < Date.now()) {
    return { ok: false, code: 'COUPON_EXPIRED', message: `O cupom "${code}" expirou.` }
  }
  cart.couponCode = code
  touch(cart)
  return { ok: true }
}

export function removeCoupon(cart: CartRecord) {
  cart.couponCode = null
  touch(cart)
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export function buildQuote(cart: CartRecord, network: Network): Quote {
  const view = cartView(cart)
  const issues: QuoteIssue[] = []
  const lines: QuoteLine[] = view.lines.map((l) => {
    if (l.available === 0) {
      issues.push({ type: 'SOLD_OUT', nftId: l.nftId, editionId: l.editionId, message: `${l.name} (${l.editionLabel}) esgotou.` })
    } else if (l.quantity > l.available) {
      issues.push({
        type: 'INSUFFICIENT_AVAILABILITY',
        nftId: l.nftId,
        editionId: l.editionId,
        message: `Restam apenas ${l.available} unidade(s) de ${l.name} (${l.editionLabel}).`,
        previous: String(l.quantity),
        current: String(l.available),
      })
    }
    return {
      nftId: l.nftId,
      editionId: l.editionId,
      name: l.name,
      tokenId: l.tokenId,
      image: l.image,
      imageAlt: l.imageAlt,
      editionLabel: l.editionLabel,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    }
  })
  const subtotal = add('0', ...lines.map((l) => l.lineTotal))
  const coupon = view.coupon
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0'
  const networkFee = lines.length > 0 ? NETWORK_FEES[network] : '0'
  const total = add(sub(subtotal, discount), networkFee)
  const fingerprint = [
    network,
    coupon?.code ?? '-',
    networkFee,
    ...lines.map((l) => `${l.nftId}:${l.editionId}:${l.quantity}@${l.unitPrice}`),
  ].join('|')
  const quote: Quote = {
    id: nextId('q'),
    cartId: cart.id,
    cartVersion: cart.version,
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon,
    issues,
    createdAt: now(),
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    fingerprint,
  }
  // Keep only recent quotes.
  const ids = Object.keys(state.quotes)
  if (ids.length > 40) for (const id of ids.slice(0, ids.length - 40)) delete state.quotes[id]
  state.quotes[quote.id] = quote
  saveDb()
  return quote
}

export function findQuote(id: string) {
  return state.quotes[id]
}

// ---------------------------------------------------------------------------
// Wallets & connections
// ---------------------------------------------------------------------------

export function listWallets(userId: string) {
  return state.wallets[userId] ?? []
}

export function upsertWallet(userId: string, slot: WalletSlot, input: Omit<Wallet, 'id' | 'slot' | 'updatedAt'>) {
  const list = state.wallets[userId] ?? (state.wallets[userId] = [])
  const existing = list.find((w) => w.slot === slot)
  if (existing) {
    Object.assign(existing, input, { updatedAt: now() })
    saveDb()
    return existing
  }
  const wallet: Wallet = { ...input, id: nextId('w'), slot, updatedAt: now() }
  list.push(wallet)
  saveDb()
  return wallet
}

export function connectWallet(userId: string, walletId: string, network: Network) {
  const connection: ConnectionRecord = {
    connectionId: nextId('conn'),
    walletId,
    userId,
    network,
    connectedAt: now(),
    active: true,
  }
  state.connections[connection.connectionId] = connection
  saveDb()
  return connection
}

export function findConnection(id: string) {
  return state.connections[id]
}

export function disconnectWallet(id: string) {
  const c = state.connections[id]
  if (c) c.active = false
  saveDb()
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function findOrder(id: string) {
  return state.orders[id]
}

export function findIdempotency(key: string) {
  return state.idempotency[key]
}

export function orderFingerprint(userId: string, body: unknown) {
  return `${userId}:${JSON.stringify(body)}`
}

export function toOrder(o: OrderRecord): Order {
  const { cartId: _c, resolveAt: _r, outcome: _o, released: _x, ...order } = o
  return structuredClone(order)
}

function adjustStock(lines: QuoteLine[], direction: -1 | 1) {
  const touched = new Map<string, NftDetail>()
  for (const line of lines) {
    const nft = findNft(line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    // Open editions have no fixed supply: availability stays constant.
    if (edition.supply !== null) {
      edition.available = Math.max(0, edition.available + direction * line.quantity)
    }
    touched.set(nft.id, nft)
  }
  for (const nft of touched.values()) {
    nft.totalAvailable = nft.editions.reduce((n, e) => n + e.available, 0)
    nft.version += 1
    publishNft(nft)
  }
}

export function createOrder(params: {
  userId: string
  quote: Quote
  wallet: Wallet
  network: Network
  collector: CollectorDetails
  idempotencyKey: string
  fingerprint: string
  resolution: { outcome: 'confirmed' | 'declined' | null; delayMs: number }
}): OrderRecord {
  const { quote, wallet } = params
  const order: OrderRecord = {
    id: nextId('ord'),
    userId: params.userId,
    status: 'pending',
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    network: params.network,
    wallet: {
      id: wallet.id,
      kind: wallet.kind,
      label: wallet.kind === 'metamask' ? 'MetaMask' : wallet.kind === 'coinbase' ? 'Coinbase Wallet' : 'WalletConnect',
      address: wallet.address,
    },
    lines: structuredClone(quote.lines),
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
    coupon: quote.coupon,
    txHash: null,
    explorerUrl: null,
    declineReason: null,
    cartId: quote.cartId,
    resolveAt: params.resolution.outcome ? Date.now() + params.resolution.delayMs : null,
    outcome: params.resolution.outcome,
    released: false,
  }
  state.orders[order.id] = order
  state.idempotency[params.idempotencyKey] = { userId: params.userId, fingerprint: params.fingerprint, orderId: order.id }
  // Reserve stock while the payment is pending.
  adjustStock(order.lines, -1)
  saveDb()
  scheduleResolution(order)
  return order
}

function txHashFor(orderId: string) {
  let h = 0x811c9dc5
  for (const ch of orderId) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  const hex = (h.toString(16) + orderId.replace(/[^a-z0-9]/gi, '')).padEnd(64, 'e')
  return `0x${hex.slice(0, 64)}`
}

export function resolveOrder(orderId: string, outcome: 'confirmed' | 'declined') {
  const order = state.orders[orderId]
  if (!order || order.status !== 'pending') return order // terminal states never change
  const t = timers.get(orderId)
  if (t) clearTimeout(t)
  timers.delete(orderId)
  order.status = outcome
  order.version += 1
  order.updatedAt = now()
  order.resolveAt = null
  if (outcome === 'confirmed') {
    order.txHash = txHashFor(order.id)
    order.explorerUrl = `https://sepolia.etherscan.io/tx/${order.txHash}`
    // Remove only the purchased items/quantities from the cart.
    const cart = state.carts[order.cartId]
    if (cart) {
      for (const line of order.lines) {
        const l = cart.lines.find((x) => x.nftId === line.nftId && x.editionId === line.editionId)
        if (!l) continue
        l.quantity -= line.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (cart.lines.length === 0) cart.couponCode = null
      touch(cart)
    }
  } else {
    order.declineReason = 'A carteira recusou a assinatura da transação (saldo insuficiente na simulação).'
    if (!order.released) {
      adjustStock(order.lines, 1)
      order.released = true
    }
  }
  saveDb()
  publishOrder(order)
  return order
}

function scheduleResolution(order: OrderRecord) {
  if (order.status !== 'pending' || !order.outcome || order.resolveAt === null) return
  const outcome = order.outcome
  const delay = Math.max(0, order.resolveAt - Date.now())
  const existing = timers.get(order.id)
  if (existing) clearTimeout(existing)
  timers.set(
    order.id,
    setTimeout(() => resolveOrder(order.id, outcome), delay),
  )
}

/** After a reload the in-memory timers are gone: re-arm them from persisted state. */
export function resumePendingOrders() {
  for (const order of Object.values(state.orders)) scheduleResolution(order)
}

export function pendingOrders() {
  return Object.values(state.orders).filter((o) => o.status === 'pending')
}

export function resolutionFor(scenario: string, delayMs: number): { outcome: 'confirmed' | 'declined' | null; delayMs: number } {
  if (scenario === 'payment-declined') return { outcome: 'declined', delayMs }
  if (scenario === 'payment-hold') return { outcome: null, delayMs }
  return { outcome: 'confirmed', delayMs }
}

export { EDITION_ORDER }
