import { radioKeyboard } from '../components/radioKeyboard'
import { formatDuration, count } from '../i18n'
import { t as uiText } from '../i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionReview as Review } from '@core/api'
import { GOAL_RESULTS } from '@core/captures'
import { cardAnswered, questionCards, type QuestionCard } from '@core/logcards'
import { fieldByKey, fillSliderDefaults, prefillLog, resolveUnit, setupDefault, unitMemoryKey, type LogValues, type ProgressValue } from '@core/logfields'
import { sessionSubjects, type FinishedBlock } from '@core/session'
import { rememberedDetailSuggestions,sessionLogEntries, splitBySection, type LogAnswers } from '@core/sessionLog'

import { LogForm } from '../components/log/LogForm'
import { FieldInput } from '../components/log/FieldInput'
import { SessionReview } from '../components/SessionReview'
import { needsLook } from '../components/SessionTimeline'
import { Button, inputBase } from '../components/ui'
import { useKey } from '../hooks'
import { useLogSchema } from '../store/logSchema'
import { sessionCommand, useSettings } from '../store/session'

/** New values for a form; a slider whose value changed is no longer an untouched default. */
function touched(prev: LogAnswers | undefined, next: LogValues): LogAnswers {
  const before = prev?.values ?? {}
  return { notes: prev?.notes ?? {}, ...prev, values: next, untouched: (prev?.untouched ?? []).filter((id) => next[id] === before[id]) }
}

/**
 * The log after a session. A short header, then the essential questions as
 * large cards (per subject in a mixed session, plus the goal if one was set)
 * with a small "n of m answered". Everything else sits below in calm, collapsed
 * sections: the timeline and distractions, programs and sites, the study
 * setup, today's check-in and "More detail". Pre-filled from the last session
 * on each subject and the remembered setup; a pre-filled slider counts as
 * answered only once it is confirmed (Keep, or Enter) or moved.
 */
