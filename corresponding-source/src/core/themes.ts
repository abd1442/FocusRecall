// The FocusRecall theme system (approved 2026-10-17): 26 themes, each a small
// set of hand-picked seed colours (themeSeeds.ts, generated) from which every
// semantic token is derived here. The derivation is a TypeScript port of
// docs/design/theme-system-2026/tools/build.mjs, so custom stage colours and
// surfaces are re-derived at runtime with the same contrast guards.
//
//   seeds (per theme)  ->  semantic tokens (bg.canvas, accent.text, stage.recall.subtle ...)
//                      ->  component tokens (aliases, theme independent, in index.css)
import { BRAND, THEME_SEEDS } from './themeSeeds'
import { bestOn, contrast, CVD_TYPES, deltaE00, ensureContrast, hexToOklab, hexToOklch, mix, oklch, rgba, shiftL, simulate } from './themeColor'

export type ThemeMode = 'light' | 'dark'
export type StageKey = 'focus' | 'recall' | 'rest' | 'overtime'
export type Stages = Record<StageKey, string>
export type NavTone = 'theme' | 'inverse' | 'accent'
export type Tokens = Record<string, string>

export interface ThemeSeed {
  id: string
  name: string
  mode: ThemeMode
  isDefault?: boolean
  pairsWith: string
  family: string
  canvas: string; sunken: string; base: string; raised: string; border: string
  text: string; text2: string
  accent: string; onAccent: string; mark: string
  focus: string; recall: string; rest: string; overtime: string
  illu: { line: string; wash: string; highlight: string }
  nav: { bg: string; active: string }
  chart: { shift: number; chroma: number; warmOnly?: boolean }
}

export const STAGE_KEYS: readonly StageKey[] = ['focus', 'recall', 'rest', 'overtime']
export const THEMES: readonly ThemeSeed[] = THEME_SEEDS
export const LIGHT_THEMES = THEMES.filter((t) => t.mode === 'light')
export const DARK_THEMES = THEMES.filter((t) => t.mode === 'dark')
export const DEFAULT_LIGHT_THEME = LIGHT_THEMES.find((t) => t.isDefault)!.id
export const DEFAULT_DARK_THEME = DARK_THEMES.find((t) => t.isDefault)!.id

export function themeById(id: string, mode?: ThemeMode): ThemeSeed | undefined {
  const theme = THEMES.find((t) => t.id === id)
  return theme && (!mode || theme.mode === mode) ? theme : undefined
}

// --- Derivation ---------------------------------------------------------------
// Categorical series [hue, lightness, chroma]: alternate the blue and yellow sides of the
// hue circle and step lightness, which is what survives red-green colour blindness.
const SERIES: Record<ThemeMode, [number, number, number][]> = {
  light: [[250, 0.48, 0.11], [85, 0.66, 0.12], [30, 0.45, 0.12], [190, 0.6, 0.09], [0, 0.58, 0.11], [295, 0.6, 0.1], [330, 0.4, 0.1], [250, 0.56, 0.025]],
  dark: [[250, 0.74, 0.1], [95, 0.9, 0.11], [22, 0.66, 0.12], [185, 0.86, 0.09], [65, 0.76, 0.11], [300, 0.86, 0.07], [330, 0.64, 0.11], [250, 0.74, 0.02]]
}
const WARM_SERIES: [number, number, number][] = [[30, 0.68, 0.11], [85, 0.92, 0.1], [355, 0.56, 0.1], [60, 0.8, 0.11], [15, 0.48, 0.1], [100, 0.74, 0.07], [340, 0.74, 0.07], [40, 0.6, 0.03]]
const STATUS_HUES = { success: 152, warning: 72, error: 27, info: 245 } as const

