// The learning stage of a subject or a whole field (round 4 section 3), from
// tracked focus plus the hours before A14 Pomodoro. Shown on tiles, the subject
// and category pages and the Home setup card.
import { categoryAndChildren } from '@core/library'
import { stageFor, stageLine, hoursLabel, type Stage } from '@core/learning'
import type { Id } from '@core/types'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/session'

/** Hours and stage of one subject. */
export function useSubjectStage(itemId: Id | null | undefined): { hours: number; stage: Stage } | null {
  const items = useLibrary((s) => s.items)
  const stats = useLibrary((s) => s.stats)
  const stages = useSettings((s) => s.settings.learningStages)
  const item = items.find((i) => i.id === itemId)
  if (!item) return null
  const hours = item.hoursBefore + (stats.get(item.id)?.focusSeconds ?? 0) / 3600
  return { hours, stage: stageFor(hours, stages) }
}

/** Hours and stage of a whole field: a category with its sub-categories. */
export function useFieldStage(categoryId: Id | null | undefined): { hours: number; stage: Stage } | null {
  const items = useLibrary((s) => s.items)
  const categories = useLibrary((s) => s.categories)
  const stats = useLibrary((s) => s.stats)
  const stages = useSettings((s) => s.settings.learningStages)
  if (categoryId === null || categoryId === undefined) return null
  const ids = new Set(categoryAndChildren(categories, categoryId))
  const hours = items.filter((i) => ids.has(i.categoryId)).reduce((h, i) => h + i.hoursBefore + (stats.get(i.id)?.focusSeconds ?? 0) / 3600, 0)
  return { hours, stage: stageFor(hours, stages) }
}

/** The small "First 20 hours" badge while it applies (nothing later). */
export function FirstHoursBadge({ stage }: { stage: Stage }): React.JSX.Element | null {
  if (!stage.first) return null
  return <span className="inline-flex items-center rounded-full border border-focus/40 bg-focus/10 px-2.5 py-0.5 text-sm whitespace-nowrap text-focus">{stage.name}</span>
}

/** A bar toward the next threshold with "7 h 40 of your first 20 hours". */
export function StageBar({ hours, stage, color = 'var(--tf-focus)', compact = false }: { hours: number; stage: Stage; color?: string; compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {!compact && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium">{stage.name}</span>
          <FirstHoursBadge stage={stage} />
        </div>
      )}
      {stage.untilHours !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(stage.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={stage.name}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, stage.progress * 100)}%`, background: color }} />
        </div>
      )}
      <span className="text-sm text-muted">{stageLine(hours, stage)}</span>
    </div>
  )
}

export { hoursLabel }
