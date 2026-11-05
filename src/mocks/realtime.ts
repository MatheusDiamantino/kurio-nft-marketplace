import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import { REALTIME_URL, type NftUpdatedEvent, type RealtimeEvent } from '@/api/contracts'
import { findNft, getRecentEvents, lookupSession, onEvent } from './db'

/**
 * Socket.IO server simulated with MSW's WebSocket interception +
 * @mswjs/socket.io-binding. The real `socket.io-client` in the app connects to
 * REALTIME_URL using the `websocket` transport; MSW intercepts the socket in
 * the page and this module plays the server side of the Engine.IO/Socket.IO
 * protocol (handshake is answered by the binding; heartbeats by us).
 *
 * Events are produced exclusively by mutations of the mock DB (db.ts), so the
 * REST state and the pushed events never diverge.
 */

interface LiveConnection {
  id: string
  token: string | null
  userId: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
  isClosed: () => boolean
}

const connections = new Map<string, LiveConnection>()
let down = false
let seq = 0

const HEARTBEAT_MS = 20_000

function canReceive(conn: LiveConnection, event: RealtimeEvent) {
  if (event.type === 'nft.updated') return true
  // Private events: only for a connection whose session is still valid and
  // belongs to the order owner. Prevents cross-user leakage after logout/switch.
  if (!conn.token) return false
  const lookup = lookupSession(conn.token)
  return lookup.status === 'valid' && lookup.user.id === event.data.userId
}

/** Sockets closed before the handshake don't always fire `close`: prune them lazily. */
function prune() {
  for (const [id, conn] of connections) if (conn.isClosed()) connections.delete(id)
}

function deliver(event: RealtimeEvent) {
  if (down) return
  prune()
  for (const conn of connections.values()) {
    if (canReceive(conn, event)) conn.emit(event.type, event)
  }
}

onEvent(deliver)

export const realtimeHandler = ws.link(REALTIME_URL)

export const realtimeHandlers = [
  realtimeHandler.addEventListener('connection', (connection) => {
    if (down) {
      // Simulated outage: refuse the transport so the client keeps retrying.
      queueMicrotask(() => connection.client.close(1011, 'Realtime unavailable'))
      return
    }

    const io = toSocketIo(connection)
    seq += 1
    const conn: LiveConnection = {
      id: `sock_${seq}`,
      token: null,
      userId: null,
      emit: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(),
      // WebSocket.CLOSING = 2, CLOSED = 3
      isClosed: () => ((connection.client as { socket?: WebSocket }).socket?.readyState ?? 1) >= 2,
    }
    connections.set(conn.id, conn)

    // Read the Socket.IO CONNECT packet ("40{...auth}") to authenticate.
    connection.client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
      try {
        const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string | null }
        conn.token = auth.token ?? null
        const lookup = lookupSession(conn.token)
        conn.userId = lookup.status === 'valid' ? lookup.user.id : null
        if (conn.token && lookup.status !== 'valid') {
          io.client.emit('session.invalid', { reason: lookup.status })
        }
      } catch {
        conn.token = null
      }
    })

    // Engine.IO heartbeat (the binding announces pingInterval=25s).
    const heartbeat = setInterval(() => {
      try {
        connection.client.send('2')
      } catch {
        clearInterval(heartbeat)
      }
    }, HEARTBEAT_MS)

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(conn.id)
    })
  }),
]

// ---------------------------------------------------------------------------
// Control surface (used by the mock panel and by Playwright via window.__kurio)
// ---------------------------------------------------------------------------

/** Drop every live socket and refuse new ones until `restoreRealtime()`. */
export function dropRealtime() {
  down = true
  for (const conn of connections.values()) conn.close()
  connections.clear()
}

export function restoreRealtime() {
  down = false
}

export function isRealtimeDown() {
  return down
}

export function connectionCount() {
  prune()
  return connections.size
}

/** Re-deliver an already-published event (duplicate delivery). */
export function replayEvent(eventId?: string) {
  const events = getRecentEvents()
  const event = eventId ? events.find((e) => e.id === eventId) : events[events.length - 1]
  if (event) deliver(event)
  return event ?? null
}

/**
 * Deliver an out-of-date `nft.updated` (version lower than the current one)
 * carrying a bogus price. A correct client must ignore it.
 */
export function sendStaleNftEvent(nftId: string) {
  const nft = findNft(nftId)
  if (!nft) return null
  const stale: NftUpdatedEvent = {
    id: `evt_stale_${Date.now()}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: Math.max(0, nft.version - 1),
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    data: {
      price: '999.99',
      compareAtPrice: null,
      editions: nft.editions.map((e) => ({ id: e.id, available: 0 })),
      totalAvailable: 0,
    },
  }
  deliver(stale)
  return stale
}
