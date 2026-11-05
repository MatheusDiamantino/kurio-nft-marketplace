import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { useUser } from '@/auth/use-session'
import { keys } from './keys'

export function useFavorites() {
  const user = useUser()
  return useQuery({
    queryKey: keys.private.favorites(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: !!user,
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

/**
 * Optimistic toggle with rollback: the heart flips immediately; if the API
 * fails, the previous cache snapshot is restored and the user is told why.
 */
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
