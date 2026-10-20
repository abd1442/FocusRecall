import type { Rating as RatingValue } from '@core/blocks'
import { radioKeyboard } from './radioKeyboard'

interface Props {
  label: string
  value: RatingValue | null
  onChange: (v: RatingValue | null) => void
  /** Accent colour for the selected dots. */
  accent?: string
  lowHint?: string
  highHint?: string
}

/**
 * A 1 to 5 rating. When the group has keyboard focus, number keys 1 to 5 set
 * it and 0 or Backspace clears it. Clicking the selected value clears it.
 */
export function Rating({ label, value, onChange, accent = 'var(--tf-focus)', lowHint, highHint }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-medium text-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="-m-1 flex w-fit items-center gap-2 rounded-full p-1 outline-offset-0"
        onKeyDown={(e) => {
          radioKeyboard(e)
          if (/^[1-5]$/.test(e.key)) {
            e.preventDefault()
            onChange(Number(e.key) as RatingValue)
          } else if (e.key === '0' || e.key === 'Backspace') {
            e.preventDefault()
            onChange(null)
          }
        }}
      >
        {lowHint && <span className="mr-1 text-sm text-muted">{lowHint}</span>}
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const on = value !== null && n <= value
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              tabIndex={(value ?? 1) === n ? 0 : -1}
              onClick={() => onChange(value === n ? null : n)}
              className={`grid size-11 place-items-center rounded-full border text-base tabular-nums transition-colors ${
                on ? 'border-transparent text-on-accent font-semibold' : 'border-line text-muted hover:border-muted'
              }`}
              style={on ? { background: accent } : undefined}
            >
              {n}
            </button>
          )
        })}
        {highHint && <span className="ml-1 text-sm text-muted">{highHint}</span>}
      </div>
    </div>
  )
}
