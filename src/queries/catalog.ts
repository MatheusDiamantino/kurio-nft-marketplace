import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys } from './keys'

export const catalogQuery = (q: CatalogQuery) =>
  queryOptions({
    queryKey: keys.catalog.list(q),

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