export function LogPanel({ blocks }: { blocks: FinishedBlock[] }): React.JSX.Element {
  const { schema, loaded } = useLogSchema()
  const settings = useSettings((s) => s.settings)
  const setSetting = useSettings((s) => s.set)
  const subjects = useMemo(() => sessionSubjects(blocks), [blocks])
  const [perSubject, setPerSubject] = useState<Record<number, LogAnswers> | null>(null)
  const [activityHistory, setActivityHistory] = useState<Record<number, string[]>>({})
  const [shared, setShared] = useState<LogAnswers>({ values: {}, notes: {} })
  const [draftError,setDraftError]=useState('')
  const saving=useRef(false)
  const [busy,setBusy]=useState(false)
  // Session pushes create new arrays; only reload when the set of subjects changes.
  const subjectKey = subjects.map((s) => s.itemId).join(',')
  const sorted = useMemo(() => [...blocks].sort((a, b) => Date.parse(a.focusStartedAt) - Date.parse(b.focusStartedAt)), [blocks])
  const [detailsOpen,setDetailsOpen]=useState(false)

  useEffect(() => {
    if (!loaded) return
    let alive = true
    void (async () => {
      const history = await window.api.invoke('log:setupHistory')
      const savedDraft = await window.api.invoke('session:getLogDraft',blocks[0].sessionId) as {perSubject?:Record<number,LogAnswers>;shared?:LogAnswers}|null
      const setup = settings.setupOverride ?? setupDefault(schema, history, settings.setupDefaultMode)
      const filled = await Promise.all(
        subjects.map(async (s) => {
          const latest = s.blockIds[s.blockIds.length - 1]
          const [prev, activities] = await Promise.all([
            window.api.invoke('log:previous', s.itemId, latest),
            window.api.invoke('log:activityHistory', s.itemId)
          ])
          const values = prefillLog(schema, prev, setup, {
            itemId: s.itemId,
            itemUnit: s.itemUnit,
            plannedActivity: settings.plannedActivity,
            unitMemory: settings.unitMemory
          })
          const progress = fieldByKey(schema, 'progress')
          if (progress && !settings.progressRangeMemory[s.itemId]) {
            const p = values[progress.id] as ProgressValue
            values[progress.id] = { ...p, from: null, to: null }
          }
          return [s.itemId, splitBySection(schema, { values:{...rememberedDetailSuggestions(schema,prev),...values}, notes: {} }), activities] as const
        })
      )
      if (!alive) return
      setActivityHistory(Object.fromEntries(filled.map(([id, , activities]) => [id, activities])))
      // Every slider starts with a value (the last answer, else the middle) and counts as untouched until moved.
      setPerSubject(
        Object.fromEntries(
          filled.map(([id, x]) => {
            const d = fillSliderDefaults(schema, x.quick.values, ['quick'])
            return [id, savedDraft?.perSubject?.[id] ?? { ...x.quick, values: d.values, untouched: [...new Set([...d.untouched, ...Object.keys(d.values).map(Number).filter(id => d.values[id] != null)])] }]
          })
        )
      )
      const first = filled[0]?.[1].shared ?? { values: {}, notes: {} }
      const d = fillSliderDefaults(schema, first.values, ['setup', 'detail'])
      setShared(savedDraft?.shared ?? { ...first, values: d.values, untouched: [...new Set([...d.untouched, ...Object.keys(d.values).map(Number).filter(id => d.values[id] != null)])] })
    })().catch((e)=>{if(alive)setDraftError(String(e))})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey, loaded])

  useEffect(() => {
    if (!perSubject || !blocks[0]) return
    void window.api.invoke('session:saveLogDraft',blocks[0].sessionId,{perSubject,shared}).catch((e)=>setDraftError(String(e)))
  }, [perSubject,shared])

  async function save(): Promise<void> {
    if (!perSubject || saving.current) return
    saving.current=true;setBusy(true)
    try {
    // Remember the unit used per subject and activity, so it comes back next time.
    const activity = fieldByKey(schema, 'activity')
    const progress = fieldByKey(schema, 'progress')
    const memory = { ...settings.unitMemory }
    for (const s of subjects) {
      const v = perSubject[s.itemId]?.values ?? {}
      const act = activity && (v[activity.id] as string | undefined)
      const unit = progress && (v[progress.id] as ProgressValue | undefined)?.unit
      if (act && unit) memory[unitMemoryKey(s.itemId, act)] = unit
    }
    await setSetting('unitMemory', memory)
    const saved = await sessionCommand(async () => { const entries=sessionLogEntries(schema, subjects, perSubject, shared);await window.api.invoke('session:submitLog',entries);return true })
    if (saved && settings.setupOverride) await setSetting('setupOverride', null)
    }catch(error){setDraftError(String(error))}finally{saving.current=false;setBusy(false)}
  }

  // The session's distractions, programs and goal, for the summaries and the goal card.
  const ids = sorted.map((b) => b.id)
  const idKey = ids.join(',')
  const [review, setReview] = useState<Review | null>(null)
  const reloadReview = useCallback(async () => setReview(await window.api.invoke('session:review', ids)), [idKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void reloadReview()
    const off = [window.api.on('distractions:changed', () => void reloadReview())]
    return () => off.forEach((f) => f())
  }, [reloadReview])

  const cards = useMemo(() => questionCards(schema), [schema])
  const mixed = subjects.length > 1
  const total = blocks.reduce((s, b) => s + b.focusSeconds, 0)
  const sessionId = sorted[0]?.sessionId

  // Every card on screen, in order: per subject, then the goal.
  type Slot = { key: string; itemId: number | null; card: QuestionCard | null }
  const primaryCards=cards.filter(c=>['activity','focus','understanding'].includes(c.field.key??''))
  const extraCards=cards.filter(c=>!primaryCards.includes(c))
  const visibleCards=detailsOpen?[...primaryCards,...extraCards]:primaryCards
  const slots: Slot[] = [
    ...subjects.flatMap((s) => visibleCards.map((c) => ({ key: `${s.itemId}:${c.field.id}`, itemId: s.itemId, card: c }))),
    ...(detailsOpen&&review?.goal ? [{ key: 'goal', itemId: null, card: null }] : [])
  ]
  const isAnswered = (slot: Slot): boolean => {
    if (!slot.card) return !!review?.goalResult
    const a = perSubject?.[slot.itemId!]
    return !!a && cardAnswered(slot.card.field, a.values, a.untouched)
  }
  const answeredCount = slots.filter(isAnswered).length

  const [active, setActive] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const saveRef = useRef<HTMLDivElement>(null)
  /** Confirm a card's pre-filled slider: it now counts as answered. */
  const confirm = (slot: Slot): void => {
    if (!slot.card || slot.itemId === null) return
    const id = slot.card.field.id
    const itemId = slot.itemId
    setPerSubject((p) => (p ? { ...p, [itemId]: { ...p[itemId], untouched: (p[itemId]?.untouched ?? []).filter((x) => x !== id) } } : p))
  }
  const focusSlot = (key: string | null): void => {
    if (!key) {
      setActive(null)
      const button = saveRef.current?.querySelector('button')
      button?.focus()
      button?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    const el = cardRefs.current.get(key)
    if (!el) return
    setActive(key)
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const control = el.querySelector<HTMLElement>('input[type=range], button[aria-pressed="true"], button[aria-checked="true"], input, button[aria-pressed], button[role=radio]')
    ;(control ?? el).focus({ preventScroll: true })
  }
  /** Enter on a card: confirm it and go to the next card (after the last one, to Save). */
  const next = (key: string): void => {
    const i = slots.findIndex((x) => x.key === key)
    if (i >= 0) confirm(slots[i])
    focusSlot(slots[i + 1]?.key ?? null)
  }

  useKey(
    (e) => {
      if (e.key !== 'Enter') return
      if (e.ctrlKey) {
        e.preventDefault()
        void save()
        return
      }
      const t = e.target as HTMLElement
      if (t instanceof HTMLTextAreaElement) return
      // Let action buttons (More, Add range, steppers) receive their native Enter click.
      if (t.closest('button, select, a, [contenteditable=true], [role=button]')) return
      const card = t.closest?.('[data-card]') as HTMLElement | null
      if (card) {
        e.preventDefault()
        next(card.dataset.card!)
        return
      }
      const inText = t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox'
      if (inText || t instanceof HTMLButtonElement || t.getAttribute?.('role') === 'button' || t.getAttribute?.('role') === 'slider') return
      // Outside the cards: go to the first unanswered one, or save when all are answered.
      e.preventDefault()
      const open = slots.find((x) => !isAnswered(x))
      if (open) focusSlot(open.key)
      else void save()
    },
    [perSubject, shared, review, slots.length]
  )

  const name = mixed ? count(subjects.length,'subject') : (subjects[0]?.itemName ?? '')
  const look = review ? review.distractions.filter(needsLook).length : 0
  const programsOpen = review ? review.programs.filter((r) => r.classification === 'unknown').length : 0
  const sessionSummary = review
    ? [
        review.distractions.length === 0 ? uiText('No distractions') : count(review.distractions.length,'distraction'),
        look ? uiText('To review: {count}',{count:look}) : '',
        review.programs.length ? count(review.programs.length,'program')+(programsOpen ? ' · '+uiText('To classify: {count}',{count:programsOpen}) : '') : ''
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const noteField = fieldByKey(schema, 'note')
  const activityField = cards.find((x) => x.field.key === 'activity')?.field
  const progressField = cards.find((x) => x.field.key === 'progress')?.field

  const renderQuestions=(shownCards:QuestionCard[]):React.ReactNode=>(
perSubject &&
          subjects.map((s) => {
            const a = perSubject[s.itemId]
            const values = a?.values ?? {}
            const activity = activityField?.options.find((o) => o.id === values[activityField.id])
            return (
              <section key={s.itemId} className="flex flex-col gap-5" aria-label={s.itemName}>
                {mixed && (
                  <div className="mt-2 flex items-center gap-3 text-xl">
                    <span className="h-7 w-1.5 rounded-full" style={{ background: s.itemColor }} />
                    <span dir="auto" className="font-semibold">
                      {s.itemName}
                    </span>
                    <span className="text-muted">· {formatDuration(s.focusSeconds)}</span>
                  </div>
                )}
                {/* Two columns on a wide window; the long activity list takes the full width. */}
                <div className="grid items-start gap-4 md:grid-cols-2">
                {shownCards.map((c) => {
                  const slot = { key: `${s.itemId}:${c.field.id}`, itemId: s.itemId, card: c }
                  const pending = (a?.untouched ?? []).includes(c.field.id) && values[c.field.id] != null
                  return (
                    <QuestionCardView
                      key={slot.key}
                      className={c.field.key === 'activity' ? 'md:col-span-2' : ''}
                      compact={primaryCards.includes(c)}
                      slotKey={slot.key}
                      question={c.question}
                      answered={isAnswered(slot)}
                      active={active === slot.key}
                      onActive={() => setActive(slot.key)}
                      register={(el) => {
                        if (el) cardRefs.current.set(slot.key, el)
                        else cardRefs.current.delete(slot.key)
                      }}
                      onKeep={pending ? () => confirm(slot) : undefined}
                    >
                      <FieldInput
                        field={c.field}
                        value={values[c.field.id]}
                        suggested={pending}
                        onChange={(v) =>
                          setPerSubject((p) => {
                            const prev = p![s.itemId]
                            const nextValues: LogValues = { ...(prev?.values ?? {}), [c.field.id]: v }
                            // A different activity switches the progress unit (and clears the range), as in the form.
                            if (c.field.key === 'activity' && progressField) {
                              const act = c.field.options.find((o) => o.id === v)
                              const old = prev?.values[progressField.id] as ProgressValue | undefined
                              const unit = resolveUnit(act, s.itemId, s.itemUnit, settings.unitMemory)
                              if (!old || old.unit !== unit) nextValues[progressField.id] = { amount: old?.amount ?? null, unit, from: null, to: null }
                            }
                            const answered = touched(prev, nextValues)
                            answered.untouched = (answered.untouched ?? []).filter(id => id !== c.field.id)
                            return { ...p!, [s.itemId]: answered }
                          })
                        }
                        activity={activity}
                        activityHistory={activityHistory[s.itemId] ?? []}
                        itemId={s.itemId}
                        itemUnit={s.itemUnit}
                        showLabel={false}
                        large={!primaryCards.includes(c)}
                      />
                      {/* The group's optional note, under its last question. */}
                      {cards.filter((x) => x.field.groupId === c.field.groupId).at(-1) === c && (
                        <GroupNote
                          value={a?.notes[c.field.groupId] ?? ''}
                          onChange={(text) => setPerSubject((p) => ({ ...p!, [s.itemId]: { ...p![s.itemId], notes: { ...(p![s.itemId]?.notes ?? {}), [c.field.groupId]: text } } }))}
                        />
                      )}
                    </QuestionCardView>
                  )
                })}
                </div>
              </section>
            )
          })
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-10 pt-10">
        {draftError && <p role="alert" className="text-status-error">{uiText("Could not preserve the log draft: ")}{draftError}{uiText(". Keep this screen open and try again.")}</p>}
        <header className="mb-2 flex flex-col gap-4 pr-40">
          <h1 className="text-3xl font-medium tracking-tight" dir="auto">{uiText("How did it go?")}</h1>
          <p className="text-muted">{formatDuration(total)} · {name}</p><p className="text-sm text-muted">{uiText("Previous answers are suggestions. Keep or change what applies.")}</p>
        </header>

        {renderQuestions(primaryCards)}
        <button type="button" aria-expanded={detailsOpen} aria-controls="session-log-details" onClick={()=>setDetailsOpen(v=>!v)} className="flex min-h-12 items-center gap-3 self-start rounded-xl border border-line bg-surface px-5 py-3 text-focus"><span aria-hidden="true">{detailsOpen?'−':'+'}</span>{detailsOpen?uiText("Hide details"):uiText("Add more details")}</button>
        {detailsOpen&&<div id="session-log-details" className="flex flex-col gap-6">
          <p className="text-sm text-muted">{uiText("Answers are remembered for next time. Confirm the suggestions that still apply; notes and progress amounts are not repeated.")}</p>
          {renderQuestions(extraCards)}
        {review?.goal && sessionId !== undefined && (
          <QuestionCardView
            slotKey="goal"
            question="Did you reach your goal?"
            answered={!!review.goalResult}
            active={active === 'goal'}
            onActive={() => setActive('goal')}
            register={(el) => {
              if (el) cardRefs.current.set('goal', el)
              else cardRefs.current.delete('goal')
            }}
          >
            <p dir="auto" className="-mt-2 text-lg text-muted">
              {review.goal}
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" onKeyDown={radioKeyboard} aria-label={uiText("Did you reach your goal?")}>
              {GOAL_RESULTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={review.goalResult === g.id}
            tabIndex={(review.goalResult ?? GOAL_RESULTS[0].id) === g.id ? 0 : -1}
                  onClick={async () => {
                    await window.api.invoke('session:setGoalResult', sessionId, review.goalResult === g.id ? null : g.id)
                    await reloadReview()
                  }}
                  className={`min-h-12 rounded-full border px-6 text-lg transition-colors ${
                    review.goalResult === g.id ? 'border-transparent bg-focus text-on-accent' : 'border-line hover:border-muted'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </QuestionCardView>
        )}

        {/* Timeline and classifications live inside the one optional details panel. */}
        {sorted[0] && (
          <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface py-7 pr-8 pl-9">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-2xl font-medium tracking-tight">{uiText("This session")}</h2>
              <span className={`text-base ${look + programsOpen > 0 ? 'text-overtime' : 'text-muted'}`}>{sessionSummary}</span>
            </div>
            <SessionReview
              sessionId={sorted[0].sessionId}
              hideGoal
              onChanged={() => void reloadReview()}
              parts={sorted.map((b) => ({ id: b.id, itemId: b.itemId, itemName: b.itemName, itemColor: b.itemColor, start: Date.parse(b.focusStartedAt), end: Date.parse(b.focusEndedAt) }))}
            />
          </section>
        )}

        {/* Existing session questions, together without another expansion layer. */}
        <div className="mt-4 flex flex-col gap-4">
          {perSubject && subjects[0] && (
            <>
              <LogForm
                part="shared"
                values={shared.values}
                notes={shared.notes}
                itemId={subjects[0].itemId}
                itemUnit={subjects[0].itemUnit}
                onValues={(u) => setShared((x) => touched(x, u(x.values)))}
                onNotes={(u) => setShared((x) => ({ ...x, notes: u(x.notes) }))}
                untouched={shared.untouched}
                onKeep={(ids) => setShared((x) => ({ ...x, untouched: (x.untouched ?? []).filter((id) => !ids.includes(id)) }))}
                cards
                unified
              />
            </>
          )}
        </div>

        {/* The session note: last on the screen, alone, as a writing card. */}
        {noteField && !noteField.archived && (
          <label className="flex flex-col gap-3 rounded-2xl border border-line bg-surface py-7 pr-8 pl-9 focus-within:border-focus">
            <span className="text-2xl font-medium tracking-tight">{uiText("Anything else about this session?")}</span>
            <textarea
              dir="auto"
              rows={4}
              spellCheck
              placeholder={uiText("Optional")}
              className="font-writing w-full resize-y rounded-xl border border-line bg-writing px-5 py-4 leading-[1.65] text-writing-ink outline-none placeholder:text-muted focus:border-focus"
              style={{ fontSize: 'var(--tf-writing-size)' }}
              value={typeof shared.values[noteField.id] === 'string' ? (shared.values[noteField.id] as string) : ''}
              onChange={(e) => {
                const text = e.target.value
                setShared((x) => touched(x, { ...x.values, [noteField.id]: text || null }))
              }}
            />
          </label>
        )}

        </div>}

        <div ref={saveRef} className="sticky bottom-0 -mx-10 mt-2 flex flex-wrap items-center justify-end gap-5 border-t border-line bg-bg/95 px-10 py-4 backdrop-blur">
          <span className="mr-auto text-sm text-muted">{uiText("Enter: next question · Ctrl + Enter: continue to rest")}</span>
          <span className="text-base text-muted tabular-nums">
            {answeredCount}{uiText(" recorded answers")}</span>
          <Button variant="primary" disabled={busy||!perSubject} onClick={()=>void save()}>{busy?uiText("Saving…"):uiText("Continue to rest")}</Button>
        </div>
      </div>
    </div>
  )
}

/** "3 of 5 answered" with a thin bar that fills. */
/**
 * One question: the question in large text and its control under it. The
 * active card has the accent colour; an answered one a check and an accent
 * edge. A pre-filled slider offers "Keep" to confirm it.
 */
function QuestionCardView({
  className = '',
  compact = false,
  slotKey,
  question,
  answered,
  active,
  onActive,
  register,
  onKeep,
  children
}: {
  className?: string
  compact?:boolean
  slotKey: string
  question: string
  answered: boolean
  active: boolean
  onActive: () => void
  register: (el: HTMLElement | null) => void
  onKeep?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section
      ref={register}
      data-card={slotKey}
      tabIndex={-1}
      onFocusCapture={onActive}
      onPointerDownCapture={onActive}
      className={`relative flex flex-col ${compact?'gap-3 p-5':'gap-5 py-7 pr-8 pl-9'} overflow-hidden rounded-2xl border bg-surface outline-none transition-[border-color,box-shadow] ${className} ${
        active ? 'border-focus shadow-[0_0_0_1px_var(--tf-focus)]' : 'border-line'
      }`}
    >
      {/* The accent edge of an answered card. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 transition-colors ${answered ? 'bg-focus' : 'bg-transparent'}`} />
      <div className="flex items-center gap-4">
        <h2 className={`flex-1 ${compact?'text-xl':'text-2xl'} font-medium tracking-tight`}>{question}</h2>
        {onKeep && (
          <Button variant="quiet" size="sm" onClick={onKeep}>{uiText("Keep")}</Button>
        )}
        <span
          role="img"
          aria-label={answered ? uiText("Answered") : uiText("Not answered yet")}
          className={`grid size-8 shrink-0 place-items-center rounded-full text-base transition-colors ${
            answered ? 'bg-focus/15 text-focus' : 'border border-dashed border-line text-transparent'
          }`}
        >
          ✓
        </span>
      </div>
      {children}
      {onKeep && !compact && <p className="-mt-1 text-sm text-muted">{uiText("Suggested answer · adjust or press Keep")}</p>}
    </section>
  )
}

/** "Add a note" that opens into a one-line note field (open while it has text). */
function GroupNote({ value, onChange }: { value: string; onChange: (text: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(value.length > 0)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm text-muted hover:text-ink">{uiText("+ Add a note")}</button>
    )
  return (
    <input
      autoFocus={!value}
      dir="auto"
      aria-label={uiText("Note")}
      placeholder={uiText("Note (optional)")}
      className={`${inputBase} text-base`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

