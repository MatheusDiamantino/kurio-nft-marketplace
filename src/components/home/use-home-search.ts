import { useMatch, useNavigate } from '@tanstack/react-router'
import type { HomeSearch } from '@/routes/search'

const EMPTY: HomeSearch = {}

export function useHomeSearch() {
  const match = useMatch({ from: '/', shouldThrow: false })
  const search: HomeSearch = match?.search ?? EMPTY
  const navigate = useNavigate()

  const update = (patch: Partial<HomeSearch>, opts: { replace?: boolean } = {}) =>
    navigate({
      to: '/',
      search: (prev: HomeSearch) => ({ ...prev, ...patch, page: undefined }),
      replace: opts.replace,
      resetScroll: false,
    })

  const setPage = (page: number) =>
    navigate({ to: '/', search: (prev: HomeSearch) => ({ ...prev, page: page > 1 ? page : undefined }), resetScroll: false })

  const clear = () => navigate({ to: '/', search: {}, resetScroll: false })

  return { search, update, setPage, clear }
}

export function toggleIn<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
  const set = new Set(list ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort() : undefined
}
