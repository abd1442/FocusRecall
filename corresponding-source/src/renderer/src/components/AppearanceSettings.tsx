import { t as uiText, useLanguage } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import {
  PANEL_SIZES, hasSurfaceOverrides, stageOverridePatch, themeTokensFor, type Accents, type Appearance, type ThemeMode
} from '@core/appearance'
import { DARK_THEMES, LIGHT_THEMES, guardStageColour, resolveThemeTokens, STAGE_KEYS, themeById, type NavTone, type ThemeSeed } from '@core/themes'
import { useAppearance } from '../store/appearance'
import { Button, Segmented } from './ui'
import { ColourField } from './ColourField'
import { CircularTimer } from './CircularTimer'
import { floatingPanelSize } from '@core/floatingTimer'
import '../screens/floatingPanel.css'

type Side = 'light' | 'dark'
const tokensOf = (id: string, mode: Side): Record<string, string> => resolveThemeTokens({ themeId: id, mode })
const isRtl = (): boolean => document.documentElement.dir === 'rtl'

/** One selected style everywhere: selected border, a 1px ring and the selected background. */
export const selectedClass = 'border-selected-line bg-selected ring-1 ring-selected-line'

// --- Undo toast ---------------------------------------------------------------

let undoListener: ((previous: Appearance | null) => void) | null = null
/** Remembers the appearance before a theme change so the toast can put it back. */
export function offerUndo(previous: Appearance): void { undoListener?.(previous) }

export function ThemeUndoToast(): React.JSX.Element | null {
  const { update } = useAppearance()
  const [previous, setPrevious] = useState<Appearance | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    undoListener = (p) => { setPrevious(p); clearTimeout(timer); timer = setTimeout(() => setPrevious(null), 8000) }
    return () => { undoListener = null; clearTimeout(timer) }
  }, [])
  if (!previous) return null
  return <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-line bg-raised px-5 py-3 shadow-[var(--fr-shadow-raised)]">
    <span>{uiText("Theme changed.")}</span>
    <Button size="sm" onClick={() => { void update(previous); setPrevious(null) }}>{uiText("Undo")}</Button>
  </div>
}

// --- Mode ---------------------------------------------------------------------

/** The mode card shows the saved theme(s) it will put on screen. */
function ModePicture({ mode, a }: { mode: ThemeMode; a: Appearance }): React.JSX.Element {
  const light = themeById(a.lightTheme)!, dark = themeById(a.darkTheme)!
  return <span aria-hidden="true" className="relative block w-24 shrink-0">
    {mode === 'system'
      ? <><ThemeTile theme={dark} /><span className="absolute inset-0" style={{ clipPath: isRtl() ? 'inset(0 0 0 50%)' : 'inset(0 50% 0 0)' }}><ThemeTile theme={light} /></span></>
      : <ThemeTile theme={mode === 'light' ? light : dark} />}
  </span>
}

