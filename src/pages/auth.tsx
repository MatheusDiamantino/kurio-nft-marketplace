import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { Session } from '@/api/contracts'
import { useSession } from '@/auth/use-session'
import { LoginForm, RegisterForm, SocialLogin, type AuthVariant } from '@/components/auth/auth-forms'
import { useMediaQuery } from '@/components/auth/use-media-query'
import { cn } from '@/lib/utils'
import { HomePage } from '@/pages/home'
import { PRIVATE_PATH_PREFIXES } from '@/routes/paths'

type Mode = 'login' | 'register'

const COPY: Record<Mode, { title: string; subtitle: string; mobileTitle: string }> = {
  login: {
    title: 'Entrar na Kurio',
    subtitle: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    mobileTitle: 'Entrar',
  },
  register: {
    title: 'Criar conta na Kurio',
    subtitle: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    mobileTitle: 'Criar perfil de colecionador',
  },
}

function useRedirectTarget() {
  const search = useSearch({ strict: false }) as { redirect?: string }
  const redirect = typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : undefined
  return redirect
}

function useAuthFlow() {
  const navigate = useNavigate()
  const redirect = useRedirectTarget()
  const session = useSession()

  const go = (replace = true) => {
    const to = redirect ?? '/'
    void navigate({ to, replace, viewTransition: to !== '/' })
  }
  const isPrivateTarget = !!redirect && PRIVATE_PATH_PREFIXES.some((p) => redirect.startsWith(p))

  useEffect(() => {
    if (session) void navigate({ to: redirect ?? '/', replace: true })
  }, [session, navigate, redirect])

  const onSuccess = (s: Session) => {
    toast.success(`Bem-vindo(a), ${s.user.displayName}!`)
    go()
  }
  return { redirect, onSuccess, close: () => (isPrivateTarget ? void navigate({ to: '/', viewTransition: false }) : go(false)) }
}

function ModeSwitch({ mode, redirect }: { mode: Mode; redirect?: string }) {
  const search = redirect ? { redirect } : {}
  const linkClass = (active: boolean) => cn('text-lg font-medium tracking-[0.05em] hover:text-brand-accent', active ? 'text-brand' : 'text-cream')
  return (
    <nav aria-label="Entrar ou criar conta" className="flex items-center justify-center gap-2">
      <Link to="/login" search={search} replace className={linkClass(mode === 'login')} aria-current={mode === 'login' ? 'page' : undefined}>
        Entrar
      </Link>
      <span aria-hidden className="h-6 w-px bg-brand" />
      <Link to="/register" search={search} replace className={linkClass(mode === 'register')} aria-current={mode === 'register' ? 'page' : undefined}>
        Criar conta
      </Link>
    </nav>
  )
}

function Backdrop() {
  return (
    <div aria-hidden inert className="pointer-events-none select-none">
      <HomePage />
    </div>
  )
}

const CLOSE_MS = 160

function DesktopAuth({ mode, children, onClose, redirect }: { mode: Mode; children: ReactNode; onClose: () => void; redirect?: string }) {
  const [open, setOpen] = useState(true)
  const close = () => {
    setOpen(false)
    window.setTimeout(onClose, CLOSE_MS)
  }
  return (
    <>
      <Backdrop />
      <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && close()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/60 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            data-testid="auth-dialog"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('form input')?.focus()
            }}
            className="fixed top-[max(2rem,calc(50%-330px))] left-1/2 z-50 duration-150 ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-h-[calc(100dvh-4rem)] w-[500px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-y-auto bg-surface pt-12 shadow-2xl outline-none"
          >
            <DialogPrimitive.Close
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-sm text-brand hover:text-brand-accent"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
            <DialogPrimitive.Title asChild>
              <h1 className="sr-only">{COPY[mode].title}</h1>
            </DialogPrimitive.Title>
            <ModeSwitch mode={mode} redirect={redirect} />
            <DialogPrimitive.Description className="mx-auto mt-10 mb-6 max-w-[400px] text-center text-[13px] leading-4 text-cream">
              {COPY[mode].subtitle}
            </DialogPrimitive.Description>
            {children}
            <div className="mt-6 pb-11">
              <SocialLogin variant="modal" />
            </div>
            <div className="h-2.5 bg-brand" aria-hidden />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

function MobileAuth({ mode, children, redirect }: { mode: Mode; children: ReactNode; redirect?: string }) {
  const search = redirect ? { redirect } : {}
  return (
    <section aria-labelledby="auth-title" className="mx-auto flex w-full max-w-[414px] flex-col px-7 pt-16 pb-10">
      <p className="text-center text-[34px] font-bold tracking-[0.1em] text-cream" aria-hidden>
        KURIO
      </p>
      <h1 id="auth-title" className="mt-14 mb-10 text-center text-lg font-bold text-cream">
        {COPY[mode].mobileTitle}
      </h1>
      {children}
      <div className="mt-10">
        <SocialLogin variant="page" />
      </div>
      <p className="mt-12 text-center text-[15px] text-sand">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/register" search={search} replace className="underline-offset-4 hover:text-brand-accent hover:underline">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/login" search={search} replace className="underline-offset-4 hover:text-brand-accent hover:underline">
              Entre
            </Link>
          </>
        )}
      </p>
    </section>
  )
}

function AuthPage({ mode }: { mode: Mode }) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const { redirect, onSuccess, close } = useAuthFlow()
  const variant: AuthVariant = desktop ? 'modal' : 'page'
  const form = mode === 'login' ? <LoginForm variant={variant} onSuccess={onSuccess} /> : <RegisterForm variant={variant} onSuccess={onSuccess} />

  useEffect(() => {
    document.title = `${mode === 'login' ? 'Entrar' : 'Criar conta'} | Kurio`
  }, [mode])

  return desktop ? (
    <DesktopAuth mode={mode} onClose={close} redirect={redirect}>
      {form}
    </DesktopAuth>
  ) : (
    <MobileAuth mode={mode} redirect={redirect}>
      {form}
    </MobileAuth>
  )
}

export function LoginPage() {
  return <AuthPage mode="login" />
}

export function RegisterPage() {
  return <AuthPage mode="register" />
}