/** Semantic tokens of one theme. `stages` are the resolved (harmonised or custom) stage colours. */
export function deriveTokens(s: ThemeSeed, stages: Stages): Tokens {
  const dark = s.mode === 'dark'
  const t: Tokens = {}
  const set = (k: string, v: string): void => { t[k] = v }

  set('bg.canvas', s.canvas); set('bg.sunken', s.sunken)
  set('surface.base', s.base); set('surface.raised', s.raised)
  set('surface.writing', dark ? mix(s.base, s.canvas, 0.45) : s.base)
  set('surface.overlay', dark ? 'rgba(0,0,0,0.56)' : 'rgba(28,24,20,0.36)')
  set('border.subtle', mix(s.border, s.base, 0.5)); set('border.default', s.border)
  set('border.strong', ensureContrast(mix(s.border, s.text2, 0.35), s.base, 3))
  set('text.primary', s.text); set('text.secondary', s.text2)
  set('text.tertiary', ensureContrast(ensureContrast(mix(s.text2, s.base, 0.28), s.sunken, 4.5), s.raised, 4.5))
  set('text.writing', mix(s.text, s.base, dark ? 0.06 : 0.04))
  set('text.disabled', mix(s.text2, s.base, dark ? 0.55 : 0.58))
  set('text.onAccent', s.onAccent)
  set('accent.default', s.accent)
  set('accent.hover', shiftL(s.accent, dark ? 0.045 : -0.05))
  set('accent.pressed', shiftL(s.accent, dark ? 0.085 : -0.09))
  set('accent.text', ensureContrast(ensureContrast(s.accent, s.base, 4.5), s.canvas, 4.5))
  set('accent.subtle', mix(s.base, s.accent, dark ? 0.16 : 0.1))
  set('accent.subtleText', ensureContrast(t['accent.text'], t['accent.subtle'], 4.5))
  set('text.link', t['accent.text'])
  set('brand.ink', BRAND.ink); set('brand.amber', BRAND.amber); set('brand.ivory', BRAND.ivory)
  set('brand.mark', s.mark)
  // Controls: sunken in light, lifted in dark so they never read as holes.
  set('control.bg', dark ? mix(s.base, s.text, 0.085) : s.sunken)
  set('control.bgHover', dark ? mix(s.base, s.text, 0.13) : mix(s.sunken, s.text, 0.05))
  set('state.hover', mix(s.base, s.text, dark ? 0.07 : 0.045))
  set('state.pressed', mix(s.base, s.text, dark ? 0.12 : 0.085))
  set('state.selected.bg', mix(s.base, s.accent, dark ? 0.2 : 0.12))
  set('state.selected.border', ensureContrast(s.accent, s.base, 3))
  set('state.selected.text', bestOn(t['state.selected.bg'], s.text, t['accent.subtleText']) === s.text ? s.text : t['accent.subtleText'])
  set('state.focusRing', ensureContrast(ensureContrast(dark ? s.accent : t['accent.text'], s.base, 3), s.canvas, 3))
  set('state.disabled.bg', mix(s.sunken, s.base, 0.3)); set('state.disabled.border', t['border.subtle']); set('state.disabled.text', t['text.disabled'])
  set('state.textSelection', mix(s.base, s.accent, dark ? 0.35 : 0.24))
  for (const [name, h] of Object.entries(STATUS_HUES)) {
    const fg0 = dark ? oklch(0.8, 0.075, h) : oklch(0.48, 0.115, h)
    const bg = mix(s.base, fg0, dark ? 0.14 : 0.1)
    set(`status.${name}.bg`, bg)
    set(`status.${name}.fg`, ensureContrast(ensureContrast(fg0, s.base, 4.5), bg, 4.5))
    set(`status.${name}.border`, ensureContrast(fg0, s.base, 3))
    set(`status.${name}.solid`, ensureContrast(fg0, s.base, 3))
  }
  for (const k of STAGE_KEYS) {
    const solid = stages[k]
    set(`stage.${k}`, solid)
    set(`stage.${k}.text`, ensureContrast(solid, s.base, 4.5))
    set(`stage.${k}.subtle`, mix(s.base, solid, dark ? 0.16 : 0.11))
    set(`stage.${k}.on`, bestOn(solid, '#FFFFFF', s.text, s.canvas, s.onAccent))
  }
  set('timeline.distracted', ensureContrast(oklch(dark ? 0.8 : 0.62, dark ? 0.07 : 0.09, 85), s.base, 3))
  set('timeline.detected', ensureContrast(oklch(dark ? 0.74 : 0.55, dark ? 0.085 : 0.12, 18), s.base, 3))
  set('timeline.idle', ensureContrast(mix(s.text2, s.base, 0.35), s.base, 3))
  const C = s.chart.chroma
  for (let i = 0; i < 8; i++) {
    const [h, L, c0] = s.chart.warmOnly ? WARM_SERIES[i] : SERIES[s.mode][i]
    set(`chart.series.${i + 1}`, ensureContrast(oklch(L, c0 * (C / 0.11), h + s.chart.shift), s.base, 3))
  }
  set('chart.grid', mix(s.border, s.base, 0.25)); set('chart.axis', t['border.strong']); set('chart.label', t['text.tertiary'])
  set('chart.tooltip.bg', dark ? s.raised : s.text); set('chart.tooltip.text', dark ? s.text : s.base)
  const heatEnd = ensureContrast(s.focus, s.base, 3)
  set('chart.heat.0', s.sunken)
  for (let i = 1; i <= 4; i++) set(`chart.heat.${i}`, mix(mix(s.base, s.sunken, 0.5), heatEnd, [0.22, 0.45, 0.72, 1][i - 1]))
  set('illu.line', s.illu.line); set('illu.paper', dark ? s.raised : s.base); set('illu.wash', s.illu.wash)
  set('illu.highlight', s.illu.highlight); set('illu.highlightStroke', ensureContrast(s.illu.highlight, dark ? s.raised : s.base, 3)); set('illu.secondary', t['stage.recall']); set('illu.muted', t['text.tertiary'])
  set('nav.bg', s.nav.bg); set('nav.text', s.text); set('nav.muted', ensureContrast(s.text2, s.nav.bg, 4.5)); set('nav.border', s.border)
  set('nav.hover', mix(s.nav.bg, s.text, dark ? 0.07 : 0.05))
  set('nav.active.bg', s.nav.active)
  set('nav.active.text', bestOn(s.nav.active, s.onAccent, s.text, s.base, '#FFFFFF', '#141414'))
  set('nav.bookmark', contrast(s.mark, s.nav.active) >= 2.2 ? s.mark : bestOn(s.nav.active, s.base, s.text))
  set('shadow.card', dark ? 'none' : `0 1px 2px ${rgba(s.text, 0.05)}, 0 6px 18px -6px ${rgba(s.text, 0.09)}`)
  set('shadow.raised', dark ? `0 0 0 1px ${s.border}, 0 12px 32px rgba(0,0,0,0.45)` : `0 2px 4px ${rgba(s.text, 0.06)}, 0 16px 40px -12px ${rgba(s.text, 0.18)}`)
  return t
}

