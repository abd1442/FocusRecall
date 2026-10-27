import { useId, useRef, useState } from 'react'
import { gridDestination } from '@core/gridNavigation'
import { t } from '../i18n'
const isRtl = (): boolean => document.documentElement.dir === 'rtl'

/** One Tab stop; arrows explore without invoking the cell's action. */
export function useGridNavigation(rows: (string | null)[][], initial: string) {
  const ref = useRef<HTMLDivElement>(null), helpId = useId()
  const [remembered, remember] = useState(initial)
  const active = rows.some(r => r.includes(remembered)) ? remembered : initial
  const help = <p id={helpId} className="sr-only">{t('Use arrow keys to explore. Home and End move to the row edges; Ctrl+Home and Ctrl+End move to the grid edges.')}</p>
  const cellProps = (key: string) => ({
    'data-grid-key': key,
    tabIndex: key === active ? 0 : -1,
    onFocus: () => remember(key),
    onKeyDown: (e: React.KeyboardEvent) => {
      // Leave screen-reader/browser modifier commands alone.
      if (e.altKey || e.metaKey || e.shiftKey || (e.ctrlKey && e.key !== 'Home' && e.key !== 'End')) return
      const next = gridDestination(rows, key, e.key, isRtl(), e.ctrlKey)
      if (next === null) return
      e.preventDefault()
      ref.current?.querySelector<HTMLElement>(`[data-grid-key="${CSS.escape(next)}"]`)?.focus()
    }
  })
  return { ref, helpId, help, cellProps }
}
