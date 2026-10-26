import { useEffect, useRef, useState } from 'react'

/** Tracks an element's content width (charts render to measured width, so no scaled text). */
export function useWidth<T extends HTMLElement = HTMLDivElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Keyboard activation for SVG marks acting as buttons. */
export const onActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}
