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
import { RouteError, RoutePending } from '@/components/layout/route-status'
import { NotFoundPage } from '@/pages/not-found'
import { orderQuery, profileQuery, walletsQuery } from '@/queries/account'
import { cartQuery } from '@/queries/cart'
import { nftQuery } from '@/queries/catalog'
import { favoritesQuery } from '@/queries/favorites'
import { validateHomeSearch, validateRedirectSearch } from '@/routes/search'

export interface RouterContext {
  queryClient: QueryClient
}

const cartOwner = () => sessionStore.get()?.user.id ?? 'guest'
const userId = () => sessionStore.get()?.user.id

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
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQuery(params.nftId))
  },
  component: lazyRouteComponent(() => import('@/pages/nft-detail'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(cartQuery(cartOwner()))
  },
  component: lazyRouteComponent(() => import('@/pages/cart'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(cartQuery(cartOwner()))
    const uid = userId()
    if (uid) {
      void context.queryClient.prefetchQuery(profileQuery(uid))
      void context.queryClient.prefetchQuery(walletsQuery(uid))
    }
  },
  component: lazyRouteComponent(() => import('@/pages/checkout'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  beforeLoad: requireSession,
  loader: ({ context, params }) => {
    const uid = userId()
    if (uid) void context.queryClient.prefetchQuery(orderQuery(uid, params.orderId))
  },
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
  loader: ({ context }) => {
    const uid = userId()
    if (uid) void context.queryClient.prefetchQuery(profileQuery(uid))
  },
  component: lazyRouteComponent(() => import('@/pages/account/profile'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'wallets',
  loader: ({ context }) => {
    const uid = userId()
    if (uid) void context.queryClient.prefetchQuery(walletsQuery(uid))
  },
  component: lazyRouteComponent(() => import('@/pages/account/wallets'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'favorites',
  loader: ({ context }) => {
    const uid = userId()
    if (uid) void context.queryClient.prefetchQuery(favoritesQuery(uid))
  },
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
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 600,
    defaultErrorComponent: RouteError,
    defaultViewTransition: {
      types: ({ fromLocation, pathChanged }) => (fromLocation && pathChanged ? ['page'] : false),
    },
    scrollRestoration: true,
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
