import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { ITEM_PALETTE, isHexColor } from '@core/palette'
import { inputBase } from './ui'

interface Props {
  value: string
  onChange: (color: string) => void
}

/** Palette swatches plus a picker and hex field for anything else. */
export function ColorField({ value, onChange }: Props): React.JSX.Element {
  const [hex, setHex] = useState(value)
  useEffect(() => setHex(value), [value])

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {ITEM_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={uiText("Colour {value0}", {value0: (c)})}
          aria-pressed={value.toLowerCase() === c.toLowerCase()}
          onClick={() => onChange(c)}
          className={`size-9 rounded-full transition-transform hover:scale-110 ${
            value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
          }`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        aria-label={uiText("Custom colour")}
        value={isHexColor(value) ? value : '#888888'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-10 cursor-pointer rounded-lg border border-line bg-transparent p-1"
      />
      <input
        type="text"
        dir="ltr"
        spellCheck={false}
        aria-label={uiText("Hex colour")}
        value={hex}
        maxLength={7}
        onChange={(e) => {
          setHex(e.target.value)
          if (isHexColor(e.target.value)) onChange(e.target.value.toUpperCase())
        }}
        className={`${inputBase} w-32 font-mono`}
      />
    </div>
  )
}
