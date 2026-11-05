import type { ApiErrorCode, Session } from '@/api/contracts'

/**
 * Minimal external store for the session token. Lives outside React so the
 * Axios interceptor and the Socket.IO manager can read it synchronously.
 * Only the opaque token, its expiry and the public user profile are persisted
 * (never passwords).
 */

const SESSION_KEY = 'kurio.session'
const CART_KEY = 'kurio.guestCartId'

export type SessionEndReason = 'logout' | 'expired' | 'switch'

export interface SessionSnapshot {
  session: Session | null
  /** Bumps on every login/logout/expiry — used to isolate per-session resources. */
  epoch: number
  lastEnd: { reason: SessionEndReason; code?: ApiErrorCode; at: number } | null
}

type Listener = (snapshot: SessionSnapshot) => void

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.token || !parsed.user?.id) return null
    if (Date.parse(parsed.expiresAt) <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

let snapshot: SessionSnapshot = { session: readSession(), epoch: 0, lastEnd: null }
const listeners = new Set<Listener>()

function emit(next: SessionSnapshot) {
  snapshot = next
  try {
    if (next.session) localStorage.setItem(SESSION_KEY, JSON.stringify(next.session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore storage failures */
  }
  for (const l of listeners) l(snapshot)
}

export const sessionStore = {
  get: () => snapshot.session,
  snapshot: () => snapshot,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** New session (login / register). Treated as a user switch if one existed. */
  start(session: Session) {
    const previous = snapshot.session
    emit({
      session,
      epoch: snapshot.epoch + 1,
      lastEnd: previous && previous.user.id !== session.user.id ? { reason: 'switch', at: Date.now() } : snapshot.lastEnd,
    })
  },
  /** Refresh the stored profile (e.g. after editing it) without changing epoch. */
  updateUser(user: Session['user']) {
    if (!snapshot.session) return
    emit({ ...snapshot, session: { ...snapshot.session, user } })
  },
  end(reason: SessionEndReason) {
    if (!snapshot.session) return
    emit({ session: null, epoch: snapshot.epoch + 1, lastEnd: { reason, at: Date.now() } })
  },
  expire(code: ApiErrorCode) {
    if (!snapshot.session) return
    emit({ session: null, epoch: snapshot.epoch + 1, lastEnd: { reason: 'expired', code, at: Date.now() } })
  },
}

// Keep tabs in sync: logging out in one tab logs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_KEY) return
    const next = readSession()
    if (next?.token === snapshot.session?.token) return
    emit({
      session: next,
      epoch: snapshot.epoch + 1,
      lastEnd: next ? snapshot.lastEnd : { reason: 'logout', at: Date.now() },
    })
  })
}

export const guestCart = {
  get(): string | null {
    try {
      return localStorage.getItem(CART_KEY)
    } catch {
      return null
    }
  },
  set(id: string) {
    try {
      localStorage.setItem(CART_KEY, id)
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(CART_KEY)
    } catch {
      /* ignore */
    }
  },
}