/** A stage colour is usable when it shows on cards (3:1) and can carry 4.5:1 text when filled. */
export function stageColourValid(c: string, s: ThemeSeed): boolean {
  return contrast(c, s.base) >= 3 && Math.max(contrast(c, '#FFFFFF'), contrast(c, s.text), contrast(c, s.canvas)) >= 4.5
}

/** The nearest usable version of a stage colour on this theme (lightness moves, hue stays). */
export function guardStageColour(hex: string, s: ThemeSeed): string {
  if (stageColourValid(hex, s)) return hex
  const [L, C, H] = hexToOklch(hex)
  for (let i = 1; i < 60; i++) for (const d of [-1, 1]) { const c = oklch(L + d * i * 0.006, C, H); if (stageColourValid(c, s)) return c }
  return ensureContrast(hex, s.base, 4.5)
}

/** Smallest CIEDE2000 distance between the four stages under normal vision (scaled 8/15) and each CVD type. */
function stageScore(set: Stages): number {
  let m = Infinity
  for (const t of CVD_TYPES) {
    const sim = STAGE_KEYS.map((k) => simulate(set[k], t))
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) m = Math.min(m, deltaE00(sim[i], sim[j]) * (t === 'normal' ? 8 / 15 : 1))
  }
  return m
}

/**
 * Keeps each stage seed's character but finds the smallest lightness/hue nudge so the four
 * stages stay apart under protanopia, deuteranopia and tritanopia (min CIEDE2000 >= 8,
 * normal vision >= 15). Focus is the identity colour and moves last.
 */
