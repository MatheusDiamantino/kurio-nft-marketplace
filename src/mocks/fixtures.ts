import type {
  CollectionSlug,
  Edition,
  EditionId,
  Network,
  NftDetail,
  Rarity,
  Wallet,
} from '@/api/contracts'

export const FIXTURE_NOW = '2026-07-29T12:00:00.000Z'

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const COLLECTION_LABELS: Record<CollectionSlug, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

type Art = 'emerald-ape' | 'sage-nomad' | 'ivory-baron' | 'golden-beat'

const ART_ALT: Record<Art, string> = {
  'emerald-ape':
    'Ilustração de um macaco marrom com óculos redondos verdes e jaqueta college verde com corrente dourada',
  'sage-nomad': 'Ilustração de um gorila cinza com chapéu bucket verde-sálvia e moletom roxo',
  'ivory-baron': 'Ilustração de um gorila preto com blazer creme e gola alta verde-escura',
  'golden-beat': 'Ilustração de um macaco dourado com fones de ouvido verdes e jaqueta creme',
}

const ART_ATTRS: Record<Art, string[]> = {
  'emerald-ape': ['Óculos', 'Esmeralda', 'Raro'],
  'sage-nomad': ['Chapéu bucket', 'Moletom', 'Sálvia'],
  'ivory-baron': ['Blazer', 'Marfim', 'Clássico'],
  'golden-beat': ['Fones', 'Dourado', 'Música'],
}

interface Seed {
  name: string
  art: Art
  price: string
  compareAt?: string
  collection: CollectionSlug
  network: Network
  rarity: Rarity
}

const FIGMA_SEEDS: Seed[] = [
  { name: 'Emerald Ape #042', art: 'emerald-ape', price: '1.19', collection: 'arte-digital', network: 'ethereum', rarity: 'raro' },
  { name: 'Sage Nomad #009', art: 'sage-nomad', price: '1.69', collection: 'arte-digital', network: 'ethereum', rarity: 'comum' },
  { name: 'Neon Vessel #552', art: 'ivory-baron', price: '1.99', compareAt: '2.29', collection: 'colecionaveis', network: 'ethereum', rarity: 'raro' },
  { name: 'Cosmic Bloom #118', art: 'sage-nomad', price: '1.29', collection: 'generativa', network: 'polygon', rarity: 'comum' },
  { name: 'Violet Nomad #314', art: 'sage-nomad', price: '1.39', collection: 'arte-digital', network: 'ethereum', rarity: 'comum' },
  { name: 'Ivory Baron #088', art: 'ivory-baron', price: '1.79', collection: 'colecionaveis', network: 'ethereum', rarity: 'lendario' },
  { name: 'Golden Beat #207', art: 'golden-beat', price: '0.99', collection: 'musica', network: 'polygon', rarity: 'comum' },
  { name: 'Golden Frequency #071', art: 'golden-beat', price: '0.59', collection: 'musica', network: 'solana', rarity: 'comum' },
  { name: 'Golden Signal #160', art: 'golden-beat', price: '0.39', collection: 'musica', network: 'ethereum', rarity: 'comum' },
]

const PREFIXES = ['Amber', 'Cobalt', 'Velvet', 'Rustic', 'Lunar', 'Copper', 'Jade', 'Onyx', 'Saffron', 'Midnight', 'Desert', 'Crimson']
const SUFFIXES = ['Ape', 'Nomad', 'Baron', 'Beat', 'Monk', 'Drifter', 'Echo', 'Sage', 'Pilot', 'Relic']
const ARTS: Art[] = ['emerald-ape', 'sage-nomad', 'ivory-baron', 'golden-beat']
const NETS: Network[] = ['ethereum', 'ethereum', 'polygon', 'solana']
const COLLS: CollectionSlug[] = [
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade',
]

export const CATALOG_SIZE = 60

function buildSeeds(): Seed[] {
  const rand = mulberry32(42)
  const seeds = [...FIGMA_SEEDS]
  const used = new Set(seeds.map((s) => s.name))
  while (seeds.length < CATALOG_SIZE) {
    const name = `${PREFIXES[Math.floor(rand() * PREFIXES.length)]} ${SUFFIXES[Math.floor(rand() * SUFFIXES.length)]} #${String(Math.floor(rand() * 900) + 100)}`
    if (used.has(name)) continue
    used.add(name)
    const cents = Math.floor(rand() * 1200) + 2
    const price = (cents / 100).toFixed(2)
    const onSale = rand() < 0.12
    const r = rand()
    seeds.push({
      name,
      art: ARTS[Math.floor(rand() * ARTS.length)],
      price,
      compareAt: onSale ? ((cents + 30) / 100).toFixed(2) : undefined,
      collection: COLLS[Math.floor(rand() * COLLS.length)],
      network: NETS[Math.floor(rand() * NETS.length)],
      rarity: r < 0.12 ? 'lendario' : r < 0.35 ? 'raro' : 'comum',
    })
  }
  return seeds
}

