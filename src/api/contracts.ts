/**
 * REST + realtime contracts shared by the Axios client, TanStack Query hooks,
 * the UI and the MSW mock server. This file is the single source of truth:
 * if a shape changes here, both the client and the mocks fail to type-check.
 *
 * Monetary values (ETH) always travel as decimal strings ("1.19", "0.016").
 * Quantities are integers.
 */

export type EthAmount = string
export type IsoDate = string

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422 — field-level errors in `fields`
  | 'UNAUTHENTICATED' // 401 — no / unknown token
  | 'SESSION_EXPIRED' // 401 — token expired or revoked
  | 'INVALID_CREDENTIALS' // 401 — login failed
  | 'FORBIDDEN' // 403 — resource belongs to another user
  | 'NOT_FOUND' // 404
  | 'EMAIL_TAKEN' // 409 — register / profile conflict
  | 'USERNAME_TAKEN' // 409
  | 'OUT_OF_STOCK' // 409 — edition availability conflict
  | 'QUOTE_STALE' // 409 — price / availability / coupon / fee changed
  | 'IDEMPOTENCY_CONFLICT' // 409 — key reused with a different payload
  | 'WALLET_REJECTED' // 409 — user rejected the connection in the wallet
  | 'WALLET_DISCONNECTED' // 409 — wallet must be (re)connected
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'GATEWAY_TIMEOUT' // 504 — upstream timed out (operation may have happened)
  | 'SERVICE_UNAVAILABLE' // 503 — transient failure, safe to retry
  | 'INTERNAL_ERROR' // 500
  | 'NETWORK_ERROR' // client-side: no response
  | 'TIMEOUT' // client-side: request aborted by timeout

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    fields?: Record<string, string>
    details?: unknown
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]

export const COLLECTIONS = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export type CollectionSlug = (typeof COLLECTIONS)[number]

export const SORTS = ['recent', 'price-asc', 'price-desc', 'name'] as const
export type CatalogSort = (typeof SORTS)[number]

export const TABS = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof TABS)[number]

export const EDITION_IDS = ['1-1', '1-10', '1-50', 'open'] as const
export type EditionId = (typeof EDITION_IDS)[number]

export type Rarity = 'comum' | 'raro' | 'lendario'

export interface Edition {
  id: EditionId
  label: string
  /** null = open edition (no fixed supply) */
  supply: number | null
  available: number
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  image: string
  imageAlt: string
  price: EthAmount
  /** Shown struck-through when the NFT is on sale. */
  compareAtPrice: EthAmount | null
  collection: CollectionSlug
  network: Network
  rarity: Rarity
  listedAt: IsoDate
  totalAvailable: number
  /** Monotonic version — bumped on every price/availability change. */
  version: number
}

export interface NftDetail extends NftSummary {
  description: string
  longDescription: string[]
  gallery: string[]
  editions: Edition[]
  attributes: string[]
  collectionName: string
  creator: string
  rating: number
  reviewsCount: number
  contractAddress: string
  royaltyPercent: number
  maxPerOrder: number
}

export interface CatalogQuery {
  q?: string
  collections?: CollectionSlug[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  sort?: CatalogSort
  tab?: CatalogTab
  page?: number
  pageSize?: number
}

export interface Facet<T extends string> {
  value: T
  label: string
  count: number
}

export interface CatalogResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    collections: Facet<CollectionSlug>[]
    networks: Facet<Network>[]
    priceRange: { min: EthAmount; max: EthAmount }
  }
  /** Echo of the parameters the server applied (lets the UI verify it). */
  applied: Required<Omit<CatalogQuery, 'q' | 'minPrice' | 'maxPrice'>> &
    Pick<CatalogQuery, 'q' | 'minPrice' | 'maxPrice'>
}

// ---------------------------------------------------------------------------
// Session & account
// ---------------------------------------------------------------------------

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: IsoDate
  user: User
}

export interface LoginRequest {
  email: string
  password: string
  /** Guest cart to merge into the user's cart. */
  guestCartId?: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  guestCartId?: string
}

export interface UpdateProfileRequest {
  displayName: string
  username: string
  email: string
  ensName: string
  walletNickname: string
}

