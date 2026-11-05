import { http, HttpResponse } from 'msw'
import {
  API_BASE_URL,
  COLLECTIONS,
  EDITION_IDS,
  HEADERS,
  NETWORKS,
  SORTS,
  TABS,
  WALLET_KINDS,
  type AddCartItemRequest,
  type ApplyCouponRequest,
  type CatalogSort,
  type CatalogTab,
  type ChangePasswordRequest,
  type CollectionSlug,
  type CreateOrderRequest,
  type EditionId,
  type FavoritesResponse,
  type LoginRequest,
  type Network,
  type QuoteRequest,
  type RegisterRequest,
  type Session,
  type UpdateAvatarRequest,
  type UpdateCartItemRequest,
  type UpdateProfileRequest,
  type UpsertWalletRequest,
  type WalletConnection,
  type WalletSlot,
} from '@/api/contracts'
import { isValidEth } from '@/lib/eth'
import { getConfig, isScenarioActive, nextCount } from './config'
import * as db from './db'
import { apiError, bearer, optionalUser, requireAuth, withNetwork } from './http'

const api = (path: string) => `${API_BASE_URL}${path}`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/i
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const ENS_RE = /^[a-z0-9-]{3,40}$/

function sessionPayload(user: Parameters<typeof db.toUser>[0], session: { token: string; expiresAt: string }): Session {
  return { token: session.token, expiresAt: session.expiresAt, user: db.toUser(user) }
}

function passwordProblems(password: string) {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return 'Use letras maiúsculas, minúsculas e números.'
  }
  return null
}

function cartFor(request: Request, create = true) {
  const user = optionalUser(request)
  return db.resolveCart(user?.id ?? null, request.headers.get(HEADERS.cartId), create)
}

function parseList<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set<T>()
  for (const raw of values) for (const v of raw.split(',')) if ((allowed as readonly string[]).includes(v)) set.add(v as T)
  return [...set]
}

function isEdition(v: unknown): v is EditionId {
  return typeof v === 'string' && (EDITION_IDS as readonly string[]).includes(v)
}
function isNetwork(v: unknown): v is Network {
  return typeof v === 'string' && (NETWORKS as readonly string[]).includes(v)
}