/** Light, Dark or Follow Windows: a radio group of pictures. */
export function ThemeModeCards(): React.JSX.Element {
  const { appearance: a, update } = useAppearance()
  const modes: { id: ThemeMode; label: string; hint: string }[] = [
    { id: 'light', label: 'Light', hint: 'Always the light theme' },
    { id: 'dark', label: 'Dark', hint: 'Always the dark theme' },
    { id: 'system', label: 'Follow Windows', hint: 'Switches with Windows light and dark mode' }
  ]
  return <RadioGroup label={uiText("Mode")} className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-3" value={a.mode} values={modes.map(m => m.id)} onChange={(mode) => void update({ mode })}>
    {(m: ThemeMode, props) => {
      const mode = modes.find(x => x.id === m)!
      return <button {...props} key={m} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-start transition ${a.mode === m ? selectedClass : 'border-line bg-surface hover:bg-surface-2'}`}>
        <ModePicture mode={m} a={a} />
        <span className="min-w-0"><span className="block font-semibold">{uiText(mode.label)}</span><span className="block text-sm text-muted">{uiText(mode.hint)}</span></span>
      </button>
    }}
  </RadioGroup>
}

// --- Theme pickers ------------------------------------------------------------

/** A theme tile is drawn from that theme's own tokens, so the tile is the preview. */
function ThemeTile({ theme }: { theme: ThemeSeed }): React.JSX.Element {
  const s = tokensOf(theme.id, theme.mode)
  return <span aria-hidden="true" className="theme-tile-mini flex h-14 overflow-hidden rounded-md border border-black/15" style={{ background: s['bg.canvas'] }}>
    <span className="flex w-[22%] flex-col gap-[3px] px-[3px] py-[5px]" style={{ background: s['nav.bg'] }}>
      <i className="h-1.5 rounded-[2px]" style={{ background: s['nav.active.bg'] }} />
      <i className="h-0.5 rounded-[2px] opacity-50" style={{ background: s['nav.muted'] }} />
      <i className="h-0.5 rounded-[2px] opacity-50" style={{ background: s['nav.muted'] }} />
    </span>
    <span className="flex flex-1 flex-col gap-1 p-1.5">
      <i className="h-[3px] w-3/5 rounded-[2px] opacity-70" style={{ background: s['text.primary'] }} />
      <span className="flex flex-1 items-end justify-between rounded p-[3px]" style={{ background: s['surface.base'], border: `1px solid ${s['border.default']}` }}>
        <span className="flex gap-0.5">{STAGE_KEYS.map(k => <i key={k} className="size-[5px] rounded-full" style={{ background: s[`stage.${k}`] }} />)}</span>
        <i className="h-[7px] w-[18px] rounded-[3px]" style={{ background: s['accent.default'] }} />
      </span>
    </span>
  </span>
}

const themeLabel = (theme: ThemeSeed): string => uiText(theme.name)

/** Which palette the gallery edits. Light and Dark edit their own; Follow Windows keeps both, so a switch picks one. */
function useGallerySide(): [Side, (side: Side) => void] {
  const { appearance: a, resolved } = useAppearance()
  const [picked, setPicked] = useState<Side | null>(null)
  useEffect(() => { setPicked(null) }, [a.mode])
  return [a.mode === 'system' ? picked ?? resolved : a.mode, setPicked]
}

function ThemeSwatch({ id, side }: { id: string; side: Side }): React.JSX.Element {
  const s = tokensOf(id, side)
  return <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md border border-black/15" style={{ background: s['bg.canvas'] }}>
    <i className="size-3.5 rounded-full" style={{ background: s['accent.default'] }} />
  </span>
}

/** Follow Windows only: the two saved themes as tabs, each showing its current choice. */
function PaletteTabs({ side, onChange }: { side: Side; onChange: (side: Side) => void }): React.JSX.Element {
  const { appearance: a, resolved } = useAppearance()
  const ref = useRef<HTMLDivElement>(null)
  const go = (next: Side): void => { onChange(next); ref.current?.querySelector<HTMLElement>(`[data-palette-tab="${next}"]`)?.focus() }
  return <div ref={ref} role="tablist" aria-label={uiText("Theme to change")} className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-1 rounded-xl bg-surface-2 p-1">
    {(['light', 'dark'] as Side[]).map(s => {
      const id = s === 'light' ? a.lightTheme : a.darkTheme, on = s === side, live = s === resolved
      return <button key={s} type="button" role="tab" id={`palette-tab-${s}`} aria-selected={on} aria-controls="palette-gallery" tabIndex={on ? 0 : -1} data-palette-tab={s}
        onClick={() => onChange(s)}
        onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) { e.preventDefault(); go(e.key === 'Home' ? 'light' : e.key === 'End' ? 'dark' : s === 'light' ? 'dark' : 'light') } }}
        className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-start transition ${on ? 'bg-surface text-ink shadow-sm ring-1 ring-selected-line' : 'text-muted hover:bg-surface hover:text-ink'}`}>
        <ThemeSwatch id={id} side={s} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{uiText(s === 'light' ? "Light theme" : "Dark theme")}</span>
          <span className="block truncate text-sm">{themeLabel(themeById(id)!)}{live && <span className="text-accent-text"> · {uiText("In use now")}</span>}</span>
        </span>
      </button>
    })}
  </div>
}

