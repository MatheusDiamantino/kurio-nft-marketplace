import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { useUser } from '@/auth/use-session'
import { keys } from './keys'

export const favoritesQuery = (uid: string) =>
  queryOptions({
    queryKey: keys.private.favorites(uid),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
  })

export function useFavorites() {
  const user = useUser()
  return useQuery({ ...favoritesQuery(user?.id ?? 'anonymous'), enabled: !!user })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

export function useToggleFavorite() {
  const user = useUser()
  const qc = useQueryClient()
  const key = keys.private.favorites(user?.id ?? 'anonymous')

  return useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, on }: { nftId: string; on: boolean; name: string }) =>
      on ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, on }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (on) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids], items: (old?.items ?? []).filter((i) => on || i.id !== nftId) }
      })
      return { previous }
    },
    onError: (error, { name, on }, context) => {
      qc.setQueryData(key, context?.previous)
      toast.error(on ? `Não foi possível favoritar ${name}.` : `Não foi possível remover ${name} dos favoritos.`, {
        description: error.message,
      })
    },
    onSuccess: (_data, { name, on }) => {
      toast.success(on ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