export interface UpdateAvatarRequest {
  /** data: URL (PNG/JPEG/WebP, ≤ 1 MB) */
  dataUrl: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export interface FavoritesResponse {
  nftIds: string[]
  items: NftSummary[]
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export interface CartLine {
  nftId: string
  editionId: EditionId
  editionLabel: string
  quantity: number
  name: string
  tokenId: string
  image: string
  imageAlt: string
  unitPrice: EthAmount
  lineTotal: EthAmount
  /** Units still available for this NFT edition. */
  available: number
  /** min(available, maxPerOrder) */
  maxQuantity: number
  nftVersion: number
}

export interface AppliedCoupon {
  code: string
  description: string
  percentOff: number
}

export interface Cart {
  id: string
  ownerId: string | null
  lines: CartLine[]
  coupon: AppliedCoupon | null
  itemCount: number
  version: number
  updatedAt: IsoDate
}

export interface AddCartItemRequest {
  nftId: string
  editionId: EditionId
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export type QuoteIssueType =
  | 'PRICE_CHANGED'
  | 'INSUFFICIENT_AVAILABILITY'
  | 'SOLD_OUT'
  | 'COUPON_EXPIRED'
  | 'COUPON_INVALID'

export interface QuoteIssue {
  type: QuoteIssueType
  nftId?: string
  editionId?: EditionId
  message: string
  previous?: string
  current?: string
}

export interface QuoteLine {
  nftId: string
  editionId: EditionId
  name: string
  tokenId: string
  image: string
  imageAlt: string
  editionLabel: string
  quantity: number
  unitPrice: EthAmount
  lineTotal: EthAmount
}

export interface QuoteRequest {
  network?: Network
}

export interface Quote {
  id: string
  cartId: string
  cartVersion: number
  network: Network
  lines: QuoteLine[]
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  coupon: AppliedCoupon | null
  issues: QuoteIssue[]
  createdAt: IsoDate
  expiresAt: IsoDate
  /** Fingerprint of prices/quantities/fee/coupon; any change → new fingerprint. */
  fingerprint: string
}

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

export const WALLET_KINDS = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletKind = (typeof WALLET_KINDS)[number]
export type WalletSlot = 'primary' | 'secondary'

export interface Wallet {
  id: string
  slot: WalletSlot
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress: string
  kind: WalletKind
  referralCode: string
  email: string
  ensName: string
  updatedAt: IsoDate
}

export type UpsertWalletRequest = Omit<Wallet, 'id' | 'slot' | 'updatedAt'>

export interface WalletConnection {
  walletId: string
  network: Network
  connectionId: string
  status: 'connected'
  connectedAt: IsoDate
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface CollectorDetails {
  displayName: string
  username: string
  profileName: string
  email: string
  ensName: string
  referralCode: string
  note: string
}

export interface CreateOrderRequest {
  quoteId: string
  quoteFingerprint: string
  walletId: string
  connectionId: string
  network: Network
  collector: CollectorDetails
}

export interface OrderLine extends QuoteLine {}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  version: number
  createdAt: IsoDate
  updatedAt: IsoDate
  network: Network
  wallet: { id: string; kind: WalletKind; label: string; address: string }
  lines: OrderLine[]
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  coupon: AppliedCoupon | null
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
}

// ---------------------------------------------------------------------------
// Realtime events (Socket.IO)
// ---------------------------------------------------------------------------

export interface RealtimeEnvelope<TType extends string, TResource extends string, TData> {
  /** Stable, unique event identity — used for de-duplication. */
  id: string
  type: TType
  resource: { type: TResource; id: string }
  /** Version of the resource after this event. Older/equal versions are ignored. */
  version: number
  occurredAt: IsoDate
  data: TData
}

export interface NftUpdatedData {
  price: EthAmount
  compareAtPrice: EthAmount | null
  editions: Pick<Edition, 'id' | 'available'>[]
  totalAvailable: number
}

export interface OrderUpdatedData {
  userId: string
  status: OrderStatus
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
}

export type NftUpdatedEvent = RealtimeEnvelope<'nft.updated', 'nft', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', 'order', OrderUpdatedData>
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export interface RealtimeHandshakeAuth {
  /** Session token, or null for anonymous (catalog-only) subscriptions. */
  token: string | null
}

/** Headers understood by the API. */
export const HEADERS = {
  cartId: 'X-Cart-Id',
  idempotencyKey: 'Idempotency-Key',
} as const

export const API_BASE_URL = '/api'
export const REALTIME_URL = 'wss://realtime.kurio.mock'
