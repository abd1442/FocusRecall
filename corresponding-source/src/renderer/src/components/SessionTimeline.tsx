import { formatDuration , formatTime } from '../i18n'
import { t as uiText } from '../i18n'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DistractionRow } from '@core/blocks'
import type { SessionMark } from '@core/captures'
import { OTHER_REASON, QUALITY_LABEL, distractionSourceLabel, qualityOf, reasonLabel } from '@core/distractions'
import { axisTicks, clampSpan, flattenLine, lineTotals, moveSpan, partAt, previewLine, removesTime, type LineSegment } from '@core/timeline'

import type { Id } from '@core/types'
import { useReasons } from '../store/reasons'
import { useSettings } from '../store/session'
import { ReasonChips } from './ReasonChips'
import { Button } from './ui'
import { TimeInput } from './NumberInputs'
import { atClockTime, secondsOfDay } from '@core/timeinput'

export interface TimelinePart {
  id: Id
  itemId: Id
  itemName: string
  itemColor: string
  start: number
  end: number
}

const clock = (ms: number): string => formatTime(new Date(ms), { hour: '2-digit', minute: '2-digit' })
const clockSec = (ms: number): string => formatTime(new Date(ms), { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The distraction colours come from the theme (checked against every subject colour, see core/appearance). */
const KIND_COLOR: Record<Exclude<LineSegment['kind'], 'focus'>, string> = {
  distracted: 'var(--tf-line-distracted)',
  detected: 'var(--tf-line-detected)',
  idle: 'var(--tf-line-idle)'
}
/** Text contrast follows the actual selected timeline colour. */
const TEXT_ON: Record<LineSegment['kind'], string> = { focus:'var(--tf-line-focus-text)',distracted:'var(--tf-line-distracted-text)',detected:'var(--tf-line-detected-text)',idle:'var(--tf-line-idle-text)' }
const KIND_NAME: Record<LineSegment['kind'], string> = { focus: 'Focus', distracted: 'You were distracted', detected: 'Detected app or site', idle: 'No input' }
const KIND_LABEL: Record<LineSegment['kind'], string> = { focus: 'Focus', distracted: 'Distracted', detected: 'Detected app or site', idle: 'No input' }
const GAP_PX = 2

/** Distractions that still want a decision or a reason. */
export function needsLook(d: DistractionRow): boolean {
  if (d.source === 'manual' || d.source === 'pause') return d.kind === 'untagged' || d.kind === OTHER_REASON
  return !d.confirmed
}

type Drag =
  | { kind: 'move' | 'start' | 'end'; id: Id; start: number; end: number; moved: boolean }
  | { kind: 'switch'; index: number; at: number }

/** The width of an element, kept up to date. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/**
 * The whole session as one flat bar of side-by-side pieces: focus in the
 * selected focus colour, you were distracted, a detected app or site
 * (red), no input (grey). Subject names sit above the bar, the time axis
 * below it. Select a piece to drag its edges or the whole of it; drag across
 * focus to add a distraction you forgot; drag a switch point between subjects.
 */
export function SessionTimeline({
  parts,
  distractions,
  marks = [],
  onChanged,
  editable = true
}: {
  parts: TimelinePart[]
  distractions: DistractionRow[]
  marks?: SessionMark[]
  onChanged: () => void
  editable?: boolean
}): React.JSX.Element | null {
  const [barRef, width] = useWidth()
  const thresholds = useSettings((s) => s.settings.quality)
  const [selected, setSelected] = useState<Id | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  // Edits waiting for the reload after they were saved.
  const [pending, setPending] = useState<{ spans: Record<Id, { start: number; end: number }>; switches: Record<number, number> } | null>(null)
  const [newSpan, setNewSpan] = useState<{ start: number; end: number; drawing: boolean } | null>(null)
  useEffect(() => setPending(null), [parts, distractions])

  const sorted = useMemo(() => [...parts].sort((a, b) => a.start - b.start), [parts])
  if (!sorted.length) return null
  const from = sorted[0].start
  const to = Math.max(...sorted.map((p) => p.end))
  const span = Math.max(1, to - from)
  const pct = (ms: number): number => ((ms - from) / span) * 100
  const timeAt = (clientX: number): number => {
    const r = barRef.current!.getBoundingClientRect()
    return from + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * span
  }

  // The line as drawn now: saved values, then pending and in-progress edits.
  const shownParts = sorted.map((p, i) => {
    let { start, end } = p
    const left = drag?.kind === 'switch' && drag.index === i - 1 ? drag.at : pending?.switches[i - 1]
    const right = drag?.kind === 'switch' && drag.index === i ? drag.at : pending?.switches[i]
    if (left !== undefined) start = left
    if (right !== undefined) end = right
    return { ...p, start, end }
  })
  const placed = distractions.filter((d) => d.startedAt)
  const spans = placed.map((d) => {
    let start = Date.parse(d.startedAt!)
    let end = start + d.durationSeconds * 1000
    if (pending?.spans[d.id]) ({ start, end } = pending.spans[d.id])
    if (drag && 'id' in drag && drag.id === d.id) ({ start, end } = drag)
    return { d, start, end }
  })
  const lineDistractions = [
    ...spans.map(({ d, start, end }) => ({ id: d.id, start, end, source: d.source, confirmed: d.confirmed })),
    ...(newSpan ? [{ id: -1, start: newSpan.start, end: newSpan.end, source: 'manual' as const, confirmed: true }] : [])
  ]
  const segments = flattenLine(shownParts, lineDistractions)
  const totals = lineTotals(segments)
  const preview = previewLine(shownParts, lineDistractions)
  const quality = qualityOf(preview.stats, thresholds)
  const subjects = [...new Map(shownParts.map((p) => [p.itemId, p])).values()]
  const sel = spans.find((x) => x.d.id === selected) ?? null
  const kindsPresent = new Set(segments.map((s) => s.kind))
  const unconfirmed = segments.some((s) => s.kind !== 'focus' && !s.confirmed)

  // --- dragging ----------------------------------------------------------------

  const follow = (onMove: (t: number, e: PointerEvent) => void, onUp: (t: number) => void): void => {
    const move = (e: PointerEvent): void => onMove(timeAt(e.clientX), e)
    const up = (e: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onUp(timeAt(e.clientX))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startSpanDrag = (kind: 'move' | 'start' | 'end', d: DistractionRow, start: number, end: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setNewSpan(null)
    if (!editable) {
      setSelected(selected === d.id ? null : d.id)
      return
    }
    const x0 = timeAt(e.clientX)
    let cur: Drag = { kind, id: d.id, start, end, moved: false }
    setDrag(cur)
    follow(
      (t, ev) => {
        const moved = (cur as { moved: boolean }).moved || Math.abs(ev.clientX - e.clientX) > 3
        const next = kind === 'move' ? moveSpan(start, end, t - x0, from, to) : kind === 'start' ? clampSpan(t, end, from, to) : clampSpan(start, t, from, to)
        cur = { kind, id: d.id, ...next, moved }
        setDrag(cur)
      },
      async () => {
        const c = cur as Extract<Drag, { id: Id }>
        setDrag(null)
        if (!c.moved) {
          // A click selects (or unselects) the piece.
          setSelected(selected === d.id && kind === 'move' ? null : d.id)
          return
        }
        setSelected(d.id)
        setPending((p) => ({ spans: { ...(p?.spans ?? {}), [d.id]: { start: c.start, end: c.end } }, switches: p?.switches ?? {} }))
        await window.api.invoke('distraction:retime', d.id, new Date(c.start).toISOString(), new Date(c.end).toISOString())
        onChanged()
      }
    )
  }

  const startSwitchDrag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const left = sorted[index]
    const right = sorted[index + 1]
    let at = right.start
    setDrag({ kind: 'switch', index, at })
    follow(
      (t) => {
        at = Math.min(right.end - 30_000, Math.max(left.start + 30_000, t))
        setDrag({ kind: 'switch', index, at })
      },
      async () => {
        setDrag(null)
        if (Math.abs(at - right.start) < 1000) return
        setPending((p) => ({ spans: p?.spans ?? {}, switches: { ...(p?.switches ?? {}), [index]: at } }))
        await window.api.invoke('session:moveSwitch', left.id, right.id, new Date(at).toISOString())
        onChanged()
      }
    )
  }

  const startNew = (e: React.PointerEvent): void => {
    if (!editable || e.button !== 0) return
    const anchor = timeAt(e.clientX)
    if (!partAt(shownParts, anchor)) return
    e.preventDefault()
    setSelected(null)
    let cur = { start: anchor, end: anchor }
    setNewSpan(null)
    follow(
      (t) => {
        cur = t >= anchor ? clampSpan(anchor, t, from, to, 1) : clampSpan(t, anchor, from, to, 1)
        setNewSpan(cur.end - cur.start >= 2000 ? { ...cur, drawing: true } : null)
      },
      () => {
        // A click only clears the selection; a drag of 5 s or more marks a new distraction.
        setNewSpan(cur.end - cur.start >= 5000 ? { ...clampSpan(cur.start, cur.end, from, to), drawing: false } : null)
      }
    )
  }

  const saveNew = async (kind: string): Promise<void> => {
    if (!newSpan) return
    const s = newSpan
    setNewSpan(null)
    await window.api.invoke('distraction:add', sorted.map((p) => p.id), new Date(s.start).toISOString(), new Date(s.end).toISOString(), kind)
    onChanged()
  }

  // --- layout helpers ---------------------------------------------------------------

  const px = (ms: number): number => (pct(ms) / 100) * width
  // Subject names above the bar: on the first free row where they do not overlap.
  const nameRows: number[] = []
  const names = shownParts.map((p) => {
    const x = px(p.start)
    const w = p.itemName.length * 8.5 + 22
    let row = nameRows.findIndex((end) => x >= end + 8)
    if (row < 0) {
      row = nameRows.length
      nameRows.push(0)
    }
    nameRows[row] = x + w
    return { p, row, left: Math.min(x, Math.max(0, width - w)) }
  })
  // A mark that would repeat the start or end label is left out.
  const ticks = axisTicks(from, to, width).filter((t) => clock(t) !== clock(from) && clock(t) !== clock(to))
  const hovered = hover ? segments.find((s) => hover.t >= s.start && hover.t < s.end) ?? null : null
  const pieceStyle = (s: LineSegment, isLast: boolean): React.CSSProperties => ({
    left: `${pct(s.start)}%`,
    width: isLast ? `${pct(s.end) - pct(s.start)}%` : `max(1px, calc(${pct(s.end) - pct(s.start)}% - ${GAP_PX}px))`,
    background: s.kind === 'focus' ? 'var(--tf-line-focus)' : KIND_COLOR[s.kind],
    // Only unconfirmed detections are see-through; everything else is solid.
    opacity: s.kind === 'detected' && !s.confirmed ? 0.5 : 1,
    // Subject colours a little less saturated in the bar, so the whole line stays calm.
    filter: [s.kind === 'focus' ? 'saturate(0.82)' : '', hovered === s ? 'brightness(1.1)' : ''].filter(Boolean).join(' ') || undefined,
    boxShadow: hovered === s ? 'inset 0 2px 0 rgb(255 255 255 / 0.28), 0 2px 6px rgb(0 0 0 / 0.25)' : undefined,
    zIndex: hovered === s ? 1 : undefined
  })
  // Lengths inside pieces that are wide enough; otherwise only in the tooltip.
  const inside = (s: LineSegment): string | null => (px(s.end) - px(s.start) >= 64 ? formatDuration((s.end - s.start) / 1000) : null)
  const subjectOf = new Map(shownParts.map((p) => [p.id, p.itemName]))

  return (
    <div className="flex flex-col gap-2">
      {/* Subject names, over their parts. */}
      <div className="relative" style={{ height: `${Math.max(1, nameRows.length) * 1.5}rem` }}>
        {names.map(({ p, row, left }) => (
          <span key={p.id} className="absolute flex items-center gap-1.5 text-sm font-medium whitespace-nowrap" style={{ left, top: `${row * 1.5}rem` }}>
            <span className="size-2.5 rounded-full" style={{ background: p.itemColor }} />
            <span dir="auto">{p.itemName}</span>
          </span>
        ))}
      </div>

      {/* "?" on unconfirmed detections, and stuck / resisted markers. */}
      {(unconfirmed || marks.length > 0) && (
        <div className="relative h-5">
          {/* One "?" per unconfirmed detection, over its middle, even when it is cut into pieces. */}
          {spans
            .filter(({ d }) => !d.confirmed && d.source !== 'manual' && d.source !== 'pause')
            .map(({ d, start, end }) => (
              <span
                key={`q${d.id}`}
                title={uiText("Not confirmed yet: click it to decide")}
                className="absolute grid size-5 -translate-x-1/2 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink"
                style={{ left: `${pct((Math.max(from, start) + Math.min(to, end)) / 2)}%` }}
              >
                ?
              </span>
            ))}
          {marks.map((m) => {
            const t = Date.parse(m.at)
            if (t < from || t > to) return null
            return (
              <span
                key={m.id}
                title={uiText("{value0} at {value1}{value2}", {value0: (uiText(m.kind === 'stuck' ? 'Got stuck' : 'Resisted a distraction')), value1: (clock(t)), value2: (m.note ? `: ${m.note}` : '')})}
                className={`absolute -translate-x-1/2 text-sm leading-5 ${m.kind === 'stuck' ? 'text-recall' : 'text-rest'}`}
                style={{ left: `${pct(t)}%` }}
              >
                {m.kind === 'stuck' ? '▼' : '●'}
              </span>
            )
          })}
        </div>
      )}

      {/* The bar. */}
      <div
        ref={barRef}
        onPointerDown={startNew}
        onPointerMove={(e) => {
          const r = barRef.current!.getBoundingClientRect()
          setHover({ x: e.clientX - r.left, t: timeAt(e.clientX) })
        }}
        onPointerLeave={() => setHover(null)}
        className={`relative h-12 select-none ${editable ? 'cursor-crosshair' : ''}`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[0.9rem] bg-surface-2">
          {segments.map((s, i) => {
            const isLast = i === segments.length - 1
            const label = inside(s)
            if (s.kind === 'focus')
              return (
                <div key={`f${s.start}`} className="absolute inset-y-0 flex items-center justify-center overflow-hidden transition-[filter,box-shadow]" style={pieceStyle(s, isLast)}>
                  {label && (
                    <span className="truncate px-1 text-xs font-medium tabular-nums" style={{ color: TEXT_ON.focus }}>
                      {label}
                    </span>
                  )}
                </div>
              )
            const sp = spans.find((x) => x.d.id === s.distractionId)
            return (
              <div
                key={`d${s.distractionId}-${s.start}`}
                role="button"
                tabIndex={0}
                aria-label={sp ? uiText("{value0} at {value1}, {value2}", {value0: (uiText(distractionSourceLabel(sp.d))), value1: (clock(sp.start)), value2: (formatDuration((sp.end - sp.start) / 1000))}) : uiText("New distraction")}
                onPointerDown={sp ? startSpanDrag('move', sp.d, sp.start, sp.end) : undefined}
                onKeyDown={(e) => e.key === 'Enter' && sp && setSelected(selected === sp.d.id ? null : sp.d.id)}
                className={`absolute inset-y-0 flex items-center justify-center overflow-hidden transition-[filter,box-shadow] ${editable && sp ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                style={pieceStyle(s, isLast)}
              >
                {label && (
                  <span className="pointer-events-none truncate px-1 text-xs font-medium tabular-nums" style={{ color: TEXT_ON[s.kind] }}>
                    {label}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/*
          Resize handles on every distraction: a 10 px grab zone over each edge
          with a resize cursor (visible bars once the piece is selected). On a
          narrow piece the zones sit just outside it, so its middle still moves it.
        */}
        {editable &&
          spans.map(({ d, start, end }) => {
            const l = px(Math.max(from, start))
            const r = px(Math.min(to, end))
            if (r <= l) return null
            const narrow = r - l < 24
            return (
              <Fragment key={`edges${d.id}`}>
                <div
                  title={uiText("Drag to change when it started")}
                  onPointerDown={startSpanDrag('start', d, start, end)}
                  className="absolute -inset-y-1 z-10 w-2.5 cursor-ew-resize"
                  style={{ left: l, transform: narrow ? 'translateX(-100%)' : 'translateX(-50%)' }}
                />
                <div
                  title={uiText("Drag to change when it ended")}
                  onPointerDown={startSpanDrag('end', d, start, end)}
                  className="absolute -inset-y-1 z-10 w-2.5 cursor-ew-resize"
                  style={{ left: r, transform: narrow ? 'none' : 'translateX(-50%)' }}
                />
              </Fragment>
            )
          })}

        {/* The selected piece: an outline over its whole length, with handles on its edges. */}
        {sel && (
          <div
            className="pointer-events-none absolute -inset-y-1 rounded-md ring-2 ring-ink"
            style={{ left: `${pct(sel.start)}%`, width: `${pct(sel.end) - pct(sel.start)}%` }}
          >
            {editable && (
              <>
                <span
                  onPointerDown={startSpanDrag('start', sel.d, sel.start, sel.end)}
                  className="pointer-events-auto absolute inset-y-1 -left-2 flex w-4 cursor-ew-resize justify-center"
                  aria-label={uiText("Drag to change when it started")}
                >
                  <span className="h-full w-1.5 rounded-full bg-ink" />
                </span>
                <span
                  onPointerDown={startSpanDrag('end', sel.d, sel.start, sel.end)}
                  className="pointer-events-auto absolute inset-y-1 -right-2 flex w-4 cursor-ew-resize justify-center"
                  aria-label={uiText("Drag to change when it ended")}
                >
                  <span className="h-full w-1.5 rounded-full bg-ink" />
                </span>
              </>
            )}
          </div>
        )}

        {/* Switch points between subjects. */}
        {editable &&
          shownParts.slice(0, -1).map((p, i) => (
            <div
              key={p.id}
              role="slider"
              tabIndex={0}
              aria-label={uiText("Switch from {value0} to {value1}", {value0: (p.itemName), value1: (shownParts[i + 1].itemName)})}
              aria-valuetext={clock(p.end)}
              title={uiText("Drag to move the switch")}
              onPointerDown={startSwitchDrag(i)}
              onKeyDown={async (e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                const step = (e.shiftKey ? 300_000 : 60_000) * (e.key === 'ArrowLeft' ? -1 : 1)
                await window.api.invoke('session:moveSwitch', sorted[i].id, sorted[i + 1].id, new Date(sorted[i + 1].start + step).toISOString())
                onChanged()
              }}
              className="group absolute -inset-y-1.5 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize justify-center focus:outline-none"
              style={{ left: `${pct(p.end)}%` }}
            >
              <span className={`h-full w-[3px] rounded-full bg-ink/70 group-hover:bg-ink ${drag?.kind === 'switch' && drag.index === i ? 'bg-ink' : ''}`} />
            </div>
          ))}

        {/* Under the pointer: the piece (kind, start, end, length) and the exact time. */}
        {hover && (
          <span
            className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] z-20 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-sm whitespace-nowrap text-bg shadow-lg tabular-nums"
            style={{ left: Math.min(width - 120, Math.max(120, hover.x)) }}
          >
            {drag?.kind === 'switch' || !hovered ? (
              clockSec(drag?.kind === 'switch' ? drag.at : hover.t)
            ) : (
              <>
                <span className="font-semibold">
                  {hovered.kind === 'focus' ? uiText("Focus · {value0}", {value0: (subjectOf.get(hovered.partId) ?? '')}) : KIND_NAME[hovered.kind]}
                  {hovered.kind === 'detected' && !hovered.confirmed ? uiText(" (not confirmed)") : ''}
                </span>
                <span className="opacity-80">
                  {' '}
                  · {clockSec(hovered.start)}–{clockSec(hovered.end)} · {formatDuration((hovered.end - hovered.start) / 1000)}
                </span>
                <span className="block text-xs opacity-70">{uiText("at the pointer ")}{clockSec(hover.t)}</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Time axis: quiet marks; start and end slightly emphasised. */}
      <div className="relative h-5 text-xs text-muted/80 tabular-nums">
        <span className="absolute left-0 text-sm font-medium text-ink/80">{clock(from)}</span>
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(t)}%` }}>
            <span className="absolute -top-1 left-1/2 h-1 w-px bg-muted/40" />
            {clock(t)}
          </span>
        ))}
        <span className="absolute right-0 text-sm font-medium text-ink/80">{clock(to)}</span>
      </div>

      {/* Legend: only what this session has. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
        <Legend color="var(--tf-line-focus)">{uiText("focus")}</Legend>
        {kindsPresent.has('distracted') && <Legend color={KIND_COLOR.distracted}>{uiText("distracted")}</Legend>}
        {kindsPresent.has('detected') && <Legend color={KIND_COLOR.detected}>{uiText("detected app or site")}</Legend>}
        {kindsPresent.has('idle') && <Legend color={KIND_COLOR.idle}>{uiText("no input")}</Legend>}
        {unconfirmed && <span>{uiText("? not confirmed yet")}</span>}
        {marks.some((m) => m.kind === 'stuck') && <span className="text-recall">{uiText("▼ got stuck")}</span>}
        {marks.some((m) => m.kind === 'resisted') && <span className="text-rest">{uiText("● resisted")}</span>}
      </div>

      {/* Summary. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
        <span>
          <span className="text-muted">{uiText("Focus")}</span> <span className="font-semibold tabular-nums">{formatDuration(totals.focus)}</span>
        </span>
        {subjects.length > 1 &&
          subjects.map((p) => (
            <span key={p.itemId} className="flex items-center gap-1.5 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: p.itemColor }} />
              <span dir="auto">{p.itemName}</span>
              <span className="text-ink tabular-nums">{formatDuration(preview.subjects[p.itemId] ?? 0)}</span>
            </span>
          ))}
        {(['distracted', 'detected', 'idle'] as const).map((k) =>
          totals[k] > 0 ? (
            <span key={k}>
              <span className="text-muted">{KIND_LABEL[k]}</span> <span className="tabular-nums">{formatDuration(totals[k])}</span>
            </span>
          ) : null
        )}
        <span className={`rounded-full border px-2.5 py-0.5 text-sm ${quality === 'clean' ? 'border-rest/60 text-rest' : 'border-overtime/60 text-overtime'}`}>{uiText(QUALITY_LABEL[quality])}</span>
        {editable && <span className="text-sm text-muted">{uiText("Click a piece to change it; drag across focus to add one.")}</span>}
      </div>

      {newSpan && !newSpan.drawing && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold">{uiText("New distraction")}</span>
            <span className="text-base text-muted tabular-nums">
              {clockSec(newSpan.start)} · {formatDuration((newSpan.end - newSpan.start) / 1000)}
            </span>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setNewSpan(null)}>{uiText("Cancel")}</Button>
          </div>
          <p className="text-sm text-muted">{uiText("What pulled you away? The time comes out of your focus time.")}</p>
          <ReasonChips onPick={(kind) => void saveNew(kind)} />
        </div>
      )}

      {sel && !newSpan && (
        <Details
          d={sel.d}
          start={sel.start}
          end={sel.end}
          editable={editable}
          onChanged={onChanged}
          onClose={() => setSelected(null)}
          onRetime={async (a, b) => {
            const next = clampSpan(a, b, from, to)
            setPending((p) => ({ spans: { ...(p?.spans ?? {}), [sel.d.id]: next }, switches: p?.switches ?? {} }))
            await window.api.invoke('distraction:retime', sel.d.id, new Date(next.start).toISOString(), new Date(next.end).toISOString())
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function Legend({ color, children }: { color: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-5 rounded-sm" style={{ background: color }} />
      {children}
    </span>
  )
}

/** Details of one distraction, with what can be done about it. */
/** Details of one distraction: exact start and end (typed), the reason, and what can be done about it. */
function Details({
  d,
  start,
  end,
  editable,
  onChanged,
  onClose,
  onRetime
}: {
  d: DistractionRow
  start: number
  end: number
  editable: boolean
  onChanged: () => void
  onClose: () => void
  onRetime: (start: number, end: number) => Promise<void>
}): React.JSX.Element {
  const { all: reasons } = useReasons()
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-base font-semibold">{uiText(distractionSourceLabel(d))}</span>
        {editable ? (
          <span className="flex items-center gap-2 text-base text-muted tabular-nums">
            <TimeInput
              shape="hms"
              pad
              label={uiText("Started at")}
              value={secondsOfDay(start)}
              onChange={(v) => v !== null && void onRetime(atClockTime(start, v), end)}
              className="w-32"
            />{uiText("to")}<TimeInput
              shape="hms"
              pad
              label={uiText("Ended at")}
              value={secondsOfDay(end)}
              onChange={(v) => v !== null && void onRetime(start, atClockTime(end, v))}
              className="w-32"
            />
            <span>· {formatDuration((end - start) / 1000)}</span>
          </span>
        ) : (
          <span className="text-base text-muted tabular-nums">
            {clockSec(start)} · {formatDuration((end - start) / 1000)}
          </span>
        )}
        <span className="text-base">{(d.kind==='timer-pause'?uiText('Timer pause'):reasonLabel(d.kind, reasons))}</span>
        {removesTime(d) && <span className="text-sm text-muted">{uiText("taken out of focus time")}</span>}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose}>{uiText("Close")}</Button>
      </div>
      {(d.appName || d.windowTitle) && (
        <p dir="auto" className="text-base text-muted">
          {d.appName}
          {d.windowTitle ? ` · ${d.windowTitle}` : ''}
        </p>
      )}
      {editable && <Actions d={d} onChanged={onChanged} />}
    </div>
  )
}

/** The buttons for one distraction. Shared by the details card and the "needs a look" list. */
export function Actions({ d, onChanged, compact = false }: { d: DistractionRow; onChanged: () => void; compact?: boolean }): React.JSX.Element {
  const run = (fn: () => Promise<unknown>) => async () => {
    await fn()
    onChanged()
  }
  const remove = run(() => window.api.invoke('distraction:delete', d.id))
  const manual = d.source === 'manual' || d.source === 'pause'
  return (
    <div className="flex flex-col gap-2">
      {manual && (
        <ReasonChips
          selected={d.kind}
          autoFocusOther={d.kind === OTHER_REASON && compact}
          onPick={async (kind) => {
            await window.api.invoke('distraction:label', d.id, kind)
            onChanged()
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {d.source === 'auto' && !d.confirmed && (
          <>
            <Button variant="quiet" size="sm" onClick={run(() => window.api.invoke('distraction:confirm', d.id))}>{uiText("Yes, a distraction")}</Button>
            <Button variant="quiet" size="sm" onClick={remove}>{uiText("No, dismiss")}</Button>
          </>
        )}
        {d.source === 'auto' && (
          <Button variant="ghost" size="sm" onClick={run(() => window.api.invoke('distraction:alwaysIgnore', d.id))} title={uiText("Never count this app or site again")}>{uiText("Always ignore")}</Button>
        )}
        {d.source === 'idle' && !d.confirmed && (
          <>
            <Button variant="quiet" size="sm" onClick={run(() => window.api.invoke('distraction:confirm', d.id))} title={uiText("The time comes out of your focus time")}>{uiText("I was away")}</Button>
            <Button variant="quiet" size="sm" onClick={remove} title={uiText("Reading or watching: the time stays")}>{uiText("I was there")}</Button>
          </>
        )}
        {!compact && (
          <Button variant="ghost" size="sm" onClick={remove} title={removesTime(d) ? uiText("Remove it; the time goes back into focus") : uiText("Remove it")}>{uiText("Delete")}</Button>
        )}
      </div>
    </div>
  )
}
