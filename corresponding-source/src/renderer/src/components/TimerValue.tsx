import { useLayoutEffect, useRef, type CSSProperties } from 'react'

/** Keep translated status words inside the approved timer geometry.
 * Numeric clocks and labels that already fit retain their authored typography. */
export function TimerValue({ value, className, style, role, fit }: {
  value: string; className: string; style?: CSSProperties; role?: 'timer'; fit: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !fit) return
    const ring = el.closest<HTMLElement>('.fr-ring')
    const container = ring ?? el.parentElement
    if (!container) return
    const resize = (): void => {
      el.style.removeProperty('font-size')
      const width = el.getBoundingClientRect().width
      const available = container.getBoundingClientRect().width * (ring ? 0.78 : 1)
      if (width > available && available > 0) {
        const size = parseFloat(getComputedStyle(el).fontSize)
        el.style.setProperty('font-size', `${size * available / width}px`, 'important')
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    const appearance = new MutationObserver(resize)
    appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    document.fonts.addEventListener('loadingdone', resize)
    return () => {
      observer.disconnect()
      appearance.disconnect()
      document.fonts.removeEventListener('loadingdone', resize)
      el.style.removeProperty('font-size')
    }
  }, [value, className, fit])
  return <span ref={ref} className={className} style={style} role={role} aria-live="off">{value}</span>
}
