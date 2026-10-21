import { t as uiText, useLanguage } from '../i18n'
import { useEffect, useState } from 'react'

/** Only the timing-safety confirmation remains; Resume asks no reason. */
export function ReasonPicker(): React.JSX.Element {
  useLanguage()
  const [minutes, setMinutes] = useState<number | null>(null)
  useEffect(() => {
    const off = window.api.on('reasons:show', (what) => setMinutes(what.minutes))
    void window.api.invoke('popup:ready', 'reasons')
    return off
  }, [])
  const answer = async (choice: 'continue' | 'end'): Promise<void> => {
    setMinutes(null)
    await window.api.invoke('reasons:hide')
    await window.api.invoke('session:longAbsence', choice)
  }
  if (minutes === null) return <div className="h-viewport" />
  return (
    <div className="flex h-viewport flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 select-none">
      <div>
        <div className="text-base font-semibold">{uiText("You were away ")}{minutes}{uiText(" min")}</div>
        <div className="text-sm text-muted">{uiText("Go on with this session, or end it where you left?")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void answer('continue')} className="min-h-11 rounded-lg bg-focus font-semibold text-on-accent hover:brightness-110">{uiText("Continue")}</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void answer('end')} className="min-h-11 rounded-lg bg-surface-2 text-ink hover:brightness-95">{uiText("End where I left")}</button>
      </div>
    </div>
  )
}
