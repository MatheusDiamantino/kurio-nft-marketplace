import type { QueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { REALTIME_URL, type NftUpdatedEvent, type OrderUpdatedEvent, type RealtimeHandshakeAuth } from '@/api/contracts'
import { sessionStore } from '@/auth/session-store'
import { keys } from '@/queries/keys'
import { EventApplier } from './apply-event'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

interface ServerToClient {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'session.invalid': (payload: { reason: string }) => void
}
type ClientToServer = Record<string, never>

export class RealtimeClient {
  private socket: Socket<ServerToClient, ClientToServer> | null = null
  private epoch = -1
  private status: RealtimeStatus = 'idle'
  private statusListeners = new Set<(s: RealtimeStatus) => void>()
  private hasConnectedOnce = false
  private readonly applier: EventApplier

  private readonly qc: QueryClient

  constructor(qc: QueryClient) {
    this.qc = qc
    this.applier = new EventApplier(qc, () => sessionStore.get()?.user.id ?? null)
  }

  start() {
    this.sync()
    return sessionStore.subscribe(() => this.sync())
  }

  stop() {
    this.teardown()
  }

  getStatus() {
    return this.status
  }

  onStatus(listener: (s: RealtimeStatus) => void) {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private setStatus(s: RealtimeStatus) {
    if (this.status === s) return
    this.status = s
    for (const l of this.statusListeners) l(s)
  }

  private sync() {
    const snap = sessionStore.snapshot()
    if (snap.epoch === this.epoch && this.socket) return
    this.teardown()
    this.epoch = snap.epoch
    this.connect(snap.session?.token ?? null, snap.epoch)
  }

  private teardown() {
    if (!this.socket) return
    this.socket.removeAllListeners()
    this.socket.io.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.hasConnectedOnce = false
    this.applier.reset()
    this.setStatus('idle')
  }

  private connect(token: string | null, epoch: number) {
    this.setStatus('connecting')
    
    const auth: RealtimeHandshakeAuth = { token }
    const socket: Socket<ServerToClient, ClientToServer> = io(REALTIME_URL, {
      transports: ['websocket'],
      auth,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    })
    this.socket = socket

    const current = () => this.socket === socket && sessionStore.snapshot().epoch === epoch

    socket.on('connect', () => {
      if (!current()) return
      this.setStatus('connected')
      if (this.hasConnectedOnce) this.reconcile()
      this.hasConnectedOnce = true
    })
    socket.on('disconnect', (reason) => {
      if (!current()) return
      
      this.setStatus(reason === 'io client disconnect' ? 'idle' : 'reconnecting')
    })
    socket.on('connect_error', () => {
      if (!current()) return
      this.setStatus(this.hasConnectedOnce ? 'reconnecting' : 'offline')
    })
    socket.on('nft.updated', (event) => {
      if (current()) this.applier.apply(event)
    })
    socket.on('order.updated', (event) => {
      if (current()) this.applier.apply(event)
    })
  }

  reconcile() {
    void this.qc.invalidateQueries({ queryKey: keys.catalog.all, refetchType: 'active' })
    void this.qc.invalidateQueries({ queryKey: keys.cart.all, refetchType: 'active' })
    void this.qc.invalidateQueries({ queryKey: keys.quote.all, refetchType: 'active' })
    const uid = sessionStore.get()?.user.id
    if (uid) void this.qc.invalidateQueries({ queryKey: keys.private.orders(uid), refetchType: 'active' })
  }
}
