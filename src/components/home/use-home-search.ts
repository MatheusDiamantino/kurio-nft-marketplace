import { getRouteApi } from '@tanstack/react-router'
import type { HomeSearch } from '@/routes/search'

const route = getRouteApi('/')

/**
 * Catalog URL state. Every filter/sort/tab/search change resets pagination
 * (page omitted) and keeps the scroll position (resetScroll: false).
 */
export function useHomeSearch() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const update = (patch: Partial<HomeSearch>, opts: { replace?: boolean } = {}) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
      replace: opts.replace,
      resetScroll: false,
    })

  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page: page > 1 ? page : undefined }), resetScroll: false })

  const clear = () => navigate({ search: {}, resetScroll: false })

  return { search, update, setPage, clear }
}

export function toggleIn<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
  const set = new Set(list ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort() : undefined
}
