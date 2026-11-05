import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, EditionId, Network } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { useCartOwner } from '@/auth/use-session'
import { keys } from './keys'

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: keys.cart.of(owner),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  })
}

/** Writes the authoritative cart returned by a mutation and refreshes quotes. */
function useCartWriter() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return (cart: Cart) => {
    qc.setQueryData(keys.cart.of(owner), cart)
    void qc.invalidateQueries({ queryKey: keys.quote.all })
  }
}

export function useAddToCart() {
  const write = useCartWriter()
  return useMutation({
    mutationKey: ['cart', 'add'],
    mutationFn: (v: { nftId: string; editionId: EditionId; quantity: number; name: string }) =>
      api.cart.add({ nftId: v.nftId, editionId: v.editionId, quantity: v.quantity }),
    onSuccess: (cart, v) => {
      write(cart)
      toast.success(`${v.name} adicionado ao carrinho.`, { description: `${v.quantity} unidade(s).` })
    },
    onError: (error) => toast.error('Não foi possível adicionar ao carrinho.', { description: error.message }),
  })
}

/**
 * Quantity changes are optimistic: the line updates instantly and is rolled
 * back if the server refuses (e.g. availability dropped meanwhile).
 */
export function useUpdateCartItem() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  const write = useCartWriter()
  const key = keys.cart.of(owner)
  return useMutation({
    mutationKey: ['cart', 'update'],
    mutationFn: (v: { nftId: string; editionId: EditionId; quantity: number }) => api.cart.update(v.nftId, v.editionId, v.quantity),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) {
        qc.setQueryData<Cart>(key, {
          ...previous,
          lines: previous.lines.map((l) => (l.nftId === v.nftId && l.editionId === v.editionId ? { ...l, quantity: v.quantity } : l)),
        })
      }
      return { previous }
    },
    onError: (error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      toast.error('Não foi possível alterar a quantidade.', { description: error.message })
      void qc.invalidateQueries({ queryKey: key })
    },
    onSuccess: write,
  })
}

export function useRemoveCartItem() {
  const write = useCartWriter()
  return useMutation({
    mutationKey: ['cart', 'remove'],
    mutationFn: (v: { nftId: string; editionId: EditionId; name: string }) => api.cart.remove(v.nftId, v.editionId),
    onSuccess: (cart, v) => {
      write(cart)
      toast.success(`${v.name} removido do carrinho.`)
    },
    onError: (error) => toast.error('Não foi possível remover o item.', { description: error.message }),
  })
}

export function useApplyCoupon() {
  const write = useCartWriter()
  return useMutation({
    mutationKey: ['cart', 'coupon', 'apply'],
    mutationFn: (code: string) => api.cart.applyCoupon(code),
    onSuccess: (cart) => {
      write(cart)
      toast.success(`Cupom ${cart.coupon?.code} aplicado.`)
    },
  })
}

export function useRemoveCoupon() {
  const write = useCartWriter()
  return useMutation({
    mutationKey: ['cart', 'coupon', 'remove'],
    mutationFn: () => api.cart.removeCoupon(),
    onSuccess: (cart) => {
      write(cart)
      toast.success('Cupom removido.')
    },
    onError: (error) => toast.error('Não foi possível remover o cupom.', { description: error.message }),
  })
}

/** Server-side quote (subtotal, discount, fee, total) for the current cart version. */
export function useQuote(network: Network, options: { enabled?: boolean } = {}) {
  const owner = useCartOwner()
  const { data: cart } = useCart()
  return useQuery({
    queryKey: keys.quote.of(owner, network, cart?.version ?? 0),
    queryFn: ({ signal }) => api.quote.create(network, { signal }),
    enabled: (options.enabled ?? true) && !!cart && cart.lines.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  })
}
