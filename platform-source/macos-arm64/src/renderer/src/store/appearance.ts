import { create } from 'zustand'
import {
  DEFAULT_APPEARANCE,
  PANEL_SIZES,
  normalizeAppearance,
  resolveTheme,
  toCssVars,
  type Appearance
} from '@core/appearance'

/** The floating panel window scales by its own size; the main window by the interface scale. */
const isPanel = ['#panel', '#reasons', '#capture'].includes(window.location.hash)

const media = window.matchMedia('(prefers-color-scheme: dark)')

/** Text size inside the panel for each panel size (the panel's outer size does not change). */
const PANEL_TEXT = { small: 1.2, medium: 1.14, large: 1.08 } as const

interface AppearanceState {
  appearance: Appearance
  resolved: 'light' | 'dark'
  /** Save a change; main applies the scale to every window and broadcasts it back. */
  update: (patch: Partial<Appearance>) => Promise<void>
}

let preparationScale=false
export function setPanelPreparationScale(preparing:boolean):void {preparationScale=preparing;apply(useAppearance.getState().appearance)}

function apply(a: Appearance): 'light' | 'dark' {
  const resolved = resolveTheme(a.mode, media.matches)
  const root = document.documentElement
  for (const [name, value] of Object.entries(toCssVars(a, media.matches))) root.style.setProperty(name, value)
  root.dataset.theme = resolved
  root.dataset.frTheme = resolved === 'dark' ? a.darkTheme : a.lightTheme
  root.dataset.highContrast = String(a.highContrast)
  root.dataset.density = a.density
  root.style.colorScheme = resolved
  const zoom = isPanel && !preparationScale ? PANEL_SIZES[a.panelSize] : a.uiScale
  root.style.zoom = String(zoom)
  // The panel keeps its outer size; its text is larger in the smaller sizes so it stays readable.
  if (isPanel) root.style.setProperty('--pt', String(PANEL_TEXT[a.panelSize]))
  root.style.setProperty('--tf-zoom', String(zoom))
  return resolved
}

export const useAppearance = create<AppearanceState>((_set, get) => ({
  appearance: DEFAULT_APPEARANCE,
  resolved: apply(DEFAULT_APPEARANCE),
  update: async (patch) => {
    const next = normalizeAppearance({ ...get().appearance, ...patch })
    // Apply locally at once so sliders feel live; main confirms via the broadcast.
    useAppearance.setState({ appearance: next, resolved: apply(next) })
    try {
      await window.api.invoke('appearance:set', next)
    } catch (err) {
      window.dispatchEvent(new CustomEvent('tf-save-error', { detail: `Not saved: ${err instanceof Error ? err.message : String(err)}` }))
    }
  }
}))

function receive(a: Appearance): void {
  useAppearance.setState({ appearance: a, resolved: apply(a) })
}

void window.api.invoke('appearance:get').then(receive)
window.api.on('appearance:changed', receive)

// Follow Windows light/dark changes live when the mode is "system".
media.addEventListener('change', () => receive(useAppearance.getState().appearance))
