import { useEffect, useMemo, useState } from 'react'
import { addReason, orderReasons, type ReasonOption } from '@core/distractions'
import { useSettings } from './session'

/**
 * The distraction reasons, most used first with "Other" last, and a way to
 * turn typed "Other" text into a reason of its own.
 */
export function useReasons(): { all: ReasonOption[]; ordered: ReasonOption[]; add: (label: string) => Promise<string> } {
  const all = useSettings((s) => s.settings.distractionReasons)
  const set = useSettings((s) => s.set)
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    const load = (): void => void window.api.invoke('reasons:counts').then(setCounts)
    load()
    return window.api.on('distractions:changed', load)
  }, [])
  const ordered = useMemo(() => orderReasons(all, counts), [all, counts])
  const add = async (label: string): Promise<string> => {
    const { reasons, id } = addReason(useSettings.getState().settings.distractionReasons, label)
    await set('distractionReasons', reasons)
    return id
  }
  return { all, ordered, add }
}
