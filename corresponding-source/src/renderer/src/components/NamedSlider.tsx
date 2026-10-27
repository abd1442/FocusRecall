import { t as uiText } from '../i18n'
import { scaleLabel, scaleStops, type ScaleConfig } from '@core/logfields'

interface Props {
  label: string
  scale: ScaleConfig
  value: number | null
  onChange: (v: number | null) => void
  accent?: string
  /** Large controls (question cards, the daily check-in). */
  large?: boolean
  /** Leave out the question above the slider (a card shows it as its title). */
  suggested?: boolean
  onConfirm?: () => void
  hideLabel?: boolean
}

/**
 * A slider with named stops. Only names are shown, never digits: the names
 * sit under the track and the current one is shown beside the label. It always
 * shows its value with the track filled up to it (the form gives it a default:
 * the last answer, or the middle). × clears it: an empty track, "Not answered".
 * Clicking a name, or the track of a cleared slider, sets it there.
 */
export function NamedSlider({ label, scale, value, onChange, accent = 'var(--tf-focus)', large = false, hideLabel = false, suggested = false, onConfirm }: Props): React.JSX.Element {
  const stops = scaleStops(scale)
  const current = scaleLabel(scale, value)
  const set = value !== null
  const pct = set ? ((value - scale.min) / (scale.max - scale.min)) * 100 : 0
  const halfThumb = large ? .975 : .75

  return (
    <div dir="ltr" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        {hideLabel ? <span /> : <span className="text-base font-medium text-muted">{label}</span>}
        <span className="flex flex-wrap items-center gap-2">
          {suggested && set && <span className="text-xs text-muted">{uiText("Suggested · not answered")}</span>}
          {suggested && set && onConfirm && <button type="button" className="rounded-lg border border-line px-3 py-1 text-sm" onClick={onConfirm}>{uiText("Keep")}</button>}
          <span className={`${large ? 'text-2xl' : 'text-lg'} font-semibold ${set ? '' : 'text-muted'}`} style={set ? { color: accent } : undefined}>
            {current ?? uiText('Not answered')}
          </span>
          {set && (
            <button type="button" aria-label={uiText("Clear {value0}", {value0: (label)})} onClick={() => onChange(null)} className="rounded-md px-1.5 text-base text-muted hover:text-ink">
              ×
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={suggested && current ? uiText('{value0} · suggested, not answered', {value0: current}) : current ?? uiText('Not answered')}
        min={scale.min}
        max={scale.max}
        step={1}
        value={set ? value : Math.round((scale.min + scale.max) / 2)}
        onPointerDown={(e) => {
          // On a cleared slider, a touch answers it where it was touched.
          if (set) return
          const r = (e.target as HTMLInputElement).getBoundingClientRect()
          const thumb = halfThumb*2*parseFloat(getComputedStyle(document.documentElement).fontSize)
          const t = Math.min(1, Math.max(0, (e.clientX - r.left - thumb/2) / Math.max(1,r.width-thumb)))
          onChange(Math.round(scale.min + t * (scale.max - scale.min)))
        }}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`named-slider w-full ${large ? 'named-slider-lg' : ''} ${set ? '' : 'named-slider-empty'}`}
        style={{ '--fill': `calc(${pct}% + ${halfThumb*(1-2*pct/100)}rem)`, '--accent': accent } as React.CSSProperties}
      />
      <div aria-hidden="true" className="relative h-1" style={{marginInline:`${halfThumb}rem`}}>{stops.map(s=><span key={s.label} className="absolute top-0 h-1 w-px bg-line" style={{left:`${(s.value-scale.min)/(scale.max-scale.min)*100}%`}}/>)}</div>
      <div className="relative grid" role="group" aria-label={uiText("{value0} answers", {value0: (label)})}>
        {stops.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onChange(s.value)}
            aria-pressed={!suggested && current===s.label}
            style={{gridArea:'1 / 1',width:`${100/stops.length}%`,left:`clamp(0px, calc(${(s.value-scale.min)/(scale.max-scale.min)*100}% + ${halfThumb*(1-2*(s.value-scale.min)/(scale.max-scale.min))}rem - ${50/stops.length}%), calc(100% - ${100/stops.length}%))`}}
            className={`relative px-1 ${s.value===scale.min?'text-left':s.value===scale.max?'text-right':'text-center'} text-sm leading-snug transition-colors ${current === s.label ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
