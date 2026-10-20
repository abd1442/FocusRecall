import { COMPAT_MAP, cssName, DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, resolveThemeTokens, STAGE_KEYS, themeById, type NavTone, type Tokens } from './themes'
import MIGRATION from './themeMigration.json'
// Colours come from the theme system (themes.ts): one light theme and one dark
// theme, chosen independently, with the mode deciding which is on screen. The
// user's custom stage colours and legacy custom surfaces are re-derived on top.
// Older colour preferences (colourId, accentId, customLight/customDark) are
// migrated once and kept alongside for one release (downgrade safety).
//
// Scaling: each window scales its own content with CSS zoom on <html>. The
// main window uses the interface scale; the floating panel uses its own
// panel size. (Chromium's page zoom is shared by every window of the same
// origin, so it cannot keep the two apart.)

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Base {
  /** Window background. */
  bg: string
  /** Cards and tiles. */
  surface: string
  /** Inputs, chips, hovered rows: one step off the surface. */
  surface2: string
  border: string
  text: string
  muted: string
  /** Writing areas (recall, notes): a soft surface and a soft text colour. */
  writingBg: string
  writingText: string
  /** Text drawn on top of an accent (buttons). */
  onAccent: string
}

export interface Accents {
  /** Focus stage colour; also the primary accent. */
  focus: string
  recall: string
  rest: string
  overtime: string
}

/**
 * The session timeline's distraction colours, one set per base. Chosen to
 * stay clear of every default subject colour (see ITEM_PALETTE and the
 * tests): a warm yellow for "you were distracted", a clear red for a detected
 * app or site, and a grey for no input.
 */
export interface LineColors {
  /** Older saved custom palettes may not contain focus yet. */
  focus?: string
  distracted: string
  detected: string
  idle: string
}

export type LinePaletteId = 'calm' | 'classic' | 'pastel' | 'cb'

/**
 * Ready timeline palettes. Each colour was measured against every default
 * subject colour and the base background (see the tests), so the kinds stay
 * distinguishable on both bases.
 */
export const LINE_PALETTES: { id: LinePaletteId; name: string; dark: LineColors; light: LineColors }[] = [
  {
    // Calm and muted: sand, dusty rose, slate (the obvious sand and rose sit too
    // close to the amber and rose subject colours).
    id: 'calm',
    name: 'Calm',
    dark: { focus: '#86A9DB', distracted: '#C9AD80', detected: '#BD8780', idle: '#636A88' },
    light: { focus: '#365F8A', distracted: '#97804F', detected: '#94625A', idle: '#555B73' }
  },
  {
    id: 'classic',
    name: 'Classic',
    dark: { focus: '#5B8DEF', distracted: '#F5D547', detected: '#EF4444', idle: '#77736C' },
    light: { focus: '#365DA8', distracted: '#8F7300', detected: '#DC2626', idle: '#5E6169' }
  },
  {
    id: 'pastel',
    name: 'Pastel',
    dark: { focus: '#A6BDE3', distracted: '#A8D8CE', detected: '#EFC3AC', idle: '#CABAE5' },
    light: { focus: '#4D6792', distracted: '#527569', detected: '#8A583F', idle: '#625574' }
  },
  {
    // Orange, reddish purple and a pale neutral, separated by hue and lightness.
    id: 'cb',
    name: 'Colour-blind safe',
    dark: { focus: '#56B4E9', distracted: '#E69F00', detected: '#D884B5', idle: '#E1E1E1' },
    light: { focus: '#176A91', distracted: '#8E641F', detected: '#934583', idle: '#555B60' }
  }
]

/** The default (Calm) colours, by base. */
export const LINE_COLORS: Record<'light' | 'dark', LineColors> = { dark: LINE_PALETTES[0].dark, light: LINE_PALETTES[0].light }

