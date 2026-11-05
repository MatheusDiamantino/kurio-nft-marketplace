import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart, X } from 'lucide-react'
import { useUser } from '@/auth/use-session'
import { Avatar } from '@/components/avatar'
import { SoonLink } from '@/components/soon'
import { useCart } from '@/queries/cart'
import { cn } from '@/lib/utils'

export function scrollToCatalog() {
  const el = document.getElementById('catalogo')
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.1em] text-cream', className)} aria-label="Kurio, página inicial">
      KURIO
    </Link>
  )
}

export function CartButton({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link
      to="/cart"
      className={cn('relative inline-flex size-10 items-center justify-center rounded-sm text-cream hover:text-brand-accent', className)}
      aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
    >
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-medium text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const id = useId()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    void navigate({ to: '/', search: q ? { q } : {}, hash: 'catalogo' })
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-sm text-cream hover:text-brand-accent"
        aria-label="Abrir busca"
        aria-expanded={false}
        aria-controls={id}
      >
        <Search className="size-6" aria-hidden />
      </button>
    )
  }
  return (
    <form role="search" onSubmit={submit} className="flex items-center gap-1" id={id}>
      <label htmlFor={`${id}-input`} className="sr-only">
        Buscar NFTs
      </label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Buscar NFTs..."
        className="h-9 w-48 rounded-sm border border-line-soft bg-surface px-3 text-sm text-cream placeholder:text-tan focus:border-brand-accent"
      />
      <button type="submit" className="inline-flex size-9 items-center justify-center text-cream hover:text-brand-accent" aria-label="Buscar">
        <Search className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="inline-flex size-9 items-center justify-center text-sand hover:text-brand-accent"
        aria-label="Fechar busca"
      >
        <X className="size-4" aria-hidden />
      </button>
    </form>
  )
}

const NAV_CLASS =
  'relative py-2 text-[15px] text-cream transition-colors hover:text-brand-accent after:absolute after:inset-x-0 after:-bottom-[17px] after:h-0.5 after:rounded-full after:bg-transparent'

export function Header() {
  const user = useUser()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isHome = pathname === '/'
  const isMarket = pathname.startsWith('/nft') || pathname.startsWith('/cart') || pathname.startsWith('/checkout')

  return (
    <header className="hidden md:block">
      <div className="container-page flex h-[68px] items-center justify-between gap-6 border-b border-line-soft">
        <Logo />
        <nav aria-label="Principal">
          <ul className="flex items-center gap-8">
            <li>
              <Link
                to="/"
                className={cn(NAV_CLASS, isHome && 'font-bold text-brand after:bg-brand')}
                aria-current={isHome ? 'page' : undefined}
                activeOptions={{ exact: true, includeSearch: false }}
              >
                Início
              </Link>
            </li>
            <li>
              <Link
                to="/"
                hash="catalogo"
                onClick={() => {
                  if (isHome) requestAnimationFrame(() => scrollToCatalog())
                }}
                className={cn(NAV_CLASS, isMarket && 'font-bold text-brand after:bg-brand')}
                aria-current={isMarket ? 'page' : undefined}
              >
                Mercado
              </Link>
            </li>
            <li>
              <SoonLink label="Criadores" className={NAV_CLASS} />
            </li>
            <li>
              <SoonLink label="Aprenda" className={NAV_CLASS} />
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <HeaderSearch />
          <CartButton />
          {user ? (
            <Link
              to="/account/profile"
              className="ml-2 inline-flex items-center gap-2 rounded-sm px-1 py-1 text-sm text-cream hover:text-brand-accent"
            >
              <span aria-hidden>
                <Avatar user={user} size={32} />
              </span>
              <span className="max-w-32 truncate">{user.displayName}</span>
              <span className="sr-only">, minha conta</span>
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ redirect: pathname === '/login' ? undefined : pathname }}
              className="ml-2 inline-flex h-[34px] items-center gap-1.5 rounded-sm bg-brand px-2.5 text-base font-medium text-ink hover:bg-brand-accent"
            >
              <LogIn className="size-5" aria-hidden />
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
