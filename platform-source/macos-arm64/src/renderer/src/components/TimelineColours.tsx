import { t as uiText } from '../i18n'
import { LINE_PALETTES, paletteFor, tooCloseTo, type LineColors } from '@core/appearance'
import { useAppearance } from '../store/appearance'
import { ColourField } from './ColourField'

function TimelineSample({ line }: { line: LineColors }): React.JSX.Element {
  const pieces = [[(line.focus??'#86A9DB'), 25], [line.distracted, 10], [(line.focus??'#86A9DB'), 15], [line.detected, 10], [(line.focus??'#86A9DB'), 22], [line.idle, 8], [(line.focus??'#86A9DB'), 10]] as const
  return <span aria-hidden="true" className="flex h-7 w-full gap-0.5 overflow-hidden rounded-lg">{pieces.map(([color, width], i) => <span key={i} style={{ background: color, flex: width }} />)}</span>
}

export function TimelineColours(): React.JSX.Element {
  const { appearance: a, update, resolved } = useAppearance()
  const current = paletteFor(a, resolved === 'dark').line
  const kinds = [{key:'focus',label:'Focus',hint:'The same focus colour in every session'}, { key: 'distracted', label: 'Distracted', hint: 'Time you marked as distracted' }, { key: 'detected', label: 'Detected app or site', hint: 'Distraction found by tracking' }, { key: 'idle', label: 'No input', hint: 'Time without keyboard or mouse input' }] as const
  return <div className="flex flex-col gap-6">
    <p className="max-w-3xl text-base text-muted">{uiText("Timeline colours apply to every session.")}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[...LINE_PALETTES.map((p) => ({ id: p.id, name: p.name, line: p[resolved] })), { id: 'custom' as const, name: 'Custom', line: a.lineCustom }].map((p) => <button type="button" key={p.id} aria-pressed={a.linePalette === p.id} onClick={() => void update({ linePalette: p.id })} className={`flex min-w-0 flex-col gap-3 rounded-xl border p-4 text-left transition hover:bg-surface-2 ${a.linePalette === p.id ? 'border-focus bg-focus/10 ring-1 ring-focus' : 'border-line bg-surface'}`}><span className="flex items-center justify-between gap-2 font-medium">{uiText(p.name)}<span aria-hidden="true">{a.linePalette === p.id ? '✓' : ''}</span></span><TimelineSample line={p.line}/></button>)}</div>
    <div className="rounded-xl border border-line bg-surface-2/30 p-5"><h3 className="mb-4 font-semibold">{uiText("Your session timeline")}</h3><TimelineSample line={current}/><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">{kinds.map((k) => ({label:k.label,color:current[k.key]??'#86A9DB'})).map((k) => <span key={k.label} className="flex items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{background:k.color}}/>{uiText(k.label)}</span>)}</div></div>
    <div className="grid gap-4 lg:grid-cols-4">{kinds.map((k) => {
      const close = tooCloseTo(current[k.key]??'#86A9DB',kinds.filter(other=>other.key!==k.key).map(other=>current[other.key]??'#86A9DB'))
      return <div key={k.key} className="rounded-xl border border-line p-4"><ColourField label={k.label} value={current[k.key]??'#86A9DB'} onChange={(color) => void update({ linePalette:'custom', lineCustom:{...current,[k.key]:color} })}/><p className="mt-2 text-sm text-muted">{uiText(k.hint)}</p>{close.length > 0 && <p className="mt-2 text-sm text-overtime">{uiText("Similar colours may be hard to distinguish.")}</p>}</div>
    })}</div>
    <p className="text-sm text-muted">{uiText("Editing a colour selects Custom.")}</p>
  </div>
}
