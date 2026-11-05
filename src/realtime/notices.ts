import { useSyncExternalStore } from 'react'

/**
 * Live notices produced by realtime events that the user must see where it
 * matters (cart / checkout): "price of X changed from A to B", "X sold out".
 */
export interface LiveNotice {
  id: string
  nftId: string
  kind: 'price' | 'availability'
  message: string
  at: number
}

let notices: LiveNotice[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export const noticeStore = {
  push(notice: LiveNotice) {
    notices = [...notices.filter((n) => !(n.nftId === notice.nftId && n.kind === notice.kind)), notice].slice(-6)
    emit()
  },
  dismiss(id: string) {
    notices = notices.filter((n) => n.id !== id)
    emit()
  },
  clear() {
    if (notices.length === 0) return
    notices = []
    emit()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  get: () => notices,
}

export function useLiveNotices() {
  return useSyncExternalStore(noticeStore.subscribe, noticeStore.get, noticeStore.get)
}
