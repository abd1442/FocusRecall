import { useState } from 'react'
import { fillSliderDefaults, type LogValues, type Section } from '@core/logfields'
import { useLogSchema } from '../../store/logSchema'

/**
 * Answers for a form with sliders. Every slider starts with a value (the one
 * given, else the middle stop) and counts as untouched until it is moved.
 * `alreadyUntouched` keeps earlier untouched marks (editing a saved log).
 */
export function useSliderForm(
  initial: LogValues,
  sections: Section[],
  alreadyUntouched: number[] = []
): { values: LogValues; untouched: number[]; update: (u: (prev: LogValues) => LogValues, confirmed?: number[]) => void; confirm: (ids:number[])=>void } {
  const schema = useLogSchema((s) => s.schema)
  const [state, setState] = useState(() => {
    const d = fillSliderDefaults(schema, initial, sections)
    return { values: d.values, untouched: [...new Set([...d.untouched.filter((id) => initial[id] === undefined), ...alreadyUntouched])] }
  })
  const update = (u: (prev: LogValues) => LogValues, confirmed:number[]=[]): void =>
    setState((s) => {
      const next = u(s.values)
      return { values: next, untouched: s.untouched.filter((id) => next[id] === s.values[id] && !confirmed.includes(id)) }
    })
  return { values: state.values, untouched: state.untouched, update, confirm: ids => setState(s=>({...s,untouched:s.untouched.filter(id=>!ids.includes(id))})) }
}
