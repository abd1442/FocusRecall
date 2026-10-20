import { t } from '../i18n'
import { TimerValue } from './TimerValue'
import './circularTimer.css'

export type RingTone = 'focus' | 'overtime' | 'rest' | 'recall' | 'idle'

const R = 52
const C = 2 * Math.PI * R

/**
 * Circular timer: a tinted track, a stage-coloured progress arc with a leading
 * marker, and the session clock's own digits in the centre. Purely a view; the
 * digits and progress come from the session clock.
 */
export function CircularTimer({ value, caption, progress, tone = 'focus', dim = false, size = 'panel', label }: {
  value: string
  /** One short line under the digits ("of 25:00", "over 25:00", "away 02:13"). */
  caption?: string
  progress: number
  tone?: RingTone
  /** Distracted: the clock is stopped. */
  dim?: boolean
  size?: 'panel' | 'compact' | 'preview'
  /** Accessible name when the value is a word rather than a time. */
  label?: string
}): React.JSX.Element {
  const p = Math.max(0, Math.min(1, progress))
  const colour = tone === 'idle' ? 'var(--tf-muted)' : `var(--fr-stage-${tone})`
  const ink = tone === 'overtime' ? 'var(--fr-stage-overtime-text)' : 'var(--tf-text)'
  const timed = /\d/.test(value)
  const angle = p * 2 * Math.PI - Math.PI / 2
  const marker = tone !== 'idle' && tone !== 'recall' && p > 0.05 && p < 1
  return <div dir="ltr" role="timer" aria-live="off" data-tone={tone} data-dim={dim || undefined}
    aria-label={label ?? `${t(tone === 'overtime' ? 'Overtime' : 'Time remaining')}: ${value}`}
    className={`fr-ring fr-ring-${size}`}>
    <svg aria-hidden="true" viewBox="0 0 120 120" className="fr-ring-svg">
      <circle cx="60" cy="60" r={R} className="fr-ring-track" style={{ stroke: `color-mix(in srgb, ${colour} var(--fr-ring-tint), var(--tf-surface))` }} />
      {p > 0 && <circle cx="60" cy="60" r={R} className="fr-ring-arc" transform="rotate(-90 60 60)"
        style={{ stroke: colour, strokeDasharray: `${C} ${C}`, strokeDashoffset: C * (1 - p) }} />}
      {marker && <circle cx={60 + R * Math.cos(angle)} cy={60 + R * Math.sin(angle)} r="4.6" className="fr-ring-marker" style={{ fill: colour }} />}
    </svg>
    <div className="fr-ring-face">
      <TimerValue value={value} fit={!timed} className={`fr-ring-value font-timer tabular-nums ${timed ? '' : 'fr-ring-word'}`} style={{ color: ink }} />
      {caption && <span dir="auto" className="fr-ring-caption">{caption}</span>}
    </div>
  </div>
}
