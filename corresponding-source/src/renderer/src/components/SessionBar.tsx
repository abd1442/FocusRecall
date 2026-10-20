import type { RunningBlock } from '@core/session'
import { runningFocusSeconds } from '@core/session'

/**
 * The progress line toward the session target. A session on one subject
 * always uses the chosen timeline focus colour, including switched subjects.
 */
export function SessionBar({
  block,
  now,
  className = 'h-1.5'
}: {
  block: RunningBlock
  now: number
  /** Legacy caller accent; timeline colour now comes from Settings. */
  accent: string
  className?: string
}): React.JSX.Element {
  const current = runningFocusSeconds(block, now)
  const segments = [
    ...block.parts.map((p) => ({ key: p.id, color: 'var(--tf-line-focus)', seconds: p.focusSeconds })),
    { key: block.id, color: 'var(--tf-line-focus)', seconds: current }
  ]
  const total = segments.reduce((s, x) => s + x.seconds, 0)
  const scale = Math.max(block.targetSeconds, total, 1)
  const mixed = block.parts.length > 0
  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(Math.min(1, total / Math.max(1, block.targetSeconds)) * 100)}
    >
      {mixed ? (
        segments.map((s) => <div key={s.key} className="h-full transition-[width] duration-700" style={{ width: `${(s.seconds / scale) * 100}%`, background: s.color }} />)
      ) : (
        <div className="h-full rounded-full transition-[width,background-color] duration-700" style={{ width: `${Math.min(1, total / Math.max(1, block.targetSeconds)) * 100}%`, background: 'var(--tf-line-focus)' }} />
      )}
    </div>
  )
}