export function harmoniseStages(s: ThemeSeed): Stages {
  const seeds = Object.fromEntries(STAGE_KEYS.map((k) => [k, guardStageColour(s[k], s)])) as Stages
  const cur = { ...seeds }
  if (stageScore(cur) >= 8) return cur
  const dark = s.mode === 'dark'
  const variants = (hex: string, k: StageKey): { c: string; cost: number }[] => {
    const [L, C, H] = hexToOklch(hex), out: { c: string; cost: number }[] = []
    for (const dL of dark ? [0, -0.03, 0.03, -0.06, 0.06, -0.09, -0.12] : [0, -0.03, 0.03, -0.06, 0.06, -0.09, 0.09, -0.12, 0.12, -0.15, 0.15])
      for (const dH of [0, -8, 8, -16, 16, -24, 24]) {
        if (dark && L + dL > 0.88) continue
        const c = oklch(L + dL, C, H + dH)
        if (stageColourValid(c, s)) out.push({ c, cost: Math.abs(dL) * 100 + Math.abs(dH) * 0.25 + (k === 'focus' ? 6 : 0) })
      }
    return out
  }
  for (let pass = 0; pass < 8 && stageScore(cur) < 8; pass++) {
    let best: { k: StageKey; c: string; val: number } | null = null
    for (const k of STAGE_KEYS) for (const v of variants(seeds[k], k)) {
      const sc = stageScore({ ...cur, [k]: v.c }), gain = sc - stageScore(cur)
      if (gain > 0.3) { const val = Math.min(sc, 8) * 10 - v.cost; if (!best || val > best.val) best = { k, c: v.c, val } }
    }
    if (!best) break
    cur[best.k] = best.c
  }
  return cur
}

const harmonised = new Map<string, Stages>()
/** The shipped stage colours of a built-in theme. */
export function themeStages(s: ThemeSeed): Stages {
  let stages = harmonised.get(s.id)
  if (!stages) harmonised.set(s.id, (stages = harmoniseStages(s)))
  return stages
}

// --- Resolution with the user's choices --------------------------------------

/** Legacy custom base colours (customLight / customDark keys), honoured as surface overrides. */
export interface SurfaceOverrides { bg?: string; surface?: string; surface2?: string; border?: string; text?: string; muted?: string; writingBg?: string; writingText?: string; onAccent?: string }

export interface ThemeChoice {
  themeId: string
  mode: ThemeMode
  stageOverrides?: Partial<Stages>
  focusIsAccent?: boolean
  surfaceOverrides?: SurfaceOverrides
  highContrast?: boolean
  navTone?: NavTone
  /** The chosen theme of the other mode, used by navTone 'inverse'. */
  partnerId?: string
}

/** Applies legacy surface overrides to a seed, keeping text readable on them. */
function withSurfaces(seed: ThemeSeed, o: SurfaceOverrides): ThemeSeed {
  const s = { ...seed }
  if (o.bg) s.canvas = o.bg
  if (o.surface) s.base = o.surface
  if (o.surface2) s.sunken = o.surface2
  if (o.border) s.border = o.border
  if (o.text) s.text = o.text
  if (o.muted) s.text2 = o.muted
  if (o.onAccent) s.onAccent = o.onAccent
  for (const bg of [s.base, s.canvas, s.sunken]) { s.text = ensureContrast(s.text, bg, 7); s.text2 = ensureContrast(s.text2, bg, 4.5) }
  return s
}

