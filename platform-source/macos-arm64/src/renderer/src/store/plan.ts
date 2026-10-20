import { useMemo } from 'react'
import { adaptiveTarget, type AdaptiveSuggestion } from '@core/modes'
import type { TimerMode } from '@core/timer'
import type { Id, Item } from '@core/types'
import { useBlocks } from './blocks'
import { useLibrary } from './library'
import { useSettings } from './session'

export const MODES: { value: TimerMode; label: string; hint: string }[] = [
  { value: 'flow', label: 'Flow', hint: 'Counts up toward a target and keeps going. Finish when you are ready.' },
  { value: 'fixed', label: 'Fixed', hint: 'Counts down from a set length, then shows the overtime.' },
  { value: 'adaptive', label: 'Adaptive', hint: 'Like Flow, with a target learned from your good blocks on this subject.' }
]

export interface NextBlockPlan {
  subject: Item | null
  setSubject: (id: Id) => void
  mode: TimerMode
  setMode: (m: TimerMode) => void
  /** The length the next block uses in its mode. */
  targetSeconds: number
  suggestion: AdaptiveSuggestion | null
}

/**
 * The next block: the last subject and mode chosen, and the target for that
 * mode (Flow: the default target, Fixed: its countdown, Adaptive: the
 * suggestion unless an override was typed for this subject).
 */
export function useNextBlockPlan(adaptiveOverrideMinutes: number | null = null): NextBlockPlan {
  const settings = useSettings((s) => s.settings)
  const set = useSettings((s) => s.set)
  const items = useLibrary((s) => s.items)
  const blocks = useBlocks((s) => s.blocks)
  const subject = items.find((i) => i.id === settings.lastItemId && !i.archived) ?? null
  const mode: TimerMode = settings.lastTimerMode ?? settings.defaultTimerMode

  const suggestion = useMemo(
    () => (subject ? adaptiveTarget(blocks, subject.id, settings.focusTargetMinutes * 60) : null),
    [blocks, subject, settings.focusTargetMinutes]
  )

  let targetSeconds = settings.focusTargetMinutes * 60
  if (mode === 'fixed') targetSeconds = settings.fixedMinutes * 60
  if (mode === 'adaptive') targetSeconds = adaptiveOverrideMinutes ? adaptiveOverrideMinutes * 60 : (suggestion?.targetSeconds ?? targetSeconds)

  return {
    subject,
    setSubject: (id) => void set('lastItemId', id),
    mode,
    setMode: (m) => void set('lastTimerMode', m),
    targetSeconds,
    suggestion
  }
}
