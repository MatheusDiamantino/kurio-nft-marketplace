import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { CreateOrderRequest, Order } from '@/api/contracts'
import { ApiError, isApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { useUser } from '@/auth/use-session'
import { keys } from './keys'

const attemptKey = (uid: string) => `kurio.checkout.attempt.${uid}`
const pendingKey = (uid: string) => `kurio.pendingOrder.${uid}`

interface AttemptRecord {
  key: string
  bodyHash: string
}

function hashBody(body: CreateOrderRequest) {
  return JSON.stringify(body)
}

function idempotencyKeyFor(uid: string, body: CreateOrderRequest) {
  const bodyHash = hashBody(body)
  try {
    const stored = JSON.parse(sessionStorage.getItem(attemptKey(uid)) ?? 'null') as AttemptRecord | null
    if (stored && stored.bodyHash === bodyHash) return stored.key
  } catch {
  }
  const record: AttemptRecord = { key: crypto.randomUUID(), bodyHash }
  try {
    sessionStorage.setItem(attemptKey(uid), JSON.stringify(record))
  } catch {
  }
  return record.key
}

export const pendingOrderStore = {
  get(uid: string): string | null {
    try {
      return localStorage.getItem(pendingKey(uid))
    } catch {
      return null
    }
  },
  set(uid: string, orderId: string) {
    try {
      localStorage.setItem(pendingKey(uid), orderId)
    } catch {
    }
  },
  clear(uid: string) {
    try {
      localStorage.removeItem(pendingKey(uid))
    } catch {
    }
  },
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const MAX_AUTO_RETRIES = 2

export type PlaceOrderPhase = 'idle' | 'submitting' | 'recovering' | 'failed'

export function usePlaceOrder() {
  const user = useUser()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const [phase, setPhase] = useState<PlaceOrderPhase>('idle')

  const mutation = useMutation<Order, ApiError, CreateOrderRequest>({
    mutationKey: ['orders', 'create'],
    mutationFn: async (body) => {
      if (!user) throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Entre na sua conta para continuar.' })
      const key = idempotencyKeyFor(user.id, body)
      setPhase('submitting')
      for (let attempt = 0; ; attempt++) {
        try {
          return await api.orders.create(body, key)
        } catch (error) {
          const transient = isApiError(error) && error.isTransient && !error.isAuthError
          if (transient && attempt < MAX_AUTO_RETRIES) {
            setPhase('recovering')
            await sleep(700 * (attempt + 1))
            continue
          }
          throw error
        }
      }
    },
    onSuccess: (order) => {
      if (!user) return
      pendingOrderStore.set(user.id, order.id)
      try {
        sessionStorage.removeItem(attemptKey(user.id))
      } catch {
      }
      qc.setQueryData(keys.private.order(user.id, order.id), order)
      setPhase('idle')
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id }, replace: true })
    },
    onError: (error) => {
      setPhase(isApiError(error) && error.isTransient ? 'failed' : 'idle')
    },
  })

  const submit = (body: CreateOrderRequest) => {
    if (inFlight.current || mutation.isPending) return
    inFlight.current = true
    mutation.mutate(body, {
      onSettled: () => {
        inFlight.current = false
      },
    })
  }

  return { submit, phase, error: mutation.error, isPending: mutation.isPending, reset: () => (mutation.reset(), setPhase('idle')) }
}

export function usePendingOrder() {
  const user = useUser()
  const id = user ? pendingOrderStore.get(user.id) : null
  const query = useQuery({
    queryKey: keys.private.order(user?.id ?? 'anonymous', id ?? 'none'),
    queryFn: ({ signal }) => api.orders.get(id!, { signal }),
    enabled: !!user && !!id,
    retry: false,
  })
  const order = query.data
  if (user && id && (query.isError || (order && order.status !== 'pending'))) {
    pendingOrderStore.clear(user.id)
  }
  return { order: order?.status === 'pending' ? order : null, checking: !!id && query.isPending }
}
