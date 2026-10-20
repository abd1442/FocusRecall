import { t as uiText } from '../i18n'
import { useState } from 'react'
import { OTHER_REASON } from '@core/distractions'
import { useReasons } from '../store/reasons'
import { Button, inputBase } from './ui'

/**
 * One-tap reasons, most used first. "Other" opens a short line: the text is
 * saved as a new reason and offered from then on.
 */
export function ReasonChips({ selected, onPick, autoFocusOther = false }: { selected?: string; onPick: (kind: string) => void; autoFocusOther?: boolean }): React.JSX.Element {
  const { ordered, add } = useReasons()
  const [typing, setTyping] = useState(autoFocusOther)
  const [text, setText] = useState('')

  const submit = async (): Promise<void> => {
    const t = text.trim()
    if (!t) return
    const id = await add(t)
    setTyping(false)
    setText('')
    onPick(id)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {ordered.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => (r.id === OTHER_REASON ? setTyping(true) : onPick(r.id))}
            className={`min-h-9 rounded-full border px-3.5 text-sm transition-colors ${
              selected === r.id || (r.id === OTHER_REASON && typing) ? 'border-focus bg-focus/15 text-ink' : 'border-line hover:border-muted'
            }`}
          >
            {r.id === OTHER_REASON ? uiText("Other…") : r.label}
          </button>
        ))}
      </div>
      {typing && (
        <form
          className="flex max-w-xl items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input
            autoFocus
            dir="auto"
            className={`${inputBase} flex-1`}
            placeholder={uiText("What was it? It becomes a reason you can pick next time.")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setTyping(false)}
          />
          <Button variant="quiet" size="sm" type="submit" disabled={!text.trim()}>{uiText("Save")}</Button>
        </form>
      )}
    </div>
  )
}