/** One gallery for one palette. Choosing a tile changes that saved theme; the on-screen one changes immediately. */
export function ThemeGallery(): React.JSX.Element {
  useLanguage()
  const { appearance: a, update, resolved } = useAppearance()
  const [side, setSide] = useGallerySide()
  const list = side === 'light' ? LIGHT_THEMES : DARK_THEMES
  const order = [...list.filter(x => x.isDefault), ...list.filter(x => !x.isDefault)]
  const selected = side === 'light' ? a.lightTheme : a.darkTheme
  const other: Side = side === 'light' ? 'dark' : 'light', otherId = other === 'light' ? a.lightTheme : a.darkTheme
  const live = resolved === side
  const title = uiText(side === 'light' ? "Light theme" : "Dark theme")
  const note = live ? uiText("In use now") : uiText(side === 'dark' ? "Used when Windows is dark" : "Used when Windows is light")
  const choose = (id: string): void => {
    if (id === selected) return
    offerUndo(a)
    void update(side === 'light' ? { lightTheme: id } : { darkTheme: id })
  }
  return <div className="rounded-2xl border border-line bg-surface p-4">
    {a.mode === 'system'
      ? <div className="mb-4 flex flex-col gap-2"><p className="text-sm text-muted">{uiText("A14 Pomodoro follows Windows and keeps one theme for each mode. Select which one to change.")}</p><PaletteTabs side={side} onChange={setSide} /></div>
      : <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{title}</span>
        <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-accent-subtle-ink">● {uiText("In use now")}</span></div>}
    <div id="palette-gallery" role={a.mode === 'system' ? 'tabpanel' : undefined} aria-labelledby={a.mode === 'system' ? `palette-tab-${side}` : undefined}>
      <RadioGroup label={`${title} · ${note}`} className="grid grid-cols-[repeat(auto-fill,minmax(8.25rem,1fr))] gap-2" value={selected} values={order.map(x => x.id)} onChange={choose}>
        {(id: string, props) => {
          const theme = themeById(id)!, on = id === selected
          return <button {...props} key={id} aria-label={uiText(side === 'light' ? "{name} light theme" : "{name} dark theme", { name: themeLabel(theme) })} aria-description={theme.isDefault ? uiText("Default") : undefined}
            className={`relative min-w-0 rounded-xl border p-1.5 text-start transition ${on ? selectedClass : 'border-transparent hover:bg-surface-2'}`}>
            {on && <span aria-hidden="true" className="absolute -top-1 -end-1 z-10 grid size-5 place-items-center rounded-full border-2 border-surface bg-accent text-[11px] font-bold text-on-accent">✓</span>}
            <ThemeTile theme={theme} />
            <span className={`mt-1 flex justify-between gap-1 truncate text-xs ${on ? 'font-semibold text-ink' : 'text-muted'}`}><span className="truncate">{themeLabel(theme)}</span>{theme.isDefault && <span aria-hidden="true">★</span>}</span>
          </button>
        }}
      </RadioGroup>
    </div>
    {a.mode !== 'system' && <p className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-sm text-muted">
      <ThemeSwatch id={otherId} side={other} />
      {uiText(other === 'dark' ? "Dark mode uses {name}. Select Dark above to change it." : "Light mode uses {name}. Select Light above to change it.", { name: themeLabel(themeById(otherId)!) })}
    </p>}
  </div>
}

// --- Sidebar ------------------------------------------------------------------

function SidebarPicture({ nav, active, canvas, width = '30%', simple = false }: { nav: string; active: string; canvas: string; width?: string; simple?: boolean }): React.JSX.Element {
  return <span aria-hidden="true" className="mb-2 flex h-12 overflow-hidden rounded-lg border border-line" style={{ background: canvas }}>
    <i className="relative" style={{ width, background: nav }}><i className="absolute inset-x-1.5 top-2 h-2 rounded-[3px]" style={{ background: simple ? 'transparent' : active, border: simple ? `1px solid ${active}` : undefined }} /></i>
  </span>
}

export function SidebarChoices(): React.JSX.Element {
  const { appearance: a, update, resolved } = useAppearance()
  const t = themeTokensFor(a, resolved)
  const design = a.sidebarCollapsed ? 'rail' : a.sidebarStyle
  const designs: { id: 'journal' | 'simple' | 'rail'; label: string; width: string }[] = [
    { id: 'journal', label: 'Study Journal', width: '30%' }, { id: 'simple', label: 'Simple', width: '30%' }, { id: 'rail', label: 'Icon rail', width: '14%' }
  ]
  const tones: { id: NavTone; label: string }[] = [{ id: 'theme', label: 'Matches theme' }, { id: 'inverse', label: 'Opposite' }, { id: 'accent', label: 'Brand ink' }]
  const toneTokens = (navTone: NavTone): Record<string, string> => themeTokensFor({ ...a, navTone }, resolved)
  return <div className="flex flex-col gap-5">
    <RadioGroup label={uiText("Sidebar design")} className="grid gap-3 sm:grid-cols-3" value={design} values={designs.map(d => d.id)}
      onChange={(id) => void update(id === 'rail' ? { sidebarCollapsed: true } : { sidebarStyle: id, sidebarCollapsed: false })}
      header={<div className="mb-2 font-medium">{uiText("Sidebar design")}</div>}>
      {(id, props) => { const d = designs.find(x => x.id === id)!; return <button {...props} key={id} className={`rounded-xl border p-2 text-center text-sm transition ${design === id ? `${selectedClass} font-semibold text-selected-ink` : 'border-line text-muted hover:bg-surface-2'}`}>
        <SidebarPicture nav={t['nav.bg']} active={t['nav.active.bg']} canvas={t['bg.canvas']} width={d.width} simple={id === 'simple'} />{uiText(d.label)}</button> }}
    </RadioGroup>
    <RadioGroup label={uiText("Sidebar colour")} className="grid gap-3 sm:grid-cols-3" value={a.navTone} values={tones.map(x => x.id)} onChange={(navTone) => void update({ navTone })}
      header={<div className="mb-2 font-medium">{uiText("Sidebar colour")}</div>}>
      {(id, props) => { const n = toneTokens(id); return <button {...props} key={id} className={`rounded-xl border p-2 text-center text-sm transition ${a.navTone === id ? `${selectedClass} font-semibold text-selected-ink` : 'border-line text-muted hover:bg-surface-2'}`}>
        <SidebarPicture nav={n['nav.bg']} active={n['nav.active.bg']} canvas={t['bg.canvas']} />{uiText(tones.find(x => x.id === id)!.label)}</button> }}
    </RadioGroup>
  </div>
}

// --- Floating panel preview ----------------------------------------------------

/** A small, live floating panel on a striped "desktop": the real panel layout, following style, size and opacity. */
export function PanelPreview(): React.JSX.Element {
  const { appearance: a } = useAppearance()
  const circular = a.panelTimerDisplay === 'circular'
  const base = floatingPanelSize(true, a.panelTimerDisplay), k = PANEL_SIZES[a.panelSize]
  const button = (label: string, primary = false): React.JSX.Element => <span className={`fp-btn grid place-items-center ${primary ? 'fp-btn-primary' : ''}`} style={{ flex: '1 1 0', ...(primary ? { background: 'var(--fr-stage-focus)', color: 'var(--fr-stage-focus-on)' } : {}) }}>{uiText(label)}</span>
  return <div aria-hidden="true" className="flex items-center justify-center overflow-hidden rounded-xl border border-line p-4" style={{ minHeight: Math.round(base.height * k) + 32, background: 'repeating-linear-gradient(135deg, var(--fr-bg-sunken) 0 12px, var(--fr-bg-canvas) 12px 24px)' }}>
    <div style={{ width: base.width * k, height: base.height * k, opacity: a.panelOpacity }} className="transition-opacity">
      <div className={`floating-panel rounded-2xl border border-line bg-surface shadow-[var(--fr-shadow-raised)] ${circular ? 'fp-circular' : 'fp-digital'}`} data-expanded="true" data-tone="focus" style={{ width: base.width, height: base.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
        {circular ? <div className="fp-stage"><CircularTimer value="06:18" caption={uiText('of {value0}', { value0: '25:00' })} progress={1122 / 1500} label="06:18" />
          <div className="fp-subject"><span className="fp-dot" style={{ background: 'var(--fr-stage-focus)' }} /><span className="fp-subject-text">{uiText('Focus')}</span></div></div>
          : <div className="fp-stage"><div className="fp-head"><div className="fp-subject"><span className="fp-dot" style={{ background: 'var(--fr-stage-focus)' }} /><span className="fp-subject-text">{uiText('Focus')}</span></div></div>
            <div className="fp-readout" dir="ltr"><span className="fp-digits font-timer tabular-nums">18:42</span><span className="fp-aside">{uiText('of {value0}', { value0: '25:00' })}</span></div>
            <div className="fp-line fp-line-track"><div className="fp-line-fill" style={{ width: '75%', background: 'var(--fr-stage-focus)' }} /></div></div>}
        <div className="fp-actions">{button('Distracted')}{button('Switch')}{button('Finish', true)}</div>
      </div>
    </div>
  </div>
}

// --- Advanced rows ------------------------------------------------------------

/** A collapsed row with a summary and Edit ›; the content opens in place. */
export function AdvancedRow({ title, summary, swatches = [], children }: { title: string; summary: string; swatches?: string[]; children: React.ReactNode }): React.JSX.Element {
  return <details className="group">
    <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-3 px-6 py-3 [&::-webkit-details-marker]:hidden">
      <span className="min-w-40 font-semibold">{uiText(title)}</span>
      {swatches.length > 0 && <span aria-hidden="true" className="flex gap-1">{swatches.map((c, i) => <i key={i} className="size-4 rounded-[5px] border border-black/10" style={{ background: c }} />)}</span>}
      <span className="min-w-0 flex-1 truncate text-muted">{summary}</span>
      <span className="rounded-lg border border-line bg-control px-3 py-1 text-sm group-open:hidden">{uiText("Edit")} ›</span>
      <span className="hidden rounded-lg border border-line bg-control px-3 py-1 text-sm group-open:inline">{uiText("Close")}</span>
    </summary>
    <div className="px-6 pb-6">{children}</div>
  </details>
}

const STAGE_LABELS: Record<keyof Accents, string> = { focus: 'Focus', recall: 'Recall', rest: 'Rest', overtime: 'Overtime' }

/** Custom stage colours for one side. Each value is contrast-guarded; the nearest readable version is shown. */
export function StageColourEditor(): React.JSX.Element {
  const { appearance: a, update, resolved } = useAppearance()
  const [side, setSide] = useState<Side>(resolved)
  const theme = themeById(side === 'dark' ? a.darkTheme : a.lightTheme)!
  const tokens = themeTokensFor(a, side)
  const custom = a.stageOverrides[side]
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-3">
      <Segmented<Side> value={side} onChange={setSide} options={[{ value: 'light', label: 'Light theme' }, { value: 'dark', label: 'Dark theme' }]} />
      <span className="text-sm text-muted">{uiText(themeLabel(theme))} · {Object.keys(custom).length ? uiText("Customised") : uiText("From the theme")}</span>
      {Object.keys(custom).length > 0 && <Button size="sm" className="ms-auto" onClick={() => void update({ stageOverrides: { ...a.stageOverrides, [side]: {} } })}>{uiText("Reset to theme")}</Button>}
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{STAGE_KEYS.map(k => {
      const value = custom[k] ?? tokens[`stage.${k}`], shown = custom[k] ? guardStageColour(custom[k]!, theme) : value
      return <div key={k} className="rounded-xl border border-line p-4">
        <ColourField label={STAGE_LABELS[k]} value={value} onChange={(color) => void update(stageOverridePatch(a, side, k, color))} />
        {custom[k] && shown.toUpperCase() !== custom[k]!.toUpperCase() && <p className="mt-2 flex items-center gap-2 text-sm text-muted"><i aria-hidden="true" className="size-4 rounded" style={{ background: shown }} />{uiText("Shown as {hex} so it stays readable.", { hex: shown })}</p>}
        {custom[k] && <button type="button" className="mt-2 text-sm text-accent-text hover:underline" onClick={() => void update(stageOverridePatch(a, side, k, null))}>{uiText("Use the theme colour")}</button>}
      </div>
    })}</div>
    <label className="flex items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--fr-accent-default)]" checked={a.focusIsAccent} onChange={e => void update({ focusIsAccent: e.target.checked })} />
      <span><span className="block">{uiText("A custom Focus colour also colours buttons")}</span><span className="text-sm text-muted">{uiText("Buttons, rings and selection follow your Focus colour.")}</span></span></label>
  </div>
}

/** Older custom surface colours are honoured; they are only shown, with a reset, to people who have them. */
export function CustomSurfacesRow(): React.JSX.Element | null {
  const { appearance: a, update } = useAppearance()
  if (!hasSurfaceOverrides(a)) return null
  return <div className="flex min-h-14 flex-wrap items-center gap-3 px-6 py-3">
    <span className="min-w-40 font-semibold">{uiText("Custom surfaces")}</span>
    <span className="flex-1 text-muted">{uiText("Background and card colours from an earlier version.")}</span>
    <Button size="sm" onClick={() => void update({ surfaceOverrides: { light: {}, dark: {} } })}>{uiText("Reset")}</Button>
  </div>
}

// --- Radio group with roving tabindex -----------------------------------------

type RadioProps = { role: 'radio'; type: 'button'; 'aria-checked': boolean; tabIndex: number; onClick: () => void; onKeyDown: (e: React.KeyboardEvent) => void; 'data-radio': string }

/** Standard radio interaction: arrows move and select, mirrored in RTL. */
function RadioGroup<T extends string>({ label, header, className, value, values, onChange, children }: {
  label: string; header?: React.ReactNode; className: string; value: T; values: T[]; onChange: (v: T) => void
  children: (v: T, props: RadioProps) => React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const focusable = values.includes(value) ? value : values[0]
  const move = (from: T, delta: number): void => {
    const next = values[(values.indexOf(from) + delta + values.length) % values.length]
    ref.current?.querySelector<HTMLElement>(`[data-radio="${CSS.escape(next)}"]`)?.focus()
    onChange(next)
  }
  const props = (v: T): RadioProps => ({
    role: 'radio', type: 'button', 'aria-checked': v === value, tabIndex: v === focusable ? 0 : -1, 'data-radio': v,
    onClick: () => onChange(v),
    onKeyDown: (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const forward = isRtl() ? 'ArrowLeft' : 'ArrowRight', back = isRtl() ? 'ArrowRight' : 'ArrowLeft'
      if (e.key === forward || e.key === 'ArrowDown') { e.preventDefault(); move(v, 1) }
      else if (e.key === back || e.key === 'ArrowUp') { e.preventDefault(); move(v, -1) }
    }
  })
  return <div>
    {header}
    <div ref={ref} role="radiogroup" aria-label={label} className={className}>{values.map(v => children(v, props(v)))}</div>
  </div>
}
