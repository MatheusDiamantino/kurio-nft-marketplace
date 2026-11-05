import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { API_BASE_URL, HEADERS, type ApiErrorBody, type ApiErrorCode } from './contracts'
import { guestCart, sessionStore } from '@/auth/session-store'

/** Normalised error for every REST failure (HTTP, network, timeout, abort). */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(params: { status: number; code: ApiErrorCode; message: string; fields?: Record<string, string>; details?: unknown }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.fields = params.fields ?? {}
    this.details = params.details
  }

  /** Failures where retrying the same request is safe and may succeed. */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status === 503 || this.status === 502 || this.status === 504 || this.status === 500
  }

  get isAuthError() {
    return this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHENTICATED'
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const session = sessionStore.get()
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  const cartId = guestCart.get()
  if (!session && cartId) config.headers.set(HEADERS.cartId, cartId)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    const apiError = toApiError(error)
    // A request made *with* a token that comes back 401 means the session is
    // gone: drop it everywhere (cache, sockets) — the app layer reacts.
    const hadToken = error instanceof AxiosError && !!error.config?.headers?.Authorization
    if (apiError.isAuthError && hadToken) sessionStore.expire(apiError.code)
    return Promise.reject(apiError)
  },
)

function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'A requisição demorou demais para responder.' })
    }
    if (!error.response) {
      return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor. Verifique sua internet.' })
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined
    if (body?.error?.code) {
      return new ApiError({ status: error.response.status, ...body.error })
    }
    return new ApiError({
      status: error.response.status,
      code: error.response.status >= 500 ? 'INTERNAL_ERROR' : 'NOT_FOUND',
      message: 'Algo deu errado. Tente novamente.',
    })
  }
  return new ApiError({ status: 0, code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Erro inesperado.' })
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}