/** The sidebar filled with the accent's hue: a deep rail in light themes, a muted ink rail in dark ones. */
function accentNav(t: Tokens, s: ThemeSeed): Tokens {
  const [L, C, H] = hexToOklch(s.accent)
  const dark = s.mode === 'dark'
  const bg = dark ? oklch(0.27, Math.min(C, 0.04), H) : oklch(Math.min(L, 0.36), Math.min(C, 0.08), H)
  const active = oklch(hexToOklch(bg)[0] + 0.1, Math.min(C, dark ? 0.05 : 0.09), H)
  const text = ensureContrast(bestOn(bg, '#FFFDF7', s.text, s.canvas), bg, 7)
  const activeText = ensureContrast(bestOn(active, text, '#FFFFFF'), active, 4.5)
  return {
    ...t,
    'nav.bg': bg, 'nav.text': text, 'nav.muted': ensureContrast(mix(text, bg, 0.3), bg, 4.5), 'nav.border': mix(bg, text, 0.18),
    'nav.hover': mix(bg, text, 0.08), 'nav.active.bg': active, 'nav.active.text': activeText,
    'nav.bookmark': contrast(s.mark, active) >= 2.2 ? s.mark : bestOn(active, '#FFFDF7', '#141414')
  }
}

/**
 * High contrast is a transform of whichever theme is active: secondary text becomes primary,
 * tertiary becomes secondary, borders reach 4.5:1, surfaces flatten toward the canvas and
 * accent and stage colours are pushed to 4.5:1.
 */
function highContrast(t: Tokens, s: ThemeSeed): Tokens {
  const h = { ...t }
  const canvas = t['bg.canvas']
  for (const k of ['bg.sunken', 'surface.base', 'surface.raised', 'surface.writing']) h[k] = mix(t[k], canvas, 0.5)
  const surfaces = ['bg.canvas', 'bg.sunken', 'surface.base', 'surface.raised', 'surface.writing', 'state.hover', 'control.bg']
  let text = t['text.primary']
  for (const k of surfaces) text = ensureContrast(text, h[k] ?? t[k], 7)
  h['text.primary'] = text; h['text.secondary'] = text; h['text.writing'] = ensureContrast(t['text.writing'], h['surface.writing'], 7)
  let tertiary = t['text.secondary']
  for (const k of surfaces) tertiary = ensureContrast(tertiary, h[k] ?? t[k], 4.5)
  h['text.tertiary'] = tertiary; h['chart.label'] = tertiary; h['illu.muted'] = tertiary
  let border = t['border.strong']
  for (const k of ['surface.base', 'bg.canvas', 'bg.sunken']) border = ensureContrast(border, h[k], 4.5)
  h['border.subtle'] = border; h['border.default'] = border; h['border.strong'] = border; h['chart.axis'] = border; h['state.disabled.border'] = border
  const base = h['surface.base']
  const accent = ensureContrast(ensureContrast(t['accent.default'], base, 4.5), canvas, 4.5)
  h['accent.default'] = accent
  h['text.onAccent'] = ensureContrast(bestOn(accent, t['text.onAccent'], '#FFFFFF', '#121212'), accent, 4.5)
  h['accent.hover'] = shiftL(accent, s.mode === 'dark' ? 0.045 : -0.05); h['accent.pressed'] = shiftL(accent, s.mode === 'dark' ? 0.085 : -0.09)
  h['accent.text'] = ensureContrast(t['accent.text'], base, 4.5); h['text.link'] = h['accent.text']
  h['state.selected.border'] = ensureContrast(t['state.selected.border'], base, 4.5)
  h['state.focusRing'] = ensureContrast(ensureContrast(t['state.focusRing'], base, 4.5), canvas, 4.5)
  for (const k of STAGE_KEYS) {
    const solid = ensureContrast(ensureContrast(t[`stage.${k}`], base, 4.5), canvas, 4.5)
    h[`stage.${k}`] = solid; h[`stage.${k}.text`] = solid
    h[`stage.${k}.on`] = ensureContrast(bestOn(solid, '#FFFFFF', '#121212', text), solid, 4.5)
  }
  h['nav.text'] = ensureContrast(t['nav.text'], t['nav.bg'], 7); h['nav.muted'] = h['nav.text']
  h['nav.border'] = ensureContrast(t['nav.border'], t['nav.bg'], 3)
  return h
}

