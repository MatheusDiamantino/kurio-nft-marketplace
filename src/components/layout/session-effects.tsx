import { useEffect, useRef } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { sessionStore } from '@/auth/session-store'
import { useSessionSnapshot } from '@/auth/use-session'
import { keys } from '@/queries/keys'
import { noticeStore } from '@/realtime/notices'
import { PRIVATE_PATH_PREFIXES } from '@/routes/paths'

export function SessionEffects() {
  const snap = useSessionSnapshot()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const lastEpoch = useRef(snap.epoch)
  const lastUserId = useRef(snap.session?.user.id ?? null)

  const token = snap.session?.token
  const check = useQuery({
    queryKey: ['session-check', token],
    queryFn: ({ signal }) => api.auth.session({ signal }),
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  })
  useEffect(() => {
    if (check.data && check.data.token === sessionStore.get()?.token) sessionStore.updateUser(check.data.user)
  }, [check.data])

  useEffect(() => {
    if (snap.epoch === lastEpoch.current) return
    lastEpoch.current = snap.epoch
    const previousUser = lastUserId.current
    const nextUser = snap.session?.user.id ?? null
    lastUserId.current = nextUser

    if (previousUser !== nextUser) {
      qc.removeQueries({ queryKey: keys.private.all })
      qc.removeQueries({ queryKey: keys.quote.all })
      qc.removeQueries({ queryKey: ['session-check'] })
      if (previousUser) qc.removeQueries({ queryKey: keys.cart.of(previousUser) })
      noticeStore.clear()
      
      void qc.invalidateQueries({ queryKey: keys.cart.all })
    }

    const isPrivate = PRIVATE_PATH_PREFIXES.some((p) => pathname.startsWith(p))
    const end = snap.lastEnd
    if (!snap.session && end?.reason === 'expired') {
      toast.warning('Sua sessão expirou.', { description: 'Entre novamente para continuar de onde parou.' })
      if (isPrivate) void navigate({ to: '/login', search: { redirect: href }, replace: true })
    } else if (!snap.session && end?.reason === 'logout') {
      toast.success('Você saiu da sua conta.')
      if (isPrivate) void navigate({ to: '/', replace: true })
    }
  }, [snap, qc, navigate, href, pathname])

  return null
}
