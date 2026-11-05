import {
  COLLECTIONS,
  NETWORKS,
  SORTS,
  TABS,
  type CatalogQuery,
  type CatalogSort,
  type CatalogTab,
  type CollectionSlug,
  type Network,
} from '@/api/contracts'
import { isValidEth } from '@/lib/eth'

export interface HomeSearch {
  q?: string
  collection?: CollectionSlug[]
  network?: Network[]
  min?: string
  max?: string
  sort?: CatalogSort
  tab?: CatalogTab
  page?: number
}

function list<T extends string>(raw: unknown, allowed: readonly T[]): T[] | undefined {
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const out = values.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v))
  return out.length ? [...new Set(out)].sort() : undefined
}

function oneOf<T extends string>(raw: unknown, allowed: readonly T[]): T | undefined {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined
}

function price(raw: unknown): string | undefined {
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : ''
  return s && isValidEth(s) ? s : undefined
}

export function validateHomeSearch(search: Record<string, unknown>): HomeSearch {
  const q = typeof search.q === 'string' ? search.q.slice(0, 80) : typeof search.q === 'number' ? String(search.q) : undefined
  const page = Number(search.page)
  const sort = oneOf(search.sort, SORTS)
  const tab = oneOf(search.tab, TABS)
  return {
    q: q?.trim() ? q : undefined,
    collection: list(search.collection, COLLECTIONS),
    network: list(search.network, NETWORKS),
    min: price(search.min),
    max: price(search.max),
    sort: sort === 'recent' ? undefined : sort,
    tab: tab === 'all' ? undefined : tab,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

export const PAGE_SIZE = 9

export function toCatalogQuery(s: HomeSearch): CatalogQuery {
  return {
    q: s.q,
    collections: s.collection,
    networks: s.network,
    minPrice: s.min,
    maxPrice: s.max,
    sort: s.sort ?? 'recent',
    tab: s.tab ?? 'all',
    page: s.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export interface RedirectSearch {
  redirect?: string
}

export function validateRedirectSearch(search: Record<string, unknown>): RedirectSearch {
  const r = search.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? { redirect: r } : {}
}
