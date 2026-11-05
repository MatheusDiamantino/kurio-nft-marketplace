import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys } from './keys'

export const catalogQuery = (q: CatalogQuery) =>
  queryOptions({
    queryKey: keys.catalog.list(q),
    // The AbortSignal cancels superseded requests (fast typing / filter clicks);
    // because each param set has its own key, a late response can only land in
    // its own cache entry and never overwrite the current results.
    queryFn: ({ signal }) => api.nfts.list(q, { signal }),
    placeholderData: keepPreviousData,
  })

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: keys.catalog.detail(id),
    queryFn: ({ signal }) => api.nfts.get(id, { signal }),
  })

export function useCatalog(q: CatalogQuery) {
  return useQuery(catalogQuery(q))
}

export function useNft(id: string) {
  return useQuery(nftQuery(id))
}
