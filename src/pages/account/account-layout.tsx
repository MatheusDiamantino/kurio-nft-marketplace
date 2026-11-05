import type { ComponentType, SVGProps } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ChartLine, Download, Heart, LogOut, MapPin, ShoppingCart, TriangleAlert, UserRound } from 'lucide-react'
import { useLogout } from '@/auth/use-auth-actions'
import { notifySoon } from '@/components/soon'
import { cn } from '@/lib/utils'

type Icon = ComponentType<SVGProps<SVGSVGElement>>
type Item = { label: string; icon: Icon } & ({ to: '/account/profile' | '/account/wallets' | '/account/favorites' } | { soon: true })

const ITEMS: Item[] = [
  { label: 'Dados do perfil', icon: UserRound, to: '/account/profile' },
  { label: 'Carteiras', icon: MapPin, to: '/account/wallets' },
  { label: 'Atividade', icon: ShoppingCart, soon: true },
  { label: 'Lista de interesse', icon: Heart, to: '/account/favorites' },
  { label: 'Ofertas', icon: ChartLine, soon: true },
  { label: 'Arquivos baixados', icon: Download, soon: true },
  { label: 'Suporte', icon: TriangleAlert, soon: true },
]

const itemClass =
  'relative flex h-[45px] shrink-0 items-center gap-3 px-4 text-[15px] whitespace-nowrap text-brand transition-colors hover:text-brand-accent md:px-4'

export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()

  return (
    <div className="container-page grid gap-6 py-6 md:grid-cols-[250px_1fr] md:gap-7 md:py-8 lg:grid-cols-[310px_1fr]">
      <aside className="min-w-0 self-start bg-surface">
        <h2 className="hidden px-2.5 pt-4 pb-2 text-lg font-bold text-cream md:block">Meu perfil</h2>
        <nav aria-label="Minha conta">
          <ul className="scrollbar-none flex overflow-x-auto md:flex-col md:overflow-visible">
            {ITEMS.map((item) => {
              const Icon = item.icon
              if ('soon' in item) {
                return (
                  <li key={item.label}>
                    <button type="button" onClick={() => notifySoon(item.label)} aria-describedby="soon-hint" className={cn(itemClass, 'w-full')}>
                      <Icon className="size-[18px]" aria-hidden />
                      {item.label}
                    </button>
                  </li>
                )
              }
              const active = pathname.startsWith(item.to)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      itemClass,
                      active &&
                        'font-medium text-brand-accent after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-brand md:after:inset-x-auto md:after:inset-y-0 md:after:left-0 md:after:h-auto md:after:w-[5px]',
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              )
            })}
            <li className="md:mt-0 md:border-t md:border-line-soft">
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className={cn(itemClass, 'w-full font-bold')}
              >
                <LogOut className="size-5" aria-hidden />
                {logout.isPending ? 'Saindo…' : 'Sair'}
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
