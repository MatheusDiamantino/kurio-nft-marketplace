import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/client'

/**
 * Cache policy (documented in ARCHITECTURE.md):
 * - staleTime 30s: catalog/detail are kept fresh by Socket.IO; REST refetches
 *   on mount/focus/reconnect after that window.
 * - retries: only transient failures (network, timeout, 5xx), max 2, with
 *   exponential backoff. 4xx are never retried. Mutations never auto-retry;
 *   order creation implements its own idempotent retry.
 * - gcTime 5 min.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => isApiError(error) && error.isTransient && !error.isAuthError && failureCount < 2,
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const queryClient = createQueryClient()
