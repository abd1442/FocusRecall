import { t as uiText, useLanguage } from '../i18n'
import { useEffect, useRef, useState } from 'react'

/**
 * The one-line capture box in its own small window: park a thought (it does
 * not stop the clock), or add a note to the stuck marker just placed. Enter
 * saves, Escape closes; both give the keyboard back to where you were.
 */
export function CaptureBox(): React.JSX.Element {
  useLanguage()
  const [mode, setMode] = useState<'park' | 'stuck'>('park')
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const off = window.api.on('capture:show', ({ mode: m }) => {
      setMode(m)
      setText('')
      setTimeout(() => input.current?.focus(), 30)
    })
    void window.api.invoke('popup:ready', 'capture')
    return off
  }, [])

  const save = async (): Promise<void> => {
    const t = text.trim()
    setText('')
    await window.api.invoke('capture:close')
    if (!t) return
    if (mode === 'park') await window.api.invoke('capture:park', t)
    else await window.api.invoke('capture:mark', 'stuck', t)
  }

  return (
    <div className="flex h-viewport flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{mode === 'park' ? uiText("Park a thought. Drop it and keep studying.") : uiText("Stuck: what on? (optional)")}</span>
        <span className="text-muted">{uiText("Enter saves · Esc closes")}</span>
      </div>
      <input
        ref={input}
        dir="auto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') void window.api.invoke('capture:close')
        }}
        placeholder={mode === 'park' ? uiText("Call the bank · look up that word …") : uiText("The step from (3) to (4)")}
        className="min-h-11 w-full rounded-lg border border-line bg-writing px-3 text-base text-writing-ink focus:border-focus focus:outline-none"
      />
    </div>
  )
}