/**
 * A last guard for customised themes: any pair that misses its contrast check moves the
 * foreground in lightness, or, when it cannot move far enough, the background.
 */
function repairContrast(input: Tokens): Tokens {
  const t = { ...input }
  for (let pass = 0; pass < 3; pass++) {
    const failing = contrastChecks(t).filter((r) => !r.pass)
    if (!failing.length) break
    for (const r of failing) {
      // Shared text colours stay put; the surface they sit on moves instead.
      const shared = r.fg === 'text.onAccent' || r.fg === 'text.primary'
      const fg = shared ? t[r.fg] : ensureContrast(t[r.fg], t[r.bg], r.min)
      if (contrast(fg, t[r.bg]) >= r.min) t[r.fg] = fg
      else t[r.bg] = ensureContrast(t[r.bg], t[r.fg], r.min)
    }
  }
  return t
}

/** Every semantic token for a theme under the user's overrides, contrast-guarded. */
export function resolveThemeTokens(choice: ThemeChoice): Tokens {
  const key = JSON.stringify(choice)
  const cached = resolved.get(key)
  if (cached) return cached
  const seed = themeById(choice.themeId, choice.mode) ?? themeById(choice.mode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME)!
  // High contrast uses the theme's own surfaces, as the beta.27 high-contrast base did.
  const surfaces = choice.highContrast ? {} : choice.surfaceOverrides ?? {}
  const hasSurfaces = Object.values(surfaces).some(Boolean)
  const s = hasSurfaces ? withSurfaces(seed, surfaces) : { ...seed }
  const stages = { ...themeStages(seed) }
  if (hasSurfaces) for (const k of STAGE_KEYS) stages[k] = guardStageColour(stages[k], s)
  const custom = choice.stageOverrides ?? {}
  for (const k of STAGE_KEYS) if (custom[k]) stages[k] = guardStageColour(custom[k]!, s)
  if (custom.focus) s.focus = stages.focus
  if (custom.focus && choice.focusIsAccent) {
    s.accent = stages.focus
    s.onAccent = bestOn(stages.focus, s.onAccent, s.text, s.canvas, '#FFFFFF', '#141414')
  }
  let t = deriveTokens(s, stages)
  if (surfaces.writingBg) t['surface.writing'] = surfaces.writingBg
  if (surfaces.writingText || surfaces.writingBg) t['text.writing'] = ensureContrast(surfaces.writingText ?? t['text.writing'], t['surface.writing'], 7)
  if (choice.navTone === 'inverse') {
    const partner = themeById(choice.partnerId ?? '', choice.mode === 'dark' ? 'light' : 'dark') ?? themeById(seed.pairsWith)
    if (partner) { const p = deriveTokens(partner, themeStages(partner)); for (const k of Object.keys(p)) if (k.startsWith('nav.')) t[k] = p[k] }
  } else if (choice.navTone === 'accent') t = accentNav(t, s)
  if (choice.highContrast) t = highContrast(t, s)
  // Migrated users can deliberately use their custom Focus colour for actions.
  // Keep the normal sidebar selection in that same family, including its label
  // and bookmark contrast. Explicit inverse/accent sidebar choices stay intact.
  if (custom.focus && choice.focusIsAccent && (choice.navTone ?? 'theme') === 'theme') {
    t['nav.active.bg'] = t['accent.default']
    t['nav.active.text'] = t['text.onAccent']
    t['nav.bookmark'] = contrast(s.mark, t['nav.active.bg']) >= 2.2 ? s.mark : bestOn(t['nav.active.bg'], s.base, s.text)
  }
  const customised = hasSurfaces || Object.keys(custom).length > 0 || choice.highContrast || (choice.navTone ?? 'theme') !== 'theme'
  if (customised) t = repairContrast(t)
  if (resolved.size > 64) resolved.clear()
  resolved.set(key, t)
  return t
}
const resolved = new Map<string, Tokens>()

