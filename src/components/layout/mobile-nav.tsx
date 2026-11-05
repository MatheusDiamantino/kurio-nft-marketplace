import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, UserRound } from 'lucide-react'
import { useUser } from '@/auth/use-session'
import { useCart } from '@/queries/cart'
import { cn } from '@/lib/utils'
import { CartButton, Logo } from './header'

/** Compact top bar for small screens (pages without their own mobile hero). */
export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Home and NFT detail draw their own mobile chrome (search bar / hero) per the Figma.
  // Login/Cadastro mobile are full-screen with their own big logo.
  // Cart and checkout have their own mobile header (back button + title) per the Figma mobile frames.
  const own = ['/', '/login', '/register', '/cart', '/checkout']
  if (own.includes(pathname) || pathname.startsWith('/nft/')) return null
  return (
    <div className="flex h-14 items-center justify-between border-b border-line px-4 md:hidden">
      <Logo />
      <CartButton />
    </div>
  )
}

const ITEM = 'flex size-12 flex-col items-center justify-center gap-0.5 rounded-sm text-[10px] text-sand hover:text-brand-accent'

export function MobileTabBar() {
  const user = useUser()
  const { data } = useCart()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const count = data?.itemCount ?? 0
  const active = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p))

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="relative mx-auto flex h-[72px] max-w-md items-center justify-around px-4">
        <li>
          <Link to="/" className={cn(ITEM, active('/') && 'text-brand')} aria-current={active('/') ? 'page' : undefined}>
            <House className="size-5" aria-hidden />
            Início
          </Link>
        </li>
        <li>
          <Link
            to="/account/favorites"
            className={cn(ITEM, active('/account/favorites') && 'text-brand')}
            aria-current={active('/account/favorites') ? 'page' : undefined}
          >
            <Heart className="size-5" aria-hidden />
            Favoritos
          </Link>
        </li>
        <li className="-mt-10">
          <button
            type="button"
            onClick={() => {
              void navigate({ to: '/', hash: 'catalogo' }).then(() => document.getElementById('mobile-search')?.focus())
            }}
            className="grid size-16 place-items-center rounded-full border-4 border-ink bg-brand text-ink shadow-lg hover:bg-brand-accent"
            aria-label="Explorar coleções"
          >
            <ScanLine className="size-6" aria-hidden />
          </button>
        </li>
        <li>
          <Link to="/cart" className={cn(ITEM, 'relative', active('/cart') && 'text-brand')} aria-label={`Carrinho, ${count} itens`}>
            <ShoppingCart className="size-5" aria-hidden />
            Carrinho
            {count > 0 && (
              <span className="absolute top-0 right-1 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 text-ink">{count}</span>
            )}
          </Link>
        </li>
        <li>
          <Link
            to={user ? '/account/profile' : '/login'}
            className={cn(ITEM, (active('/account/profile') || active('/account/wallets') || active('/login')) && 'text-brand')}
          >
            <UserRound className="size-5" aria-hidden />
            {user ? 'Perfil' : 'Entrar'}
          </Link>
        </li>
      </ul>
    </nav>
  )
}
