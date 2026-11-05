import { useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { EditionId, NftDetail } from '@/api/contracts'
import { useUser } from '@/auth/use-session'
import { useAddToCart } from '@/queries/cart'
import { useIsFavorite, useToggleFavorite } from '@/queries/favorites'

export function usePurchase(nft: NftDetail) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = useUser()
  const add = useAddToCart()
  const isFavorite = useIsFavorite(nft.id)
  const toggle = useToggleFavorite()

  const firstAvailable = nft.editions.find((e) => e.available > 0)?.id ?? null
  const [editionId, setEditionId] = useState<EditionId | null>(firstAvailable)
  const [rawQty, setQty] = useState(1)

  const edition = nft.editions.find((e) => e.id === editionId) ?? null
  const available = edition?.available ?? 0
  const max = Math.max(0, Math.min(available, nft.maxPerOrder))
  const quantity = max === 0 ? 1 : Math.min(Math.max(1, rawQty), max)

  const [prevMax, setPrevMax] = useState(max)
  const [notice, setNotice] = useState('')
  if (max !== prevMax) {
    setPrevMax(max)
    if (edition && max < prevMax) {
      setNotice(
        max === 0
          ? `A edição ${edition.label} acabou de esgotar.`
          : rawQty > max
            ? `Disponibilidade atualizada: quantidade ajustada para ${max}.`
            : `Disponibilidade atualizada: restam ${available} unidade(s).`,
      )
      if (rawQty > max && max > 0) setQty(max)
    }
  }

  const allSoldOut = nft.editions.every((e) => e.available === 0)
  const blockedReason = allSoldOut
    ? 'Esgotado'
    : !edition
      ? 'Selecione uma edição'
      : available === 0
        ? `A edição ${edition.label} está esgotada`
        : null

  const addToCart = (goToCart: boolean) => {
    if (!edition || blockedReason) return
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity, name: nft.name },
      { onSuccess: () => goToCart && void navigate({ to: '/cart' }) },
    )
  }

  const toggleFavorite = () => {
    if (!user) {
      void navigate({ to: '/login', search: { redirect: pathname } })
      return
    }
    toggle.mutate({ nftId: nft.id, on: !isFavorite, name: nft.name })
  }

  return {
    edition,
    editionId,
    setEditionId: (id: EditionId) => {
      setEditionId(id)
      setNotice('')
    },
    quantity,
    setQuantity: setQty,
    max,
    available,
    notice,
    blockedReason,
    adding: add.isPending,
    addToCart,
    isFavorite,
    toggleFavorite,
    favoritePending: toggle.isPending,
  }
}

export type Purchase = ReturnType<typeof usePurchase>
