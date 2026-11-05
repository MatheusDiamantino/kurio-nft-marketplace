import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangePasswordRequest, Order, UpdateProfileRequest, UpsertWalletRequest, User, Wallet, WalletSlot } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { sessionStore } from '@/auth/session-store'
import { useUser } from '@/auth/use-session'
import { keys } from './keys'

function useUserId() {
  return useUser()?.id ?? 'anonymous'
}

export function useProfile() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.private.profile(uid),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: uid !== 'anonymous',
  })
}

function useProfileWriter() {
  const qc = useQueryClient()
  const uid = useUserId()
  return (user: User) => {
    qc.setQueryData(keys.private.profile(uid), user)
    sessionStore.updateUser(user)
  }
}

export function useUpdateProfile() {
  const write = useProfileWriter()
  return useMutation({ mutationFn: (body: UpdateProfileRequest) => api.profile.update(body), onSuccess: write })
}

export function useSetAvatar() {
  const write = useProfileWriter()
  return useMutation({ mutationFn: (dataUrl: string) => api.profile.setAvatar(dataUrl), onSuccess: write })
}

export function useRemoveAvatar() {
  const write = useProfileWriter()
  return useMutation({ mutationFn: () => api.profile.removeAvatar(), onSuccess: write })
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: ChangePasswordRequest) => api.profile.changePassword(body) })
}

export function useWallets() {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.private.wallets(uid),
    queryFn: ({ signal }) => api.wallets.list({ signal }),
    enabled: uid !== 'anonymous',
    select: (d) => d.items,
  })
}

export function useUpsertWallet() {
  const qc = useQueryClient()
  const uid = useUserId()
  return useMutation({
    mutationFn: ({ slot, body }: { slot: WalletSlot; body: UpsertWalletRequest }) => api.wallets.upsert(slot, body),
    onSuccess: (wallet) => {
      qc.setQueryData<{ items: Wallet[] }>(keys.private.wallets(uid), (old) => {
        const items = (old?.items ?? []).filter((w) => w.slot !== wallet.slot)
        return { items: [...items, wallet].sort((a) => (a.slot === 'primary' ? -1 : 1)) }
      })
    },
  })
}

export function useOrder(orderId: string) {
  const uid = useUserId()
  return useQuery({
    queryKey: keys.private.order(uid, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, { signal }),
    enabled: uid !== 'anonymous',
    // Socket.IO pushes status changes; this slow poll is only a safety net
    // while the order is pending (e.g. realtime transport unavailable).
    refetchInterval: (q) => ((q.state.data as Order | undefined)?.status === 'pending' ? 15_000 : false),
  })
}