/** CSS custom property for a semantic token: stage.focus.subtle -> --fr-stage-focus-subtle. */
export const cssName = (token: string): string => '--fr-' + token.replace(/\./g, '-')

/** Today's --tf-* names, read from the new semantic tokens (tokens/compat-map.json). */
export const COMPAT_MAP: Record<string, string> = {
  '--tf-bg': 'bg.canvas', '--tf-surface': 'surface.base', '--tf-surface-2': 'bg.sunken', '--tf-border': 'border.default', '--tf-text': 'text.primary', '--tf-muted': 'text.secondary',
  '--tf-writing-bg': 'surface.writing', '--tf-writing-text': 'text.writing', '--tf-focus': 'accent.default', '--tf-recall': 'stage.recall', '--tf-rest': 'stage.rest', '--tf-overtime': 'stage.overtime', '--tf-on-accent': 'text.onAccent',
  '--tf-nav-bg': 'nav.bg', '--tf-nav-text': 'nav.text', '--tf-nav-muted': 'nav.muted', '--tf-nav-border': 'nav.border', '--tf-nav-active': 'nav.active.bg', '--tf-nav-onActive': 'nav.active.text', '--tf-nav-bookmark': 'nav.bookmark',
  '--tf-line-focus': 'stage.focus', '--tf-line-distracted': 'timeline.distracted', '--tf-line-detected': 'timeline.detected', '--tf-line-idle': 'timeline.idle'
}

// --- Checks (also used by the tests) -------------------------------------------

export interface ContrastRow { group: string; fg: string; bg: string; ratio: number; min: number; pass: boolean }