/** Subject colours a timeline colour is too close to (CIE76 distance under `min`). */
export function tooCloseTo(color: string, subjects: readonly string[], min = 18): string[] {
  return subjects.filter((s) => /^#[0-9a-f]{6}$/i.test(s) && colorDistance(color, s) < min)
}

export type Palette = Base & Accents & { line: LineColors }

export interface AccentSet {
  id: string
  name: string
  light: Accents
  dark: Accents
}

export type PanelSize = 'small' | 'medium' | 'large'

export interface Appearance {
  sidebarStyle: 'journal' | 'simple'
  /** Legacy sidebar background (beta.27); replaced by navTone. */
  sidebarTone: 'theme' | 'paper' | 'matched'
  sidebarCollapsed: boolean
  sidebarWidth: number
  density: 'comfortable' | 'compact'
  /** Legacy custom colours (beta.27), kept readable for one release; migrated into stageOverrides and surfaceOverrides. */
  customLight: Partial<Base & Accents>
  customDark: Partial<Base & Accents>
  /** Which theme is on screen: always light, always dark, or following Windows. */
  mode: ThemeMode
  /** Legacy colour theme and accent set (beta.27); migrated into lightTheme, darkTheme and navTone. */
  colourId: string
  accentId: string
  /** The theme used whenever the resolved mode is light. */
  lightTheme: string
  /** The theme used whenever the resolved mode is dark. */
  darkTheme: string
  /** Sidebar colour: matches the theme, the opposite mode, or a solid accent rail. */
  navTone: NavTone
  /** Custom stage colours per side; guarded and re-derived at runtime. */
  stageOverrides: { light: Partial<Accents>; dark: Partial<Accents> }
  /** A custom Focus colour also drives buttons, rings and selection. */
  focusIsAccent: boolean
  /** Legacy custom surface colours, honoured but no longer offered. */
  surfaceOverrides: { light: Partial<Base>; dark: Partial<Base> }
  /** A transform of whichever theme is active: stronger text, edges and colours. */
  highContrast: boolean
  /** Main window scale, 0.9 to 1.6. Does not affect the floating panel. */
  uiScale: number
  /** Text size in writing areas, px before the interface scale. */
  writingSize: number
  /** The floating panel's own scale. */
  panelSize: PanelSize
  /** Visual presentation only; never changes the session's timer mode. */
  panelTimerDisplay: 'digital' | 'circular'
  /** Floating panel opacity, 0.3 to 1. */
  panelOpacity: number
  fontUi: string
  fontTimer: string
  fontWriting: string
  /** Corner roundness multiplier, 0 (square) to 2. */
  roundness: number
  /** Timeline colours: a ready palette, or 'custom' (one colour per kind, both bases). */
  linePalette: LinePaletteId | 'custom'
  lineCustom: LineColors
}

/** Beta.27 bases. No longer drawn; kept as the reference the timeline palettes were measured against. */
export const BASES: Record<'light' | 'dark' | 'contrastLight' | 'contrastDark', Base> = {
  light: {
    // Light is its own design, not dark inverted: a warm paper page, near-white
    // cards lifted by a soft shadow (see index.css), and quieter borders.
    bg: '#F2F0EB',
    surface: '#FFFEFC',
    surface2: '#EEEBE4',
    border: '#E0DBD1',
    text: '#2F2D29',
    muted: '#615D55',
    writingBg: '#FDFCF9',
    writingText: '#34322D',
    onAccent: '#FBFAF7'
  },
  dark: {
    bg: '#1C1D21',
    surface: '#25262B',
    surface2: '#2F3036',
    border: '#3A3B42',
    text: '#E4E1DA',
    muted: '#A9A59C',
    writingBg: '#212226',
    writingText: '#DCD8CF',
    onAccent: '#1C1D21'
  },
  contrastLight: {
    bg: '#F7F7F4',
    surface: '#FDFDFB',
    surface2: '#E9E9E4',
    border: '#8E8E87',
    text: '#121212',
    muted: '#3E3E3A',
    writingBg: '#FDFDFB',
    writingText: '#161616',
    onAccent: '#FDFDFB'
  },
  contrastDark: {
    bg: '#101113',
    surface: '#17181B',
    surface2: '#222327',
    border: '#6B6C72',
    text: '#F0EFEA',
    muted: '#C9C7C0',
    writingBg: '#141517',
    writingText: '#ECEAE4',
    onAccent: '#101113'
  }
}

export const ACCENT_SETS: AccentSet[] = [
  {id:'palette',name:'Theme colours',light:{focus:'#2E506D',recall:'#78568F',rest:'#386E5C',overtime:'#906128'},dark:{focus:'#D9CEB5',recall:'#CBB9DC',rest:'#B8CEB6',overtime:'#E4BF87'}},
  {id:'journal',name:'Journal',light:{focus:'#2E506D',recall:'#805D79',rest:'#416B53',overtime:'#946020'},dark:{focus:'#ABC7A4',recall:'#D1B6C6',rest:'#D3C79B',overtime:'#E4AE85'}},
  {id:'olive',name:'Olive',light:{focus:'#52623A',recall:'#7E5F7F',rest:'#526D54',overtime:'#92601F'},dark:{focus:'#C4CB93',recall:'#D0B7C5',rest:'#AEC8A1',overtime:'#E5B77B'}},
  {id:'clay',name:'Clay',light:{focus:'#925740',recall:'#7E5F7F',rest:'#4E7055',overtime:'#8D651E'},dark:{focus:'#E1AA8F',recall:'#CFB3C9',rest:'#AEC6A4',overtime:'#E2C28C'}},
  {
    id: 'refined',
    name: 'Navy',
    light: { focus: '#234D5B', recall: '#785A8D', rest: '#38745F', overtime: '#986019' },
    dark: { focus: '#91BDCF', recall: '#C2A6D3', rest: '#8ABCA5', overtime: '#DEB779' }
  },
  {
    id: 'gold',
    name: 'Gold',
    light: { focus: '#8C611C', recall: '#785A8D', rest: '#38745F', overtime: '#A34632' },
    dark: { focus: '#E4BB74', recall: '#C2A6D3', rest: '#8ABCA5', overtime: '#ECA18F' }
  },
  {
    id: 'calm',
    name: 'Calm',
    light: { focus: '#3F6FB0', recall: '#80569A', rest: '#3A7D62', overtime: '#A55F1C' },
    dark: { focus: '#86A9DB', recall: '#BC9DD0', rest: '#80BFA2', overtime: '#E0A868' }
  },
  {
    id: 'amber',
    name: 'Amber',
    light: { focus: '#9A5B14', recall: '#8A5878', rest: '#4A7A52', overtime: '#B0412E' },
    dark: { focus: '#E3AC66', recall: '#CDA0BD', rest: '#93BE95', overtime: '#EE9A86' }
  },
  {
    id: 'forest',
    name: 'Forest',
    light: { focus: '#2F7A4E', recall: '#7A5C8E', rest: '#3A6C8F', overtime: '#9C5E1E' },
    dark: { focus: '#86C79F', recall: '#C1A6D2', rest: '#8BB7D4', overtime: '#DDA66B' }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: { focus: '#2F67A6', recall: '#78559A', rest: '#2D7A6E', overtime: '#A0581E' },
    dark: { focus: '#7FB0E6', recall: '#BDA0DA', rest: '#7CC4B6', overtime: '#E0A868' }
  },
  {
    id: 'dusk',
    name: 'Dusk',
    light: { focus: '#5A55A8', recall: '#874F96', rest: '#3D7766', overtime: '#A0581E' },
    dark: { focus: '#A6A3E8', recall: '#D0A4DD', rest: '#88C2B0', overtime: '#E5AB70' }
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { focus: '#A04A6A', recall: '#6F55A0', rest: '#3C7A5F', overtime: '#9C5E1E' },
    dark: { focus: '#E39AB5', recall: '#B9A3E0', rest: '#86C3A6', overtime: '#E0A868' }
  }
]

/**
 * Panel scale per size. Medium equals the panel before the redesign
 * (about 232 x 58 compact, 300 x 112 expanded).
 */
export const PANEL_SIZES: Record<PanelSize, number> = { small: 0.62, medium: 0.78, large: 0.92 }

export const DEFAULT_APPEARANCE: Appearance = {
  sidebarStyle:'journal', sidebarTone:'theme', sidebarCollapsed:false, sidebarWidth:224,
  density: 'comfortable',
  customLight: {},
  customDark: {},
  mode: 'system',
  colourId: 'paper-auto',
  accentId: 'palette',
  lightTheme: DEFAULT_LIGHT_THEME,
  darkTheme: DEFAULT_DARK_THEME,
  navTone: 'theme',
  stageOverrides: { light: {}, dark: {} },
  focusIsAccent: false,
  surfaceOverrides: { light: {}, dark: {} },
  highContrast: false,
  uiScale: 1,
  writingSize: 19,
  panelSize: 'medium',
  panelTimerDisplay: 'digital',
  panelOpacity: 0.95,
  fontUi: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  fontTimer: '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
  // Segoe UI covers Latin and Arabic with matching weight and spacing.
  fontWriting: '"Segoe UI Variable Text", "Segoe UI", "Noto Naskh Arabic", system-ui, sans-serif',
  roundness: 1,
  linePalette: 'calm',
  lineCustom: { focus: '#86A9DB', distracted: '#C9AD80', detected: '#BD8780', idle: '#636A88' }
}

export const UI_SCALE_RANGE = { min: 0.9, max: 1.6 }

export function accentSetById(id: string): AccentSet {
  return ACCENT_SETS.find((t) => t.id === id) ?? ACCENT_SETS.find((t) => t.id === 'calm')!
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

const BASE_KEYS = ['bg', 'surface', 'surface2', 'border', 'text', 'muted', 'writingBg', 'writingText', 'onAccent'] as const
const HEX = /^#[0-9a-f]{6}$/i
const MIGRATION_MAP = MIGRATION as unknown as Record<string, [string, string, NavTone]>

/** The theme on screen under the current mode, and its tokens. */
export function activeTheme(a: Appearance, systemPrefersDark: boolean): { mode: 'light' | 'dark'; themeId: string; tokens: Tokens } {
  const mode = resolveTheme(a.mode, systemPrefersDark)
  return { mode, themeId: mode === 'dark' ? a.darkTheme : a.lightTheme, tokens: themeTokensFor(a, mode) }
}

/** Every semantic token for one side of the appearance (whether or not it is on screen). */
export function themeTokensFor(a: Appearance, mode: 'light' | 'dark', themeId = mode === 'dark' ? a.darkTheme : a.lightTheme): Tokens {
  return resolveThemeTokens({
    themeId, mode,
    stageOverrides: a.stageOverrides[mode], focusIsAccent: a.focusIsAccent, surfaceOverrides: a.surfaceOverrides[mode],
    highContrast: a.highContrast, navTone: a.navTone, partnerId: mode === 'dark' ? a.lightTheme : a.darkTheme
  })
}

/** The resolved colours in the beta.27 shape, for the main process (window background, tray) and timeline colours. */
export function paletteFor(a: Appearance, systemPrefersDark: boolean): Palette {
  const { mode, tokens: t } = activeTheme(a, systemPrefersDark)
  const preset = LINE_PALETTES.find((x) => x.id === a.linePalette) ?? LINE_PALETTES[0]
  return {
    bg: t['bg.canvas'], surface: t['surface.base'], surface2: t['bg.sunken'], border: t['border.default'], text: t['text.primary'], muted: t['text.secondary'],
    writingBg: t['surface.writing'], writingText: t['text.writing'], onAccent: t['text.onAccent'],
    focus: t['stage.focus'], recall: t['stage.recall'], rest: t['stage.rest'], overtime: t['stage.overtime'],
    line: a.linePalette === 'custom' ? a.lineCustom : preset[mode]
  }
}

/** Old theme ids (one theme recoloured everything) mapped to accent sets. */
const LEGACY_THEMES: Record<string, { accentId: string; highContrast?: boolean }> = {
  calm: { accentId: 'calm' },
  paper: { accentId: 'amber' },
  forest: { accentId: 'forest' },
  ocean: { accentId: 'ocean' },
  dusk: { accentId: 'dusk' },
  contrast: { accentId: 'calm', highContrast: true }
}

function pickHex<K extends string>(input: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {}
  if (input && typeof input === 'object') for (const key of keys) { const v = (input as Record<string, unknown>)[key]; if (typeof v === 'string' && HEX.test(v)) out[key] = v }
  return out
}

/**
 * One-time move from beta.27 colour preferences to the theme system (TOKEN_SPEC §4):
 * colourId -> light/dark theme and sidebar tone; a legacy accent set and custom stage
 * colours -> stage overrides (driving buttons too, as before); custom base colours ->
 * surface overrides. The old fields are left in place.
 */
function migrateColours(a: Appearance): void {
  const [lightTheme, darkTheme, navTone] = MIGRATION_MAP[a.colourId] ?? MIGRATION_MAP['paper-auto']
  a.lightTheme = lightTheme; a.darkTheme = darkTheme; a.navTone = navTone
  const set = a.accentId === 'palette' ? null : accentSetById(a.accentId)
  for (const side of ['light', 'dark'] as const) {
    const custom = side === 'dark' ? a.customDark : a.customLight
    a.stageOverrides[side] = { ...pickHex(set?.[side], STAGE_KEYS), ...pickHex(custom, STAGE_KEYS) }
    a.surfaceOverrides[side] = pickHex(custom, BASE_KEYS)
  }
  a.focusIsAccent = true
}

/** Merge a stored (possibly older or partial) appearance over the defaults. */
export function normalizeAppearance(stored: (Partial<Appearance> & { themeId?: string }) | null | undefined): Appearance {
  const s = { ...(stored ?? {}) }
  if (s.themeId && !s.accentId) Object.assign(s, LEGACY_THEMES[s.themeId] ?? {})
  delete s.themeId
  const a = { ...DEFAULT_APPEARANCE, ...s, stageOverrides: { light: {}, dark: {} }, surfaceOverrides: { light: {}, dark: {} } } as Appearance
  if(stored && !s.colourId)a.colourId='original'
  if(stored && !s.accentId)a.accentId='calm'
  a.sidebarStyle=a.sidebarStyle==='simple'?'simple':'journal'
  a.sidebarTone=['theme','matched','paper'].includes(a.sidebarTone)?a.sidebarTone:'theme'
  a.sidebarCollapsed=a.sidebarCollapsed===true
  a.sidebarWidth=clamp(Number(a.sidebarWidth)||224,184,280)
  a.uiScale = clamp(Number(a.uiScale) || 1, UI_SCALE_RANGE.min, UI_SCALE_RANGE.max)
  a.writingSize = clamp(Number(a.writingSize) || DEFAULT_APPEARANCE.writingSize, 14, 32)
  a.panelOpacity = clamp(Number(a.panelOpacity) || 1, 0.3, 1)
  if (!(a.panelSize in PANEL_SIZES)) a.panelSize = 'medium'
  a.panelTimerDisplay = a.panelTimerDisplay === 'circular' ? 'circular' : 'digital'
  if (!['light', 'dark', 'system'].includes(a.mode)) a.mode = 'system'
  a.accentId = accentSetById(a.accentId).id
  a.colourId = Object.hasOwn(MIGRATION_MAP, a.colourId) ? a.colourId : 'original'
  a.highContrast = !!a.highContrast
  a.density = a.density === 'compact' ? 'compact' : 'comfortable'
  a.roundness = clamp(Number.isFinite(Number(a.roundness)) ? Number(a.roundness) : 1,0,2)
  for(const key of ['fontUi','fontTimer','fontWriting'] as const) if(typeof a[key]!=='string'||!a[key].trim()||a[key].length>240)a[key]=DEFAULT_APPEARANCE[key]
  for(const variant of ['customLight','customDark'] as const){
    const input=a[variant]??{}, safe:Partial<Base&Accents>={}
    for(const key of [...BASE_KEYS,...STAGE_KEYS]) if(typeof input[key]==='string'&&HEX.test(input[key]!))safe[key]=input[key]
    a[variant]=safe
  }
  if (stored && typeof s.lightTheme !== 'string' && typeof s.darkTheme !== 'string') migrateColours(a)
  else {
    a.lightTheme = themeById(String(a.lightTheme), 'light') ? a.lightTheme : DEFAULT_LIGHT_THEME
    a.darkTheme = themeById(String(a.darkTheme), 'dark') ? a.darkTheme : DEFAULT_DARK_THEME
    a.navTone = ['theme', 'inverse', 'accent'].includes(a.navTone) ? a.navTone : 'theme'
    a.focusIsAccent = s.focusIsAccent === true
    for (const side of ['light', 'dark'] as const) {
      a.stageOverrides[side] = pickHex(s.stageOverrides?.[side], STAGE_KEYS)
      a.surfaceOverrides[side] = pickHex(s.surfaceOverrides?.[side], BASE_KEYS)
    }
  }
  if (a.linePalette !== 'custom' && !LINE_PALETTES.some((x) => x.id === a.linePalette)) a.linePalette = 'calm'
  const hex = (v: unknown, fallback: string): string => (typeof v === 'string' && HEX.test(v) ? v : fallback)
  a.lineCustom = {
    focus: hex(a.lineCustom?.focus, DEFAULT_APPEARANCE.lineCustom.focus!),
    distracted: hex(a.lineCustom?.distracted, DEFAULT_APPEARANCE.lineCustom.distracted),
    detected: hex(a.lineCustom?.detected, DEFAULT_APPEARANCE.lineCustom.detected),
    idle: hex(a.lineCustom?.idle, DEFAULT_APPEARANCE.lineCustom.idle)
  }
  return a
}

/** Sets (or, with null, removes) one custom stage colour on one side. */
export function stageOverridePatch(a: Appearance, side: 'light' | 'dark', key: keyof Accents, color: string | null): Partial<Appearance> {
  const next = { ...a.stageOverrides[side] }
  if (color && HEX.test(color)) next[key] = color.toUpperCase()
  else delete next[key]
  return { stageOverrides: { ...a.stageOverrides, [side]: next } }
}

export const hasStageOverrides = (a: Appearance, side: 'light' | 'dark'): boolean => Object.keys(a.stageOverrides[side]).length > 0
export const hasSurfaceOverrides = (a: Appearance): boolean => Object.keys(a.surfaceOverrides.light).length + Object.keys(a.surfaceOverrides.dark).length > 0

/** CSS custom properties: every --fr-* semantic token, the --tf-* compatibility layer, timeline colours, fonts and shape. */
export function toCssVars(a: Appearance, systemPrefersDark: boolean): Record<string, string> {
  const { tokens: t } = activeTheme(a, systemPrefersDark)
  const line = paletteFor(a, systemPrefersDark).line
  const vars: Record<string, string> = {}
  for (const [token, value] of Object.entries(t)) vars[cssName(token)] = value
  for (const [name, token] of Object.entries(COMPAT_MAP)) vars[name] = t[token]
  // The timeline palettes (Calm, Classic ...) still override the theme's timeline colours.
  vars['--tf-line-focus'] = line.focus ?? t['stage.focus']
  vars['--tf-line-distracted'] = line.distracted
  vars['--tf-line-detected'] = line.detected
  vars['--tf-line-idle'] = line.idle
  for (const kind of ['focus', 'distracted', 'detected', 'idle'] as const) { const color = vars[`--tf-line-${kind}`]; vars[`--tf-line-${kind}-text`] = contrastRatio(color, '#141518') >= contrastRatio(color, '#FFFFFF') ? '#141518' : '#FFFFFF' }
  return {
    ...vars,
    '--tf-sidebar-width': a.sidebarWidth + 'px',
    '--tf-font-ui': a.fontUi,
    '--tf-font-timer': a.fontTimer,
    '--tf-font-writing': a.fontWriting,
    '--tf-writing-size': `${a.writingSize}px`,
    '--tf-roundness': String(a.roundness)
  }
}


// --- Contrast (WCAG 2.x) ------------------------------------------------------

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** CIE L*a*b* of a colour, for measuring how different two colours look. */
function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => channel(v))
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** How different two colours look (CIE76 delta E); about 15 or more reads as clearly different. */
export function colorDistance(a: string, b: string): number {
  const p = lab(a)
  const q = lab(b)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