export const restHandlers = [
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  http.post(
    api('/auth/register'),
    withNetwork('default', async ({ request }) => {
      const body = (await request.json()) as RegisterRequest
      const fields: Record<string, string> = {}
      if (!body.username || !USERNAME_RE.test(body.username)) fields.username = 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.'
      if (!body.email || !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
      const pw = passwordProblems(body.password ?? '')
      if (pw) fields.password = pw
      if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })
      if (db.findUserByEmail(body.email)) {
        return apiError(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', { fields: { email: 'Este e-mail já está cadastrado.' } })
      }
      if (db.findUserByUsername(body.username)) {
        return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', { fields: { username: 'Escolha outro nome de usuário.' } })
      }
      const user = await db.createUser(body)
      db.mergeGuestCart(user.id, body.guestCartId)
      const session = db.createSession(user.id)
      return HttpResponse.json(sessionPayload(user, session), { status: 201 })
    }),
  ),

  http.post(
    api('/auth/login'),
    withNetwork('default', async ({ request }) => {
      const body = (await request.json()) as LoginRequest
      const fields: Record<string, string> = {}
      if (!body.email || !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
      if (!body.password) fields.password = 'Informe sua senha.'
      if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })
      const user = db.findUserByEmail(body.email)
      if (!user || !(await db.verifyPassword(user, body.password))) {
        return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      db.mergeGuestCart(user.id, body.guestCartId)
      const session = db.createSession(user.id)
      return HttpResponse.json(sessionPayload(user, session))
    }),
  ),

  http.get(
    api('/auth/session'),
    withNetwork('default', ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      return HttpResponse.json(sessionPayload(auth.user, auth.session))
    }),
  ),

  http.post(
    api('/auth/logout'),
    withNetwork('default', ({ request }) => {
      const token = bearer(request)
      if (token) db.revokeSession(token)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------
  http.get(
    api('/nfts'),
    withNetwork('catalog', ({ request }) => {
      if (isScenarioActive('catalog-error')) {
        return apiError(500, 'INTERNAL_ERROR', 'Não foi possível carregar o catálogo.')
      }
      const url = new URL(request.url)
      const p = url.searchParams
      const sort = (SORTS as readonly string[]).includes(p.get('sort') ?? '') ? (p.get('sort') as CatalogSort) : 'recent'
      const tab = (TABS as readonly string[]).includes(p.get('tab') ?? '') ? (p.get('tab') as CatalogTab) : 'all'
      const page = Math.max(1, Number.parseInt(p.get('page') ?? '1', 10) || 1)
      const pageSize = Math.min(48, Math.max(1, Number.parseInt(p.get('pageSize') ?? '9', 10) || 9))
      const minPrice = p.get('minPrice') ?? undefined
      const maxPrice = p.get('maxPrice') ?? undefined
      if ((minPrice && !isValidEth(minPrice)) || (maxPrice && !isValidEth(maxPrice))) {
        return apiError(422, 'VALIDATION_ERROR', 'Faixa de preço inválida.', { fields: { price: 'Use valores decimais.' } })
      }
      const result = db.listCatalog({
        q: p.get('q') ?? undefined,
        collections: parseList<CollectionSlug>(p.getAll('collection'), COLLECTIONS),
        networks: parseList<Network>(p.getAll('network'), NETWORKS),
        minPrice,
        maxPrice,
        sort,
        tab,
        page,
        pageSize,
      })
      if (isScenarioActive('catalog-empty')) {
        return HttpResponse.json({ ...result, items: [], total: 0, totalPages: 1, page: 1 })
      }
      return HttpResponse.json(result)
    }),
  ),

  http.get(
    api('/nfts/:id'),
    withNetwork('default', ({ params }) => {
      const nft = db.findNft(String(params.id))
      if (!nft) return apiError(404, 'NOT_FOUND', 'Este NFT não existe ou foi removido.')
      return HttpResponse.json(nft)
    }),
  ),

  // -------------------------------------------------------------------------
  // Favorites
  // -------------------------------------------------------------------------
  http.get(
    api('/favorites'),
    withNetwork('default', ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const ids = db.listFavorites(auth.user.id)
      const body: FavoritesResponse = {
        nftIds: ids,
        items: ids.map((id) => db.findNft(id)).filter((n) => !!n).map(db.toSummary),
      }
      return HttpResponse.json(body)
    }),
  ),

  ...(['put', 'delete'] as const).map((method) =>
    http[method](
      api('/favorites/:nftId'),
      withNetwork('default', ({ request, params }) => {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
        if (isScenarioActive('favorite-fail')) {
          return apiError(500, 'INTERNAL_ERROR', 'Não foi possível atualizar seus favoritos.')
        }
        const nftId = String(params.nftId)
        if (!db.findNft(nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
        const ids = db.setFavorite(auth.user.id, nftId, method === 'put')
        return HttpResponse.json({ nftIds: ids })
      }),
    ),
  ),

  // -------------------------------------------------------------------------
  // Cart
  // -------------------------------------------------------------------------
  http.get(
    api('/cart'),
    withNetwork('default', ({ request }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      return HttpResponse.json(db.cartView(cartFor(request)!))
    }),
  ),

  http.post(
    api('/cart/items'),
    withNetwork('default', async ({ request }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      const body = (await request.json()) as AddCartItemRequest
      if (!isEdition(body.editionId)) {
        return apiError(422, 'VALIDATION_ERROR', 'Edição inválida.', { fields: { editionId: 'Selecione uma edição.' } })
      }
      const cart = cartFor(request)!
      const err = db.setCartItem(cart, body.nftId, body.editionId, body.quantity, 'add')
      if (err) return mutationError(err)
      return HttpResponse.json(db.cartView(cart), { status: 201 })
    }),
  ),

  http.patch(
    api('/cart/items/:nftId/:editionId'),
    withNetwork('default', async ({ request, params }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      const body = (await request.json()) as UpdateCartItemRequest
      const editionId = String(params.editionId)
      if (!isEdition(editionId)) return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
      const cart = cartFor(request)!
      if (!cart.lines.some((l) => l.nftId === params.nftId && l.editionId === editionId)) {
        return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
      }
      const err = db.setCartItem(cart, String(params.nftId), editionId, body.quantity, 'set')
      if (err) return mutationError(err)
      return HttpResponse.json(db.cartView(cart))
    }),
  ),

  http.delete(
    api('/cart/items/:nftId/:editionId'),
    withNetwork('default', ({ request, params }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      const cart = cartFor(request)!
      const editionId = String(params.editionId)
      if (!isEdition(editionId) || !db.removeCartItem(cart, String(params.nftId), editionId)) {
        return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
      }
      return HttpResponse.json(db.cartView(cart))
    }),
  ),

  http.post(
    api('/cart/coupon'),
    withNetwork('default', async ({ request }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      const body = (await request.json()) as ApplyCouponRequest
      if (!body.code?.trim()) {
        return apiError(422, 'VALIDATION_ERROR', 'Informe um código.', { fields: { code: 'Informe o código promocional.' } })
      }
      const cart = cartFor(request)!
      const result = db.applyCoupon(cart, body.code)
      if (!result.ok) return apiError(422, result.code, result.message, { fields: { code: result.message } })
      return HttpResponse.json(db.cartView(cart))
    }),
  ),

  http.delete(
    api('/cart/coupon'),
    withNetwork('default', ({ request }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      const cart = cartFor(request)!
      db.removeCoupon(cart)
      return HttpResponse.json(db.cartView(cart))
    }),
  ),

  // -------------------------------------------------------------------------
  // Quote
  // -------------------------------------------------------------------------
  http.post(
    api('/quote'),
    withNetwork('default', async ({ request }) => {
      if (bearer(request)) {
        const auth = requireAuth(request)
        if ('response' in auth) return auth.response
      }
      const body = ((await request.json().catch(() => ({}))) ?? {}) as QuoteRequest
      const network: Network = isNetwork(body.network) ? body.network : 'ethereum'
      const cart = cartFor(request)!
      return HttpResponse.json(db.buildQuote(cart, network))
    }),
  ),

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  http.post(
    api('/orders'),
    withNetwork('default', async ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const key = request.headers.get(HEADERS.idempotencyKey)
      if (!key || key.length < 8) {
        return apiError(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.')
      }
      const body = (await request.json()) as CreateOrderRequest
      const fingerprint = db.orderFingerprint(auth.user.id, body)

      // 1) Idempotent replay.
      const previous = db.findIdempotency(key)
      if (previous) {
        if (previous.userId !== auth.user.id || previous.fingerprint !== fingerprint) {
          return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        const order = db.findOrder(previous.orderId)!
        return HttpResponse.json(db.toOrder(order), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }

      // 2) Validate collector fields.
      const fields: Record<string, string> = {}
      const c = body.collector ?? ({} as CreateOrderRequest['collector'])
      if (!c.displayName?.trim()) fields['collector.displayName'] = 'Informe o nome de exibição.'
      if (!c.username?.trim()) fields['collector.username'] = 'Informe o nome de usuário.'
      if (!c.email || !EMAIL_RE.test(c.email)) fields['collector.email'] = 'Informe um e-mail válido.'
      if (!isNetwork(body.network)) fields.network = 'Selecione uma rede.'
      if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os dados do colecionador.', { fields })

      const cart = db.resolveCart(auth.user.id, null, false)
      if (!cart || cart.lines.length === 0) return apiError(409, 'QUOTE_STALE', 'Seu carrinho está vazio.')

      // 3) Deterministic "something changed during checkout" scenarios.
      const first = cart.lines[0]
      if (isScenarioActive('price-change-checkout') && nextCount('scenario:price-change') === 1) {
        const nft = db.findNft(first.nftId)!
        db.updateNft(nft.id, { price: (Number(nft.price) + 0.1).toFixed(2) })
      }
      if (isScenarioActive('sold-out-checkout') && nextCount('scenario:sold-out') === 1) {
        db.updateNft(first.nftId, { editions: { [first.editionId]: 0 } })
      }

      // 4) Revalidate price, availability, coupon and fee against a fresh quote.
      const fresh = db.buildQuote(cart, body.network)
      const original = db.findQuote(body.quoteId)
      if (fresh.issues.length > 0) {
        return apiError(409, 'OUT_OF_STOCK', 'A disponibilidade de um ou mais itens mudou.', { details: { quote: fresh } })
      }
      if (!original || original.cartId !== cart.id || Date.parse(original.expiresAt) < Date.now() || fresh.fingerprint !== body.quoteFingerprint) {
        return apiError(409, 'QUOTE_STALE', 'Os valores do pedido mudaram. Revise e confirme novamente.', { details: { quote: fresh } })
      }

      // 5) Wallet + connection.
      const wallet = db.listWallets(auth.user.id).find((w) => w.id === body.walletId)
      if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
      const connection = db.findConnection(body.connectionId)
      if (!connection || !connection.active || connection.walletId !== wallet.id || connection.userId !== auth.user.id) {
        return apiError(409, 'WALLET_DISCONNECTED', 'Conecte a carteira novamente para assinar a compra.')
      }

      // 6) Create (pending) + simulated settlement.
      const { scenario, orderResolutionMs } = getConfig()
      const order = db.createOrder({
        userId: auth.user.id,
        quote: fresh,
        wallet,
        network: body.network,
        collector: c,
        idempotencyKey: key,
        fingerprint,
        resolution: db.resolutionFor(scenario, orderResolutionMs),
      })

      if (scenario === 'order-timeout' && nextCount(`timeout:${key}`) === 1) {
        // The order WAS created, but the client never sees the response.
        return apiError(504, 'GATEWAY_TIMEOUT', 'O servidor demorou para responder.')
      }
      return HttpResponse.json(db.toOrder(order), { status: 201 })
    }),
  ),

  http.get(
    api('/orders'),
    withNetwork('default', ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const status = new URL(request.url).searchParams.get('status')
      const orders = Object.values(db.getState().orders)
        .filter((o) => o.userId === auth.user.id && (!status || o.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(db.toOrder)
      return HttpResponse.json({ items: orders })
    }),
  ),

  http.get(
    api('/orders/:id'),
    withNetwork('default', ({ request, params }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const order = db.findOrder(String(params.id))
      if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
      return HttpResponse.json(db.toOrder(order))
    }),
  ),

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------
  http.get(
    api('/me/profile'),
    withNetwork('default', ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      return HttpResponse.json(db.toUser(auth.user))
    }),
  ),

  http.patch(
    api('/me/profile'),
    withNetwork('default', async ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const body = (await request.json()) as UpdateProfileRequest
      if (isScenarioActive('validation-error')) {
        return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
          fields: { username: 'Este nome de usuário é reservado.', ensName: 'Nome ENS indisponível.' },
        })
      }
      const fields: Record<string, string> = {}
      if (!body.displayName?.trim()) fields.displayName = 'Informe o nome de exibição.'
      if (!body.username || !USERNAME_RE.test(body.username)) fields.username = 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.'
      if (!body.email || !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
      if (!body.ensName || !ENS_RE.test(body.ensName)) fields.ensName = 'Use de 3 a 40 letras minúsculas, números ou hífen.'
      if (!body.walletNickname?.trim()) fields.walletNickname = 'Informe o apelido da carteira.'
      if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })
      const byEmail = db.findUserByEmail(body.email)
      if (byEmail && byEmail.id !== auth.user.id) {
        return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já pertence a outra conta.', { fields: { email: 'Este e-mail já está em uso.' } })
      }
      const byUsername = db.findUserByUsername(body.username)
      if (byUsername && byUsername.id !== auth.user.id) {
        return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', { fields: { username: 'Escolha outro nome de usuário.' } })
      }
      Object.assign(auth.user, {
        displayName: body.displayName.trim(),
        username: body.username.trim(),
        email: body.email.trim().toLowerCase(),
        ensName: body.ensName.trim(),
        walletNickname: body.walletNickname.trim(),
      })
      db.saveDb()
      return HttpResponse.json(db.toUser(auth.user))
    }),
  ),

  http.put(
    api('/me/avatar'),
    withNetwork('default', async ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const body = (await request.json()) as UpdateAvatarRequest
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(body.dataUrl ?? '')) {
        return apiError(422, 'VALIDATION_ERROR', 'Formato de imagem inválido.', { fields: { avatar: 'Use PNG, JPEG ou WebP.' } })
      }
      if (body.dataUrl.length > 1_400_000) {
        return apiError(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { fields: { avatar: 'A imagem deve ter até 1 MB.' } })
      }
      auth.user.avatarUrl = body.dataUrl
      db.saveDb()
      return HttpResponse.json(db.toUser(auth.user))
    }),
  ),

  http.delete(
    api('/me/avatar'),
    withNetwork('default', ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      auth.user.avatarUrl = null
      db.saveDb()
      return HttpResponse.json(db.toUser(auth.user))
    }),
  ),

  http.post(
    api('/me/password'),
    withNetwork('default', async ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const body = (await request.json()) as ChangePasswordRequest
      if (!(await db.verifyPassword(auth.user, body.currentPassword ?? ''))) {
        return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { fields: { currentPassword: 'A senha atual está incorreta.' } })
      }
      const pw = passwordProblems(body.newPassword ?? '')
      if (pw) return apiError(422, 'VALIDATION_ERROR', pw, { fields: { newPassword: pw } })
      if (body.newPassword === body.currentPassword) {
        return apiError(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', {
          fields: { newPassword: 'A nova senha deve ser diferente da atual.' },
        })
      }
      await db.setPassword(auth.user, body.newPassword)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // -------------------------------------------------------------------------
  // Wallets
  // -------------------------------------------------------------------------
  http.get(
    api('/me/wallets'),
    withNetwork('default', ({ request }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      return HttpResponse.json({ items: db.listWallets(auth.user.id) })
    }),
  ),

  http.put(
    api('/me/wallets/:slot'),
    withNetwork('default', async ({ request, params }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const slot = String(params.slot) as WalletSlot
      if (slot !== 'primary' && slot !== 'secondary') return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (slot === 'secondary' && !db.listWallets(auth.user.id).some((w) => w.slot === 'primary')) {
        return apiError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
      }
      const body = (await request.json()) as UpsertWalletRequest
      if (isScenarioActive('validation-error')) {
        return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
          fields: { address: 'Endereço não encontrado na rede selecionada.' },
        })
      }
      const fields: Record<string, string> = {}
      if (!body.displayName?.trim()) fields.displayName = 'Informe o nome de exibição.'
      if (!body.nickname?.trim()) fields.nickname = 'Informe o apelido da carteira.'
      if (!isNetwork(body.network)) fields.network = 'Selecione uma rede.'
      if (!body.profileName?.trim()) fields.profileName = 'Informe o nome do perfil.'
      if (!body.address || !ADDRESS_RE.test(body.address)) fields.address = 'Use um endereço 0x com 40 caracteres hexadecimais.'
      if (body.secondaryAddress && !ADDRESS_RE.test(body.secondaryAddress) && !/\.eth$/.test(body.secondaryAddress)) {
        fields.secondaryAddress = 'Use um endereço 0x válido ou um nome .eth.'
      }
      if (!(WALLET_KINDS as readonly string[]).includes(body.kind)) fields.kind = 'Selecione o tipo de carteira.'
      if (!body.referralCode?.trim()) fields.referralCode = 'Informe o código de indicação.'
      if (!body.email || !EMAIL_RE.test(body.email)) fields.email = 'Informe um e-mail válido.'
      if (!body.ensName || !ENS_RE.test(body.ensName)) fields.ensName = 'Use de 3 a 40 letras minúsculas, números ou hífen.'
      if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })
      const wallet = db.upsertWallet(auth.user.id, slot, {
        displayName: body.displayName.trim(),
        nickname: body.nickname.trim(),
        network: body.network,
        profileName: body.profileName.trim(),
        address: body.address,
        secondaryAddress: body.secondaryAddress?.trim() ?? '',
        kind: body.kind,
        referralCode: body.referralCode.trim(),
        email: body.email.trim().toLowerCase(),
        ensName: body.ensName.trim(),
      })
      return HttpResponse.json(wallet)
    }),
  ),

  http.post(
    api('/me/wallets/:walletId/connect'),
    withNetwork('default', async ({ request, params }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      const wallet = db.listWallets(auth.user.id).find((w) => w.id === params.walletId)
      if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
      const body = (await request.json()) as { network: Network }
      if (!isNetwork(body.network)) return apiError(422, 'VALIDATION_ERROR', 'Selecione uma rede.', { fields: { network: 'Selecione uma rede.' } })
      if (isScenarioActive('wallet-reject')) {
        return apiError(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      }
      const c = db.connectWallet(auth.user.id, wallet.id, body.network)
      const payload: WalletConnection = {
        walletId: c.walletId,
        network: c.network,
        connectionId: c.connectionId,
        status: 'connected',
        connectedAt: c.connectedAt,
      }
      return HttpResponse.json(payload)
    }),
  ),

  http.delete(
    api('/me/wallet-connections/:connectionId'),
    withNetwork('default', ({ request, params }) => {
      const auth = requireAuth(request)
      if ('response' in auth) return auth.response
      db.disconnectWallet(String(params.connectionId))
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // Unknown API routes → JSON 404 (never fall through to the SPA HTML).
  http.all(api('/*'), () => apiError(404, 'NOT_FOUND', 'Recurso inexistente.')),
]

function mutationError(err: db.CartMutationError) {
  switch (err.code) {
    case 'NOT_FOUND':
      return apiError(404, 'NOT_FOUND', err.message)
    case 'OUT_OF_STOCK':
      return apiError(409, 'OUT_OF_STOCK', err.message, { details: err.details })
    case 'VALIDATION_ERROR':
      return apiError(422, 'VALIDATION_ERROR', err.message, { fields: err.fields })
  }
}
