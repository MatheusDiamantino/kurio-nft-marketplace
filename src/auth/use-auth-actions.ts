import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys } from '@/queries/keys'
import { guestCart, sessionStore } from './session-store'

/**
 * Login/register send the guest cart id so the server merges the visitor's
 * items into the user's cart. On success the guest cart cache is dropped and
 * the user's (merged) cart is fetched under the user's own key.
 */
export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<LoginRequest, 'guestCartId'>) => api.auth.login({ ...body, guestCartId: guestCart.get() ?? undefined }),
    onSuccess: (session) => {
      sessionStore.start(session)
      guestCart.clear()
      qc.removeQueries({ queryKey: keys.cart.of('guest') })
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<RegisterRequest, 'guestCartId'>) => api.auth.register({ ...body, guestCartId: guestCart.get() ?? undefined }),
    onSuccess: (session) => {
      sessionStore.start(session)
      guestCart.clear()
      qc.removeQueries({ queryKey: keys.cart.of('guest') })
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      // Revoke server-side, but never block local logout on network failures.
      await api.auth.logout().catch(() => undefined)
    },
    onSettled: () => sessionStore.end('logout'),
  })
}
