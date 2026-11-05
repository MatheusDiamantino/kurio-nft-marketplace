import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { getConfig, latencyFor, nextCount } from './config'
import { lookupSession } from './db'

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown } = {},
) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

export function bearer(request: Request) {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/** Returns the authenticated user or a 401 response. */
export function requireAuth(request: Request) {
  const token = bearer(request)
  if (getConfig().scenario === 'session-expired' && token) {
    return { response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') } as const
  }
  const lookup = lookupSession(token)
  if (lookup.status === 'expired') {
    return { response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') } as const
  }
  if (lookup.status === 'missing') {
    return { response: apiError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.') } as const
  }
  return { user: lookup.user, session: lookup.session } as const
}

/** Optional auth: user when the token is valid, null otherwise (never errors). */
export function optionalUser(request: Request) {
  const lookup = lookupSession(bearer(request))
  return lookup.status === 'valid' ? lookup.user : null
}

/**
 * Wraps a resolver with the configured network conditions:
 * offline, latency profiles, out-of-order catalog and "flaky" first attempts.
 */
export function withNetwork<P extends PathParams, B extends DefaultBodyType>(
  kind: 'catalog' | 'default',
  resolver: HttpResponseResolver<P, B>,
): HttpResponseResolver<P, B> {
  return async (info) => {
    const { scenario } = getConfig()
    const ms = latencyFor(kind)
    if (ms > 0) await delay(ms)

    if (scenario === 'offline') return HttpResponse.error()

    if (scenario === 'flaky' && info.request.method === 'GET') {
      const url = new URL(info.request.url)
      const attempt = nextCount(`flaky:${url.pathname}${url.search}`)
      if (attempt === 1) {
        return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
      }
    }
    return resolver(info)
  }
}
