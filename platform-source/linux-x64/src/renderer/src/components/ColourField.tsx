import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { inputClass } from './ui'

/** A colour swatch and an exact, keyboard-editable hex value share one label. */
export function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): React.JSX.Element {
  const [hex, setHex] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const shownLabel=uiText(label)
  useEffect(() => { setHex(value); setInvalid(false) }, [value])
  const commit = (): void => {
    const candidate = hex.startsWith('#') ? hex : '#' + hex
    if (!/^#[a-f0-9]{6}$/i.test(candidate)) { setInvalid(true); return }
    setInvalid(false); setHex(candidate.toUpperCase()); onChange(candidate.toUpperCase())
  }
  return <label className="flex min-w-0 flex-col gap-2">
    <span className="text-sm font-medium">{shownLabel}</span>
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <input type="color" aria-label={uiText('{label} colour picker',{label:shownLabel})} value={value} onChange={(e) => onChange(e.target.value)} className="colour-swatch h-12 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1" />
      <input dir="ltr" spellCheck={false} aria-label={uiText('{label} hex colour',{label:shownLabel})} aria-invalid={invalid} value={hex} maxLength={7} onChange={(e) => { setHex(e.target.value); setInvalid(false) }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setHex(value); setInvalid(false) } }} className={`${inputClass} min-w-28 basis-28 grow font-mono`} />
    </span>
    {invalid && <span role="alert" className="text-sm text-status-error">{uiText("Use six hex digits, for example #365F8A.")}</span>}
  </label>
}
