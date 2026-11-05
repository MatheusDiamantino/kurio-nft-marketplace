import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { keys } from '@/queries/keys'
import { guestCart, sessionStore } from './session-store'

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
      await api.auth.logout().catch(() => undefined)
    },
    onSettled: () => sessionStore.end('logout'),
  })
}