/** The design system's contrast checks for one resolved theme (build.mjs, "checks"). */
export function contrastChecks(t: Tokens): ContrastRow[] {
  const rows: ContrastRow[] = []
  const add = (group: string, fg: string, bg: string, min: number, advisory = false): void => { const ratio = contrast(t[fg] ?? fg, t[bg] ?? bg); rows.push({ group, fg, bg, ratio, min, pass: advisory || ratio >= min }) }
  for (const fg of ['text.primary', 'text.secondary', 'text.tertiary']) for (const bg of ['bg.canvas', 'bg.sunken', 'surface.base', 'surface.raised']) add('Text', fg, bg, 4.5)
  add('Text', 'text.writing', 'surface.writing', 7); add('Text', 'text.link', 'surface.base', 4.5); add('Text', 'text.link', 'bg.canvas', 4.5)
  add('Accent', 'text.onAccent', 'accent.default', 4.5); add('Accent', 'text.onAccent', 'accent.hover', 4.5); add('Accent', 'text.onAccent', 'accent.pressed', 4.5)
  add('Accent', 'accent.subtleText', 'accent.subtle', 4.5); add('Accent', 'accent.default', 'surface.base', 3, true); add('Accent', 'accent.text', 'surface.base', 4.5)
  add('States', 'state.selected.text', 'state.selected.bg', 4.5); add('States', 'state.selected.border', 'surface.base', 3)
  add('States', 'state.focusRing', 'surface.base', 3); add('States', 'state.focusRing', 'bg.canvas', 3); add('States', 'border.strong', 'surface.base', 3)
  add('States', 'text.primary', 'state.hover', 4.5); add('States', 'text.primary', 'control.bg', 4.5); add('States', 'text.primary', 'control.bgHover', 4.5); add('States', 'text.primary', 'state.pressed', 4.5)
  for (const k of ['success', 'warning', 'error', 'info']) { add('Status', `status.${k}.fg`, 'surface.base', 4.5); add('Status', `status.${k}.fg`, `status.${k}.bg`, 4.5); add('Status', `status.${k}.solid`, 'surface.base', 3) }
  for (const k of STAGE_KEYS) { add('Stages', `stage.${k}`, 'surface.base', 3); add('Stages', `stage.${k}.text`, 'surface.base', 4.5); add('Stages', `stage.${k}.on`, `stage.${k}`, 4.5); add('Stages', 'text.primary', `stage.${k}.subtle`, 4.5) }
  for (let i = 1; i <= 8; i++) add('Chart', `chart.series.${i}`, 'surface.base', 3)
  add('Chart', 'chart.label', 'surface.base', 4.5); add('Chart', 'chart.heat.4', 'surface.base', 3)
  for (const k of ['distracted', 'detected', 'idle']) add('Timeline', `timeline.${k}`, 'surface.base', 3)
  add('Navigation', 'nav.text', 'nav.bg', 4.5); add('Navigation', 'nav.muted', 'nav.bg', 4.5); add('Navigation', 'nav.active.text', 'nav.active.bg', 4.5); add('Navigation', 'nav.bookmark', 'nav.active.bg', 2.2)
  add('Learn', 'illu.line', 'illu.paper', 4.5); add('Learn', 'illu.line', 'illu.wash', 4.5); add('Learn', 'illu.highlightStroke', 'illu.paper', 3); add('Learn', 'illu.highlight', 'illu.paper', 3, true)
  return rows
}

/** Minimum pairwise CIEDE2000 between the first `n` chart series, per vision type. */
export function chartSeparation(t: Tokens, n: number): Record<string, number> {
  const series = Array.from({ length: n }, (_, i) => t[`chart.series.${i + 1}`])
  return Object.fromEntries(CVD_TYPES.map((type) => {
    const sim = series.map((c) => simulate(c, type))
    let min = Infinity
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, deltaE00(sim[i], sim[j]))
    return [type, min]
  }))
}

/** Minimum pairwise CIEDE2000 between the four stage colours, per vision type. */
export function stageSeparation(t: Tokens): Record<string, number> {
  const st = STAGE_KEYS.map((k) => t[`stage.${k}`])
  return Object.fromEntries(CVD_TYPES.map((type) => {
    const sim = st.map((c) => simulate(c, type))
    let min = Infinity
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) min = Math.min(min, deltaE00(sim[i], sim[j]))
    return [type, min]
  }))
}

/** Dark restraint (owner feedback, round 2): dim canvas, muted accent and stages, an accent that does not glow. */
export function darkRestraint(s: ThemeSeed, t: Tokens): { canvasL: number; accentC: number; stageC: number; accentGlow: number; ok: boolean } {
  const [canvasL] = hexToOklch(s.canvas), [, accentC] = hexToOklch(s.accent)
  const stageC = Math.max(...STAGE_KEYS.map((k) => hexToOklch(t[`stage.${k}`])[1]))
  const accentGlow = contrast(s.accent, s.base)
  return { canvasL, accentC, stageC, accentGlow, ok: canvasL >= 0.22 && canvasL <= 0.31 && accentC <= 0.12 && stageC <= Math.max(0.09, accentC + 0.005) && accentGlow <= 8 }
}

/** OKLab lightness of sunken, canvas, card and raised: dark elevation must rise at every step. */
export const elevation = (t: Tokens): number[] => ['bg.sunken', 'bg.canvas', 'surface.base', 'surface.raised'].map((k) => hexToOklab(t[k])[0])
