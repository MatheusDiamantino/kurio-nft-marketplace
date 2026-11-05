import { useCallback } from 'react'

export function useDragScroll<T extends HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return
    let startX = 0
    let startScroll = 0
    let pointerId: number | null = null
    let moved = false

    const snapToNearest = () => {
      if (getComputedStyle(el).scrollSnapType === 'none') return
      const items = Array.from(el.children) as HTMLElement[]
      const padding = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0
      const base = el.getBoundingClientRect().left + padding
      let target = el.scrollLeft
      let best = Infinity
      for (const item of items) {
        const offset = item.getBoundingClientRect().left - base
        if (Math.abs(offset) < best) {
          best = Math.abs(offset)
          target = el.scrollLeft + offset
        }
      }
      el.scrollTo({ left: target, behavior: 'smooth' })
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return
      pointerId = e.pointerId
      startX = e.clientX
      startScroll = el.scrollLeft
      moved = false
    }

    const onMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) < 5) return
      if (!moved) {
        moved = true
        el.setPointerCapture(e.pointerId)
        el.style.scrollSnapType = 'none'
        el.style.scrollBehavior = 'auto'
        el.style.cursor = 'grabbing'
        el.style.userSelect = 'none'
      }
      el.scrollLeft = startScroll - dx
    }

    const onUp = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      pointerId = null
      if (!moved) return
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      el.style.cursor = ''
      el.style.userSelect = ''
      el.style.scrollBehavior = ''
      snapToNearest()
      window.setTimeout(() => {
        el.style.scrollSnapType = ''
      }, 400)
    }

    const onClick = (e: MouseEvent) => {
      if (!moved) return
      e.preventDefault()
      e.stopPropagation()
      moved = false
    }

    const onDragStart = (e: DragEvent) => e.preventDefault()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClick, true)
    el.addEventListener('dragstart', onDragStart)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('dragstart', onDragStart)
    }
  }, [])
}
