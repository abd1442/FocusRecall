import { useEffect, useState } from 'react'
import { useSession } from './store/session'

/** Current time in ms, refreshed on an interval while `active`. */
export function useNow(active = true, intervalMs = 250): number {
  const offset = useSession(s => s.state.clockOffsetMs ?? 0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    let id: ReturnType<typeof setInterval> | undefined
    const sync = (): void => {
      clearInterval(id)
      id = undefined
      if (document.hidden) return
      setNow(Date.now())
      id = setInterval(() => setNow(Date.now()), intervalMs)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    const off = window.api.on('clock:changed', sync)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', sync); off() }
  }, [active, intervalMs])
  return now + offset
}

/** Global key handler for the lifetime of a component. */
export function useKey(handler: (e: KeyboardEvent) => void, deps: unknown[]): void {
  useEffect(() => {
    const guarded = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.repeat || e.isComposing || document.querySelector('dialog[open], [role=dialog][aria-modal=true]')) return
      handler(e)
    }
    window.addEventListener('keydown', guarded)
    return () => window.removeEventListener('keydown', guarded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
