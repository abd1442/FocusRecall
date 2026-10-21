import { radioKeyboard } from './radioKeyboard'
import { TRACKING_COVERAGE_NOTE } from '@core/trackingConsent'
import { formatDuration , formatTime } from '../i18n'
import { t as uiText } from '../i18n'
import { confirmAction } from './appDialogs'
import { useCallback, useEffect, useState } from 'react'
import type { RuleInput, SessionReview as Review } from '@core/api'
import { GOAL_RESULTS } from '@core/captures'
import { reasonLabel } from '@core/distractions'

import { isBrowser, ruleForRow, ruleScope, switchesPer10Min, type Classification, type ProgramRow, type RuleScope } from '@core/tracking'
import type { Id } from '@core/types'
import { useReasons } from '../store/reasons'
import { Actions, SessionTimeline, needsLook, type TimelinePart } from './SessionTimeline'
import { Button, inputBase } from './ui'

const time = (iso: string): string => formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit' })

/**
 * Everything about one session after it: the editable timeline, the goal,
 * what needs a look, programs to tag, time per app and window switches.
 * Used in the log and in History.
 */
export function SessionReview({
  sessionId,
  parts,
  onChanged,
  hideGoal = false
}: {
  sessionId: Id
  parts: TimelinePart[]
  onChanged?: () => void
  /** The log asks about the goal in its own card. */
  hideGoal?: boolean
}): React.JSX.Element {
  const [review, setReview] = useState<Review | null>(null)
  const ids = parts.map((p) => p.id)
  const key = ids.join(',')
  const reload = useCallback(async () => setReview(await window.api.invoke('session:review', ids)), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void reload()
    const offA = window.api.on('distractions:changed', () => void reload())
    return () => {
      offA()
    }
  }, [reload])
  const changed = (): void => {
    void reload()
    onChanged?.()
  }

  const sessionSeconds = parts.length ? (Math.max(...parts.map((p) => p.end)) - Math.min(...parts.map((p) => p.start))) / 1000 : 0
  const subjects = [...new Map(parts.map((p) => [p.itemId, p])).values()]

  return (
    <div className="flex flex-col gap-5">
      {review?.windowHistoryFrozen&&<p className="text-sm text-muted">{uiText("Window-title evidence is unavailable or incomplete. Automatic detections and switch counts stay as recorded; later rules do not reclassify this history. You can still edit individual distractions.")}</p>}
      {review?.goal && !hideGoal && <GoalRow sessionId={sessionId} review={review} onChanged={changed} />}

      <SessionTimeline parts={parts} distractions={review?.distractions ?? []} marks={review?.marks ?? []} onChanged={changed} />

      {review && <NeedsLook review={review} onChanged={changed} />}
      {review && review.programs.length > 0 && (
        <Programs
          rows={review.programs}
          sessionId={sessionId}
          subjects={subjects}
          header={`${review.windowSwitches} window switches · ${switchesPer10Min(review.windowSwitches, sessionSeconds).toFixed(1)} per 10 min`}
        />
      )}

      {review && review.programs.length>0&&<p className="text-xs text-muted">{uiText(TRACKING_COVERAGE_NOTE)}</p>}
    </div>
  )
}

