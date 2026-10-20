import { formatDuration , formatDate, formatTime } from '../i18n'
import { t as uiText } from '../i18n'
// Cards and lists shared by Home, the session page and the Library pages.
import { useMemo } from 'react'
import { FOCUS_WORDS, wordFor } from '@core/scales'
import type { BlockSummary } from '@core/stats'


import type { Id, Item } from '@core/types'
import { useLibrary } from '../store/library'

export function useItemsById(): Map<Id, Item> {
  const items = useLibrary((s) => s.items)
  return useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
}

export function Card({
  title,
  action,
  children,
  className = ''
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={`flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stats({ items }: { items: { label: string; value: string }[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
      {items.map((s) => (
        <div key={s.label} className="rounded-xl bg-surface-2/60 px-4 py-3">
          <div className="text-2xl font-semibold whitespace-nowrap tabular-nums">{s.value}</div>
          <div className="text-sm text-muted">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/** "1 h 05 min", or an en dash for nothing. */
export const timeOrDash = (seconds: number): string => (seconds >= 30 ? formatDuration(seconds) : '–')

const shortDay = (key: string): string => formatDate(key, { weekday: 'short' })

/** Small vertical bars. The highlighted bar (today, this week) is solid. */
export function VBars({
  bars,
  highlight,
  label
}: {
  bars: { key: string; label: string; title: string; seconds: number }[]
  highlight?: string
  label: string
}): React.JSX.Element {
  const max = Math.max(1, ...bars.map((b) => b.seconds))
  // With many bars, label every other one (and always the last) so labels never collide.
  const every = bars.length > 8 ? 2 : 1
  return (
    <div className="flex h-40 gap-2" role="img" aria-label={label}>
      {bars.map((b, i) => (
        <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2" title={`${b.title}: ${timeOrDash(b.seconds)}`}>
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-md ${b.key === highlight ? 'bg-stage-focus' : 'bg-stage-focus/45'}`}
              style={{ height: `${Math.max(b.seconds ? 6 : 2, (b.seconds / max) * 100)}%`, opacity: b.seconds ? 1 : 0.35 }}
            />
          </div>
          <span className={`block w-full truncate text-center text-sm ${b.key === highlight ? 'font-semibold text-ink' : 'text-muted'}`}>
            {(bars.length - 1 - i) % every === 0 ? b.label : ' '}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Focused time per day of a week. */
export function DayBars({ bars, today }: { bars: { day: string; focusSeconds: number }[]; today: string }): React.JSX.Element {
  return (
    <VBars
      label={uiText("Focused time per day this week")}
      highlight={today}
      bars={bars.map((b) => ({ key: b.day, label: shortDay(b.day), title: shortDay(b.day), seconds: b.focusSeconds }))}
    />
  )
}

/** Horizontal bars with a label and a value, for time per subject or per week. */
export function HBars({ rows }: { rows: { key: string | number; label: string; color?: string; seconds: number }[] }): React.JSX.Element {
  const max = Math.max(1, ...rows.map((r) => r.seconds))
  if (!rows.length) return <p className="text-base text-muted">{uiText("Nothing studied yet.")}</p>
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(8rem,14rem)_1fr_5.5rem] items-center gap-4">
          <span dir="auto" className="truncate text-base">
            {r.label}
          </span>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(r.seconds / max) * 100}%`, background: r.color ?? 'var(--fr-stage-focus)' }} />
          </div>
          <span className="text-right text-base text-muted tabular-nums">{timeOrDash(r.seconds)}</span>
        </li>
      ))}
    </ul>
  )
}

const when = (iso: string): string => {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = formatTime(d, { hour: '2-digit', minute: '2-digit' })
  return sameDay ? time : `${formatDate(d, { day: 'numeric', month: 'short' })}, ${time}`
}

/** Rows of blocks: subject, when, length, focus in words. */
export function BlockRows({
  blocks,
  onOpen,
  showSubject = true
}: {
  blocks: BlockSummary[]
  onOpen?: (b: BlockSummary) => void
  showSubject?: boolean
}): React.JSX.Element {
  const items = useItemsById()
  if (!blocks.length) return <p className="text-base text-muted">{uiText("No sessions yet.")}</p>
  return (
    <ul className="flex flex-col gap-1">
      {blocks.map((b) => {
        const item = items.get(b.itemId)
        const focus = wordFor(FOCUS_WORDS, b.focusRating)
        return (
          <li key={b.id}>
            <button
              type="button"
              disabled={!onOpen}
              onClick={() => onOpen?.(b)}
              className="relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left hover:bg-surface-2/70 disabled:hover:bg-transparent"
            >
              <span className="min-w-0 flex-1">
                {showSubject && (
                  <span dir="auto" className="block truncate text-base">
                    {item?.name ?? 'Deleted subject'}
                  </span>
                )}
                <span className="block text-sm text-muted">{when(b.focusStartedAt)}</span>
              </span>
              <span className="text-right">
                <span className="block text-base tabular-nums">{timeOrDash(b.focusSeconds)}</span>
                <span className="block text-sm text-muted">{focus ?? (b.logged ? '' : 'not logged')}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Open "Review later" marks with done checkboxes. */
export function ReviewRows({
  blocks,
  onToggle,
  onOpen,
  showSubject = true
}: {
  blocks: BlockSummary[]
  onToggle: (b: BlockSummary, done: boolean) => void
  onOpen?: (b: BlockSummary) => void
  showSubject?: boolean
}): React.JSX.Element {
  const items = useItemsById()
  if (!blocks.length) return <p className="text-base text-muted">{uiText("Nothing marked for review.")}</p>
  return (
    <ul className="flex flex-col gap-1">
      {blocks.map((b) => {
        const item = items.get(b.itemId)
        return (
          <li key={b.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2/70">
            <input
              type="checkbox"
              aria-label={uiText("Done")}
              className="mt-1 size-5 shrink-0 accent-[var(--tf-rest)]"
              checked={b.reviewDone}
              onChange={(e) => onToggle(b, e.target.checked)}
            />
            <button type="button" disabled={!onOpen} onClick={() => onOpen?.(b)} className="min-w-0 flex-1 text-left">
              <span dir="auto" className={`block font-writing text-base ${b.reviewDone ? 'text-muted line-through' : ''}`}>
                {b.reviewNote || firstLine(b.recallText) || 'Marked for review'}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                {showSubject && (
                  <>
                    <span className="size-2 rounded-full" style={{ background: item?.color }} />
                    <span className="truncate">{item?.name}</span>
                    <span>·</span>
                  </>
                )}
                {when(b.focusStartedAt)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Recall notes, newest first. */
export function NoteCards({
  blocks,
  showSubject = true,
  onOpen
}: {
  blocks: BlockSummary[]
  showSubject?: boolean
  onOpen?: (b: BlockSummary) => void
}): React.JSX.Element {
  const items = useItemsById()
  if (!blocks.length) return <p className="text-base text-muted">{uiText("No recall notes yet.")}</p>
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b) => {
        const item = items.get(b.itemId)
        return (
          <article key={b.id} className="rounded-2xl border border-line bg-writing p-6">
            <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {showSubject && (
                <span className="flex items-center gap-2 text-base text-ink">
                  <span className="size-2.5 rounded-full" style={{ background: item?.color }} />
                  {item?.name}
                </span>
              )}
              <span>{when(b.focusStartedAt)}</span>
              <span>· {timeOrDash(b.focusSeconds)}</span>
              {b.reviewMarked && !b.reviewDone && <span className="text-recall">{uiText("· marked for review")}</span>}
              <span className="flex-1" />
              {b.notesLink && (
                <button type="button" className="text-focus hover:underline" onClick={() => window.api.invoke('shell:open', b.notesLink!)}>{uiText("Notes page")}</button>
              )}
              {onOpen && (
                <button type="button" className="text-focus hover:underline" onClick={() => onOpen(b)}>{uiText("Open session")}</button>
              )}
            </header>
            {b.recallText && (
              <p dir="auto" className="font-writing leading-[1.65] whitespace-pre-wrap text-writing-ink" style={{ fontSize: 'var(--tf-writing-size)' }}>
                {b.recallText}
              </p>
            )}
            {b.reviewNote && (
              <p dir="auto" className="mt-3 font-writing text-base text-muted">{uiText("Review: ")}{b.reviewNote}
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}

function firstLine(text: string | null): string | null {
  const line = text?.split('\n').find((l) => l.trim())
  return line ? (line.length > 90 ? line.slice(0, 88) + '…' : line) : null
}
