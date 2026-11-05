import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/client'

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
