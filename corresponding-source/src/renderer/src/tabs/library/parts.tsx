import { formatDuration } from '../../i18n'
import { t as uiText } from '../../i18n'
import { SubjectCardAccent, subjectPanelStyle } from '../../components/SubjectPanel'
import type { CategoryTotals } from '@core/library'
import { FirstHoursBadge, StageBar, useSubjectStage } from '../../components/Stage'

import type { Category, Item, ItemStats } from '@core/types'
import { Button, Menu, lastStudied } from '../../components/ui'
import { useLibrary } from '../../store/library'
import { useSettings } from '../../store/session'
import { useUi } from '../../store/ui'

/** A tint of a colour over the surface, for tile backgrounds. */
export const tint = (color: string, pct: number): string => `color-mix(in srgb, ${color} ${pct}%, var(--tf-surface))`

export function TileGrid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-5">{children}</div>
}

/** Breadcrumb plus page actions. */
export function PageHeader({
  crumbs,
  children
}: {
  crumbs: { label: string; onClick?: () => void }[]
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-center gap-4">
      <nav aria-label={uiText("Breadcrumb")} className="flex min-w-0 flex-1 items-center gap-3 text-3xl font-semibold">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-3">
            {i > 0 && <span className="text-muted">›</span>}
            {c.onClick ? (
              <button type="button" onClick={c.onClick} className="truncate text-muted hover:text-ink">
                {c.label}
              </button>
            ) : (
              <span dir="auto" className="truncate">
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      {children}
    </header>
  )
}

/** Underlined view tabs inside a page. */
export function ViewTabs<T extends string>({
  value,
  onChange,
  tabs
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: string; count?: number }[]
}): React.JSX.Element {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`-mb-px min-h-12 border-b-2 px-4 text-base transition-colors ${
            value === t.value ? 'border-focus font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {uiText(t.label)}
          {t.count ? <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-sm text-muted">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function CategoryTile({
  category: c,
  totals,
  subCount,
  onOpen,
  menu
}: {
  category: Category
  totals: CategoryTotals | undefined
  subCount: number
  onOpen: () => void
  menu: React.ComponentProps<typeof Menu>['items']
}): React.JSX.Element {
  const t = totals ?? { focusSeconds: 0, blocks: 0, lastStudiedAt: null, subjects: 0 }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      style={subjectPanelStyle(c.color)}
      className={`subject-colour-card relative flex min-h-44 cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 pt-7 transition hover:-translate-y-0.5 hover:shadow-lg ${
        c.archived ? 'opacity-55' : ''
      }`}
    >
      <SubjectCardAccent/>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="text-2xl leading-tight font-bold tracking-tight">
            {c.name}
          </h3>
          <p className="mt-1.5 text-base text-muted">
            {t.subjects} {t.subjects === 1 ? uiText("subject") : uiText("subjects")}
            {subCount ? ` · ${subCount} ${subCount === 1 ? 'group' : 'groups'}` : ''}
            {c.archived ? uiText(" · archived") : ''}
          </p>
        </div>
        <Menu label={`Options for ${c.name}`} items={menu} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        {t.focusSeconds ? (
          <div className="min-w-0">
            <div className="text-2xl font-semibold whitespace-nowrap tabular-nums">{formatDuration(t.focusSeconds)}</div>
            <div className="text-sm text-muted">{lastStudied(t.lastStudiedAt)}</div>
          </div>
        ) : (
          <div className="text-base text-muted">{uiText("Nothing studied yet")}</div>
        )}
      </div>
    </div>
  )
}

export function PinButton({ item }: { item: Item }): React.JSX.Element {
  const toggle = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await window.api.invoke('library:setItemPinned', item.id, !item.pinned)
    await useLibrary.getState().refresh()
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={item.pinned}
      aria-label={item.pinned ? uiText("Unpin {value0}", {value0: (item.name)}) : uiText("Pin {value0} to Home", {value0: (item.name)})}
      title={item.pinned ? uiText("Pinned to Home") : uiText("Pin to Home")}
      className={`grid size-10 place-items-center rounded-lg text-xl hover:bg-surface-2 ${item.pinned ? 'text-overtime' : 'text-muted hover:text-ink'}`}
    >
      {item.pinned ? '★' : '☆'}
    </button>
  )
}

/** Set the subject for the next block and go where Start is. */
export function useStartSession(): (item: Item) => Promise<void> {
  const set = useSettings((s) => s.set)
  const setTab = useUi((s) => s.setTab)
  return async (item) => {
    await set('lastItemId', item.id)
    setTab('home')
  }
}

export function SubjectTile({
  item,
  stats,
  onOpen,
  menu
}: {
  item: Item
  stats: ItemStats | undefined
  onOpen: () => void
  menu: React.ComponentProps<typeof Menu>['items']
}): React.JSX.Element {
  const startSession = useStartSession()
  const pct = item.totalUnits && stats ? Math.min(100, (stats.progress / item.totalUnits) * 100) : null
  const stage = useSubjectStage(item.id)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onOpen())}
      style={subjectPanelStyle(item.color)}
      className={`subject-colour-card relative flex min-h-52 cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 pl-7 transition hover:-translate-y-0.5 hover:shadow-lg ${
        item.archived ? 'opacity-55' : ''
      }`}
    >
      <SubjectCardAccent/>
      <h3 dir="auto" className="min-w-0 break-words text-2xl leading-snug font-semibold tracking-tight">
        {item.name}
      </h3>

      {pct !== null && (
        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
          </div>
          <div className="mt-1.5 text-sm text-muted">
            {Math.round(stats?.progress ?? 0)}{uiText(" of ")}{item.totalUnits} {item.defaultUnit}
          </div>
        </div>
      )}

      {stage && (stats?.focusSeconds || item.hoursBefore > 0) ? (
        <div className="mt-4">
          {stage.stage.first && (
            <div className="mb-2">
              <FirstHoursBadge stage={stage.stage} />
            </div>
          )}
          <StageBar hours={stage.hours} stage={stage.stage} color={`color-mix(in srgb, ${item.color} 70%, transparent)`} compact />
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pt-5">
        {stats?.focusSeconds ? (
          <div>
            <div className="text-lg font-semibold whitespace-nowrap tabular-nums">{formatDuration(stats.focusSeconds)}</div>
            <div className="text-sm text-muted">{lastStudied(stats.lastStudiedAt)}</div>
          </div>
        ) : (
          <div className="text-base text-muted">{uiText("Not started")}</div>
        )}
        <div className="flex items-center gap-1">
          <PinButton item={item} />
          <Menu label={`Options for ${item.name}`} items={menu} />
          <span className="flex-1"/>
          {!item.archived && (
          <Button
            variant="quiet"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              void startSession(item)
            }}
          >{uiText("Start session")}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