function GoalRow({ sessionId, review, onChanged }: { sessionId: Id; review: Review; onChanged: () => void }): React.JSX.Element {
  const set = async (result: (typeof GOAL_RESULTS)[number]['id'] | null): Promise<void> => {
    await window.api.invoke('session:setGoalResult', sessionId, result)
    onChanged()
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2/60 px-5 py-3">
      <span className="text-base text-muted">{uiText("Goal")}</span>
      <span dir="auto" className="min-w-0 flex-1 text-base font-medium">
        {review.goal}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-line" role="radiogroup" onKeyDown={radioKeyboard} aria-label={uiText("Did you get it done?")}>
        {GOAL_RESULTS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={review.goalResult === g.id}
            tabIndex={(review.goalResult ?? GOAL_RESULTS[0].id) === g.id ? 0 : -1}
            onClick={() => void set(review.goalResult === g.id ? null : g.id)}
            className={`min-h-10 px-4 text-base transition-colors ${review.goalResult === g.id ? 'bg-focus text-on-accent' : 'hover:bg-surface-2'}`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Distractions waiting for a reason or a decision, one by one or several at once. */
function NeedsLook({ review, onChanged }: { review: Review; onChanged: () => void }): React.JSX.Element | null {
  const { all: reasons } = useReasons()
  const [picked, setPicked] = useState<Set<Id>>(new Set())
  const look = review.distractions.filter(needsLook)
  if (!look.length) return null
  const detected = look.filter((d) => d.source === 'auto')
  const chosen = detected.filter((d) => picked.has(d.id))
  const bulk = async (action: 'distraction:confirm' | 'distraction:delete' | 'distraction:alwaysIgnore'): Promise<void> => {
    for (const d of chosen) await window.api.invoke(action, d.id)
    setPicked(new Set())
    onChanged()
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold">{uiText("Needs a look")}</h3>
        {detected.length > 1 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setPicked(new Set(chosen.length === detected.length ? [] : detected.map((d) => d.id)))}>
              {chosen.length === detected.length ? uiText("Select none") : uiText("Select all detected")}
            </Button>
            {chosen.length > 0 && (
              <>
                <span className="text-sm text-muted">{chosen.length}{uiText(" selected:")}</span>
                <Button variant="quiet" size="sm" onClick={() => void bulk('distraction:confirm')}>{uiText("Yes, distractions")}</Button>
                <Button variant="quiet" size="sm" onClick={() => void bulk('distraction:delete')}>{uiText("Dismiss")}</Button>
                <Button variant="ghost" size="sm" disabled={chosen.some(d=>d.kind==='website'&&!d.windowTitle)} onClick={() => void bulk('distraction:alwaysIgnore')}>{uiText("Always ignore")}</Button>
              </>
            )}
          </>
        )}
      </div>
      {look.map((d) => (
        <div key={d.id} className="flex gap-3">
          {d.source === 'auto' && detected.length > 1 ? (
            <input
              type="checkbox"
              aria-label={uiText("Select")}
              className="mt-1 size-5 accent-[var(--tf-focus)]"
              checked={picked.has(d.id)}
              onChange={(e) => setPicked((s) => {
                const n = new Set(s)
                if (e.target.checked) n.add(d.id)
                else n.delete(d.id)
                return n
              })}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="text-base">
              <span className="text-muted tabular-nums">{d.startedAt ? time(d.startedAt) : ''}</span> · {formatDuration(d.durationSeconds)} ·{' '}
              {d.source === 'auto' ? (
                <span dir="auto">
                  {d.appName}
                  {d.windowTitle ? ` · ${d.windowTitle}` : ''}
                </span>
              ) : d.source === 'idle' ? (
                uiText("No keyboard or mouse input")
              ) : d.kind === 'other' ? (
                uiText("You picked Other. What was it?")
              ) : (
                (d.kind==='timer-pause'?uiText('Timer pause'):reasonLabel(d.kind, reasons))
              )}
            </div>
            <Actions d={d} onChanged={onChanged} compact />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A whole browser as a distraction counts every site in it, your course too.
 * Ask once before saving such a rule.
 */
export async function confirmBrowserRules(rules: RuleInput[]): Promise<boolean> {
  const whole = rules.filter((r) => r.matchType === 'process' && r.classification === 'distraction' && isBrowser(r.pattern))
  if (!whole.length) return true
  return confirmAction(
    `"${whole.map((r) => r.pattern).join('", "')}" is a web browser. Marking the whole program as a distraction counts every site in it, your course pages too.

Usually it is better to choose "Titles containing" and a site name (for example YouTube).

Mark the whole browser as a distraction anyway?`
  )
}

const CLASSES: { id: Classification; label: string }[] = [
  { id: 'study', label: 'Study' },
  { id: 'distraction', label: 'Distraction' },
  { id: 'ignore', label: 'Ignore' }
]

const SCOPES: { id: RuleScope; label: string }[] = [
  { id: 'session', label: 'Just this session' },
  { id: 'subject', label: 'For this subject' },
  { id: 'always', label: 'Always' }
]

/**
 * Every program and browser site in front during the session, each with a
 * Study / Distraction / Ignore toggle. Its position is the choice that applies
 * (this session, this subject, always, or the latest choice anywhere); no
 * choice yet shows "Needs a look". A change applies at once (the timeline,
 * focus and quality follow) for this subject, with an inline choice of scope.
 * Browsers are always decided site by site.
 */
function Programs({ rows, sessionId, subjects, header }: { rows: ProgramRow[]; sessionId: Id; subjects: TimelinePart[]; header: string }): React.JSX.Element {
  // The choice just made on a row, so its scope can still be changed.
  const [recent, setRecent] = useState<Record<string, { ruleId: Id; scope: RuleScope }>>({})
  const [refining, setRefining] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const nameOf = (itemId: Id | null | undefined): string => subjects.find((x) => x.itemId === itemId)?.itemName ?? 'this subject'
  const needing = rows.filter((r) => r.classification === 'unknown')

  const decide = async (row: ProgramRow, c: Classification, pattern?: string): Promise<void> => {
    const base = pattern ? { matchType: 'title' as const, pattern } : ruleForRow(row)
    // A choice made "just this session" stays that way when changed again
    // (a subject rule would sit under it and the click would seem to do nothing).
    const keepSession = row.rule?.sessionId === sessionId || new Set(row.titles.map((t) => t.itemId)).size > 1
    const [ruleId] = await window.api.invoke('rules:decide', [
      keepSession ? { ...base, classification: c, sessionId } : { ...base, classification: c, itemId: row.itemId ?? subjects[0]?.itemId ?? null }
    ])
    setRecent((x) => ({ ...x, [row.key]: { ruleId, scope: keepSession ? 'session' : 'subject' } }))
  }
  const rescope = async (row: ProgramRow, scope: RuleScope): Promise<void> => {
    const cur = recent[row.key]
    if (!cur || cur.scope === scope) return
    const ruleId = await window.api.invoke('rules:rescope', cur.ruleId, scope, { itemId: row.itemId ?? null, sessionId })
    setRecent((x) => ({ ...x, [row.key]: { ruleId, scope } }))
  }
  const decideAll = async (c: Classification): Promise<void> => {
    const ids = await window.api.invoke('rules:decide', needing.map((r) => ({ ...ruleForRow(r), classification: c, itemId: r.itemId ?? null })))
    setRecent((x) => ({ ...x, ...Object.fromEntries(needing.map((r, i) => [r.key, { ruleId: ids[i], scope: 'subject' as RuleScope }])) }))
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">{uiText("Programs and sites")}</h3>
        <span className="rounded-full border border-line bg-surface-2/50 px-3 py-1 text-sm text-muted">{header}</span>
        {needing.length > 1 && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {needing.length}{uiText(" need a look. Mark them all as")}{CLASSES.map((c) => (
              <Button key={c.id} variant="ghost" size="sm" onClick={() => void decideAll(c.id)}>
                {c.label}
              </Button>
            ))}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const r = recent[row.key]
          const scope = r?.scope ?? (row.rule ? ruleScope(row.rule) : null)
          return (
            <li key={row.key} className="flex flex-col gap-2 rounded-xl border border-line bg-surface/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span dir="auto" className="truncate text-base font-medium">
                      {row.label}
                    </span>
                    {row.site && <span className="text-sm text-muted">{row.process}</span>}
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium tabular-nums">{formatDuration(row.seconds)}</span>
                  </div>
                  <button type="button" aria-expanded={expanded.has(row.key)} onClick={() => setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(row.key)) next.delete(row.key)
                    else next.add(row.key)
                    return next
                  })} className="min-h-9 text-sm text-muted hover:text-ink">
                    {expanded.has(row.key) ? uiText("Hide") : uiText("Show")} {row.titles.length} {row.titles.length === 1 ? uiText("title") : uiText("titles")}
                  </button>
                </div>
                {row.classification === 'unknown' && <span className="text-sm text-overtime">{uiText("Needs a look")}</span>}
                {row.classification === 'mixed' && <span className="text-sm text-muted">{uiText("Some titles differ")}</span>}
                <div role="radiogroup" onKeyDown={radioKeyboard} aria-label={uiText("{value0} counts as", {value0: (row.label)})} className="flex overflow-hidden rounded-lg border border-line">
                  {CLASSES.map((c) => {
                    const on = row.rule?.classification === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        tabIndex={(row.rule?.classification ?? CLASSES[0].id) === c.id ? 0 : -1}
                        onClick={() => !on && void decide(row, c.id)}
                        className={`min-h-9 px-3 text-sm transition-colors ${on ? (c.id === 'distraction' ? 'bg-[var(--tf-line-detected)] text-[rgb(20_21_24)]' : 'bg-focus text-on-accent') : 'hover:bg-surface-2'}`}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {r && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">{uiText("Applies")}{SCOPES.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => void rescope(row, sc.id)}
                      className={`min-h-8 rounded-full border px-3 transition-colors ${r.scope === sc.id ? 'border-focus bg-focus/15 text-ink' : 'border-line hover:border-muted'}`}
                    >
                      {sc.id === 'subject' ? uiText("For {value0}", {value0: (nameOf(row.itemId))}) : sc.label}
                    </button>
                  ))}
                </div>
              )}
              {!r && scope && row.rule && (
                <div className="text-sm text-muted">
                  {scope === 'session' ? uiText("Chosen for this session") : scope === 'subject' ? uiText("Chosen for {value0}", {value0: (nameOf(row.rule.itemId))}) : uiText("Always")}
                  {row.rule.matchType === 'title' && row.rule.pattern.includes('+') ? uiText(" · titles with {value0}", {value0: (row.rule.pattern)}) : ''}
                </div>
              )}
              {expanded.has(row.key) && (
                <ul className="ml-3 flex flex-col gap-2 border-l border-line pl-4">
                  {row.titles.map((title) => {
                    const detail: ProgramRow = { ...row, key: `${row.key}:${title.key}`, process: title.process, itemId: title.itemId, exampleTitle: title.title, rule: title.rule, classification: title.classification, titles: [] }
                    const choice = recent[detail.key]
                    return <li key={title.key} className="rounded-lg bg-surface-2/30 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span dir="auto" className="min-w-0 flex-1 break-words text-sm">{title.title}</span>
                        <span className="shrink-0 text-sm text-muted tabular-nums">{formatDuration(title.seconds)}</span>
                        <span className="text-sm text-muted">{CLASSES.find((c) => c.id === title.classification)?.label ?? 'Needs a look'}</span>
                        <Button variant="ghost" size="sm" onClick={() => setRefining(refining === detail.key ? null : detail.key)}>{uiText("Refine")}</Button>
                      </div>
                      {subjects.length > 1 && <p className="text-sm text-muted">{nameOf(title.itemId)}</p>}
                      {choice && <div className="flex flex-wrap items-center gap-2 text-sm text-muted">{uiText("Applies ")}{SCOPES.map((sc) => <button key={sc.id} type="button" onClick={() => void rescope(detail, sc.id)} className={`min-h-9 rounded-full border px-3 ${choice.scope === sc.id ? 'border-focus text-ink' : 'border-line'}`}>{sc.id === 'subject' ? uiText("For {value0}", {value0: (nameOf(title.itemId))}) : sc.label}</button>)}
                      </div>}
                      {refining === detail.key && <Refine row={detail} onSave={async (words, c) => {
                        await decide(detail, c, words)
                        setRefining(null)
                      }} onCancel={() => setRefining(null)} />}
                    </li>
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** A rule from words in the title: "YouTube + Barbara Oakley". */
function Refine({ row, onSave, onCancel }: { row: ProgramRow; onSave: (pattern: string, c: Classification) => Promise<void>; onCancel: () => void }): React.JSX.Element {
  const [words, setWords] = useState('')
  const [c, setC] = useState<Classification>('study')
  const base = row.site ?? row.process
  const pattern = [...(row.site ? [row.site] : []), ...words.split(/[+,]/).map((w) => w.trim()).filter(Boolean)].join(' + ')
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-2/50 p-3">
      <p className="text-sm text-muted">{uiText("Only titles that contain all these words. For example a channel or course name, so that part of ")}{base}{uiText(" counts differently from the rest.")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {row.site && <span className="text-base">{base} +</span>}
        <input
          autoFocus
          dir="auto"
          className={`${inputBase} min-w-56 flex-1`}
          placeholder={uiText("words from the title, e.g. Barbara Oakley")}
          value={words}
          onChange={(e) => setWords(e.target.value)}
        />
        <select aria-label={uiText("Counts as")} className={`${inputBase} w-40`} value={c} onChange={(e) => setC(e.target.value as Classification)}>
          {CLASSES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <Button variant="quiet" size="sm" disabled={!words.trim()} onClick={() => void onSave(pattern, c)}>{uiText("Save rule")}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>{uiText("Cancel")}</Button>
      </div>
      <p dir="auto" className="truncate text-sm text-muted">{uiText("Example title: ")}{row.exampleTitle}</p>
    </div>
  )
}
