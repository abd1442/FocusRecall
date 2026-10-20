import { t as uiText, useLanguage, displayReason } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { useReasons } from '../store/reasons'

const OPEN_MS = 4_000

type Showing = { kind: 'reason'; distractionId: number } | { kind: 'absence'; minutes: number } | null

/**
 * The one-tap reason picker after "Back", in its own window that never takes
 * keyboard focus. It closes by itself after about 4 seconds (paused while the
 * mouse is over it); with no tap the distraction stays untagged. "Other" is
 * saved as Other and its text is asked in the review, never here.
 *
 * The same window asks the long-absence question: continue the session, or
 * end it where you left.
 */
export function ReasonPicker(): React.JSX.Element {
  useLanguage()
  const [showing, setShowing] = useState<Showing>(null)
  const [left, setLeft] = useState(OPEN_MS)
  const hovered = useRef(false)
  const { ordered } = useReasons()
  // Eight most used, then Other: the grid stays three by three.
  const reasons = [...ordered.slice(0, -1).slice(0, 8), ordered[ordered.length - 1]]

  useEffect(() => {
    const off = window.api.on('reasons:show', (what) => {
      setShowing(what)
      setLeft(OPEN_MS)
    })
    // Only now does main send anything: the first "show" can never be lost.
    void window.api.invoke('popup:ready', 'reasons')
    return off
  }, [])

  useEffect(() => {
    if (showing?.kind !== 'reason') return
    const tick = 100
    const t = setInterval(() => {
      if (hovered.current) return
      setLeft((l) => {
        if (l - tick <= 0) {
          void window.api.invoke('reasons:hide')
          setShowing(null)
          return 0
        }
        return l - tick
      })
    }, tick)
    return () => clearInterval(t)
  }, [showing])

  const close = (): void => {
    setShowing(null)
    void window.api.invoke('reasons:hide')
  }
  const choose = async (kind: string): Promise<void> => {
    if (showing?.kind !== 'reason') return
    const id = showing.distractionId
    close()
    await window.api.invoke('distraction:label', id, kind)
  }
  const absence = async (choice: 'continue' | 'end'): Promise<void> => {
    close()
    await window.api.invoke('session:longAbsence', choice)
  }

  if (showing?.kind === 'absence') {
    return (
      <div className="flex h-viewport flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 select-none">
        <div>
          <div className="text-base font-semibold">{uiText("You were away ")}{showing.minutes}{uiText(" min")}</div>
          <div className="text-sm text-muted">{uiText("Go on with this session, or end it where you left?")}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void absence('continue')} className="min-h-11 rounded-lg bg-focus font-semibold text-on-accent hover:brightness-110">{uiText("Continue")}</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void absence('end')} className="min-h-11 rounded-lg bg-surface-2 text-ink hover:brightness-95">{uiText("End where I left")}</button>
        </div>
      </div>
    )
  }

  // Nothing to answer yet: no buttons that could be clicked for nothing.
  if (!showing) return <div className="h-viewport" />

  return (
    <div
      className="flex h-viewport flex-col overflow-hidden rounded-2xl border border-line bg-surface p-3 select-none"
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-sm font-medium">{uiText("What pulled you away?")}</span>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={close} className="rounded-md px-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">{uiText("Later")}</button>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {reasons.map((r) => (
          <button
            key={r.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void choose(r.id)}
            className="truncate rounded-lg bg-surface-2 px-1.5 text-sm text-ink transition hover:bg-focus hover:text-on-accent"
            title={displayReason(r)}
          >
            {displayReason(r)}
          </button>
        ))}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-muted/60 transition-[width] duration-100 ease-linear" style={{ width: `${(left / OPEN_MS) * 100}%` }} />
      </div>
    </div>
  )
}
