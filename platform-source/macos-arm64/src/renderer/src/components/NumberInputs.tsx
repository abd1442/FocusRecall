import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { formatTime, parseTime, stepTime, typeTime, type TimeShape } from '@core/timeinput'
import { inputBase } from './ui'

const selectAll = (e: React.FocusEvent<HTMLInputElement>): void => {
  // Typing replaces the whole value. (Deferred, so the click that focused the field does not undo it.)
  const el = e.currentTarget
  setTimeout(() => el.select(), 0)
}

/**
 * A time or a length. The colon appears by itself ("1230" shows "12:30"),
 * "130" becomes "1:30" on leaving the field, Up and Down step by a minute
 * (Shift: five), and the whole value is selected on focus.
 *
 * shape 'hm': minutes (a length, or a clock time with `pad`). shape 'hms':
 * seconds (a video timestamp).
 */
export function TimeInput({
  value,
  onChange,
  shape = 'hm',
  pad = false,
  min = 0,
  max,
  placeholder,
  label,
  className = 'w-28'
}: {
  value: number | null
  onChange: (v: number | null) => void
  shape?: TimeShape
  pad?: boolean
  min?: number
  max?: number
  placeholder?: string
  label?: string
  className?: string
}): React.JSX.Element {
  const show = (v: number | null): string => (v === null ? '' : formatTime(v, shape, pad))
  const [text, setText] = useState(show(value))
  useEffect(() => setText(show(value)), [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (v: number): number => Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, v))
  const commit = (): void => {
    const v = parseTime(text, shape)
    if (v === null) {
      if (value !== null) onChange(null)
      setText('')
      return
    }
    const c = clamp(v)
    setText(show(c))
    if (c !== value) onChange(c)
  }
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      className={`${inputBase} text-right tabular-nums ${className}`}
      value={text}
      onFocus={selectAll}
      onChange={(e) => setText(typeTime(e.target.value, shape))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const next = clamp(stepTime(parseTime(text, shape) ?? value, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey, shape, min, max))
          setText(show(next))
          onChange(next)
        }
      }}
    />
  )
}

/**
 * A plain number (pages, problems, cards) with small minus and plus buttons.
 * The whole value is selected on focus; Up and Down step it too.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  label,
  size = 'md',
  className = 'w-24'
}: {
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  min?: number
  max?: number
  label?: string
  size?: 'md' | 'lg'
  className?: string
}): React.JSX.Element {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => setText(value === null ? '' : String(value)), [value])
  const clamp = (v: number): number => Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, v))
  const commit = (raw = text): void => {
    if (raw.trim() === '') {
      if (value !== null) onChange(null)
      return
    }
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n)) return setText(value === null ? '' : String(value))
    const c = clamp(n)
    setText(String(c))
    if (c !== value) onChange(c)
  }
  const bump = (d: 1 | -1): void => {
    const next = clamp(Math.round(((value ?? 0) + d * step) * 1000) / 1000)
    setText(String(next))
    onChange(next)
  }
  const btn = `grid ${size === 'lg' ? 'h-13 w-11' : 'size-11'} shrink-0 place-items-center rounded-lg border border-line text-lg text-muted transition hover:border-muted hover:text-ink`
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" aria-label={uiText("Less{value0}", {value0: (label ? ` ${label}` : '')})} className={btn} onClick={() => bump(-1)}>
        −
      </button>
      <input
        inputMode="decimal"
        aria-label={label}
        className={`${inputBase} px-2 text-center tabular-nums ${size === 'lg' ? 'h-13 py-0 text-2xl' : ''} ${className}`}
        style={size === 'lg' ? { fontSize: '1.5rem' } : undefined}
        value={text}
        onFocus={selectAll}
        onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            bump(e.key === 'ArrowUp' ? 1 : -1)
          }
        }}
      />
      <button type="button" aria-label={uiText("More{value0}", {value0: (label ? ` ${label}` : '')})} className={btn} onClick={() => bump(1)}>
        +
      </button>
    </span>
  )
}
