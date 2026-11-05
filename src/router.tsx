import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type ParsedLocation,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { sessionStore } from '@/auth/session-store'
import { RootLayout } from '@/components/layout/root-layout'
import { NotFoundPage } from '@/pages/not-found'
import { nftQuery } from '@/queries/catalog'
import { validateHomeSearch, validateRedirectSearch } from '@/routes/search'

export interface RouterContext {
  queryClient: QueryClient
}

/** Guard for private routes: send anonymous users to login, keeping where they were. */
function requireSession({ location }: { location: ParsedLocation }) {
  if (!sessionStore.get()) {
    throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateHomeSearch,
  component: lazyRouteComponent(() => import('@/pages/home'), 'HomePage'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  // Warm the cache without blocking navigation; the page renders skeletons.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQuery(params.nftId))
  },
  component: lazyRouteComponent(() => import('@/pages/nft-detail'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: lazyRouteComponent(() => import('@/pages/cart'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireSession,
  component: lazyRouteComponent(() => import('@/pages/checkout'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  beforeLoad: requireSession,
  component: lazyRouteComponent(() => import('@/pages/order'), 'OrderPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateRedirectSearch,
  component: lazyRouteComponent(() => import('@/pages/auth'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: validateRedirectSearch,
  component: lazyRouteComponent(() => import('@/pages/auth'), 'RegisterPage'),
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  beforeLoad: requireSession,
  component: lazyRouteComponent(() => import('@/pages/account/account-layout'), 'AccountLayout'),
})

const accountIndexRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/account/profile', replace: true })
  },
})

const profileRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'profile',
  component: lazyRouteComponent(() => import('@/pages/account/profile'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'wallets',
  component: lazyRouteComponent(() => import('@/pages/account/wallets'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'favorites',
  component: lazyRouteComponent(() => import('@/pages/account/favorites'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  accountRoute.addChildren([accountIndexRoute, profileRoute, walletsRoute, favoritesRoute]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Page-to-page navigation jumps to the top instantly; smooth scrolling is
    // reserved for in-page anchors (see html { scroll-behavior } in index.css).
    scrollRestorationBehavior: 'instant',
    defaultNotFoundComponent: NotFoundPage,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