function editionsFor(index: number, rand: () => number): Edition[] {
  const one = index === 0 ? 0 : rand() < 0.5 ? 0 : 1
  return [
    { id: '1-1', label: '1/1', supply: 1, available: one },
    { id: '1-10', label: '1/10', supply: 10, available: Math.floor(rand() * 8) + 2 },
    { id: '1-50', label: '1/50', supply: 50, available: Math.floor(rand() * 30) + 20 },
    { id: 'open', label: 'ABERTA', supply: null, available: 999 },
  ]
}

export function buildCatalog(): NftDetail[] {
  const rand = mulberry32(7)
  const base = Date.parse(FIXTURE_NOW)
  return buildSeeds().map((seed, index) => {
    const id = seed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    const num = seed.name.split('#')[1] ?? String(index)
    const editions = editionsFor(index, rand)
    const image = `/nfts/${seed.art}.webp`
    const collectionLabel = COLLECTION_LABELS[seed.collection]
    return {
      id,
      name: seed.name,
      tokenId: `#0${num}`,
      image,
      imageAlt: `${seed.name}: ${ART_ALT[seed.art]}`,
      price: seed.price,
      compareAtPrice: seed.compareAt ?? null,
      collection: seed.collection,
      network: seed.network,
      rarity: seed.rarity,
      listedAt: new Date(base - index * 36 * 3600 * 1000).toISOString(),
      totalAvailable: editions.reduce((n, e) => n + e.available, 0),
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${NETWORK_LABELS[seed.network]}, com arte desbloqueável e acesso para colecionadores.`,
      longDescription: [
        `${seed.name} é uma obra digital finalizada à mão da coleção Kurio Editions (${collectionLabel}). Cada atributo fica armazenado nos metadados do token e verificado na ${NETWORK_LABELS[seed.network]}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
      ],
      gallery: [image, image, image, image],
      editions,
      attributes: ART_ATTRS[seed.art],
      collectionName: 'Kurio Apes',
      creator: 'Nova Sato',
      rating: 4.8,
      reviewsCount: 19,
      contractAddress: '0x7A42f3c1d9E0b8A6c5D4e3F2a1B0c9D8e7F619E8',
      royaltyPercent: 5,
      maxPerOrder: 10,
    } satisfies NftDetail
  })
}

export interface SeedUser {
  id: string
  email: string
  username: string
  displayName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  salt: string
  passwordHash: string
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'u_ana',
    email: 'ana@kurio.dev',
    username: 'ana.colecionadora',
    displayName: 'Ana Souza',
    ensName: 'anasouza',
    walletNickname: 'Cofre da Ana',
    avatarUrl: null,
    salt: 's-ana-7f3a',
    passwordHash: 'ec13db138545413817fbc8b0c3126182d43a55ca1e23cdf9d9701d2ac270a303',
  },
  {
    id: 'u_bruno',
    email: 'bruno@kurio.dev',
    username: 'bruno.nft',
    displayName: 'Bruno Lima',
    ensName: 'brunolima',
    walletNickname: 'Carteira do Bruno',
    avatarUrl: null,
    salt: 's-bruno-91cd',
    passwordHash: '9375b568c4f68a91f1bc9b439e77ec7ed755c13bb2c84bb164a9eca442231980',
  },
]

export function seedWallets(): Record<string, Wallet[]> {
  return {
    u_ana: [
      {
        id: 'w_ana_primary',
        slot: 'primary',
        displayName: 'Ana Souza',
        nickname: 'Cofre da Ana',
        network: 'ethereum',
        profileName: 'ana.colecionadora',
        address: '0xA91F3b2C4d5E6f708192A3b4C5d6E7f8091aE82C',
        secondaryAddress: '',
        kind: 'metamask',
        referralCode: 'KURIO-ANA',
        email: 'ana@kurio.dev',
        ensName: 'anasouza',
        updatedAt: FIXTURE_NOW,
      },
    ],
    u_bruno: [
      {
        id: 'w_bruno_primary',
        slot: 'primary',
        displayName: 'Bruno Lima',
        nickname: 'Carteira do Bruno',
        network: 'polygon',
        profileName: 'bruno.nft',
        address: '0xB0c9D8e7F6a5B4c3D2e1F0a9B8c7D6e5F4a3B2c1',
        secondaryAddress: '',
        kind: 'coinbase',
        referralCode: 'KURIO-BRU',
        email: 'bruno@kurio.dev',
        ensName: 'brunolima',
        updatedAt: FIXTURE_NOW,
      },
    ],
  }
}

export const SEED_FAVORITES: Record<string, string[]> = {
  u_ana: ['emerald-ape-042', 'ivory-baron-088'],
  u_bruno: ['golden-signal-160'],
}

export interface CouponDef {
  code: string
  percentOff: number
  description: string
  expiresAt: string
}

export const COUPONS: CouponDef[] = [
  { code: 'KURIO10', percentOff: 10, description: 'Desconto do lançamento (10%)', expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'GENESIS25', percentOff: 25, description: 'Lançamento gênesis (25%)', expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'VERAO2024', percentOff: 15, description: 'Campanha de verão', expiresAt: '2024-03-20T00:00:00.000Z' },
]

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

export const EDITION_ORDER: EditionId[] = ['1-1', '1-10', '1-50', 'open']
