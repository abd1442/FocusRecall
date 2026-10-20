import { describe, expect, it } from 'vitest'
import {
  BASES,
  DEFAULT_APPEARANCE,
  PANEL_SIZES,
  contrastRatio,
  colorDistance,
  LINE_COLORS,
  LINE_PALETTES,
  tooCloseTo,
  normalizeAppearance,
  stageOverridePatch,
  themeTokensFor,
  paletteFor,
  toCssVars,
  type Base
} from './appearance'
import { ITEM_PALETTE } from './palette'

describe('contrastRatio', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1)
  })
})

describe('bases', () => {
  for (const [name, b] of Object.entries(BASES) as [string, Base][]) {
    it(`${name}: body text 7:1, muted 4.5:1, never pure white on pure black`, () => {
      for (const s of [b.bg, b.surface]) expect(contrastRatio(b.text, s)).toBeGreaterThanOrEqual(7)
      expect(contrastRatio(b.writingText, b.writingBg)).toBeGreaterThanOrEqual(7)
      for (const s of [b.bg, b.surface, b.surface2]) expect(contrastRatio(b.muted, s)).toBeGreaterThanOrEqual(4.5)
      expect([b.text, b.bg, b.writingText, b.writingBg]).not.toContain('#FFFFFF')
      expect([b.text, b.bg, b.writingText, b.writingBg]).not.toContain('#000000')
    })
  }
})

describe('normalizeAppearance', () => {
  it('keeps digital timers for existing profiles and persists only recognized display choices', () => {
    expect(normalizeAppearance(null).panelTimerDisplay).toBe('digital')
    expect(normalizeAppearance({ panelSize: 'small' }).panelTimerDisplay).toBe('digital')
    expect(normalizeAppearance({ panelTimerDisplay: 'unknown' as never }).panelTimerDisplay).toBe('digital')
    const saved = normalizeAppearance({ ...DEFAULT_APPEARANCE, panelTimerDisplay: 'circular' })
    expect(normalizeAppearance(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })
  it('preserves older preferences and validates the new colour family independently', () => {
    expect(normalizeAppearance({ accentId: 'dusk', mode: 'dark' }).colourId).toBe('original')
    expect(normalizeAppearance({ colourId: 'unknown' }).colourId).toBe('original')
    const stored = normalizeAppearance({ colourId: 'refined', accentId: 'rose', linePalette: 'custom', lineCustom: { distracted: '#123456', detected: '#654321', idle: '#ABCDEF' } })
    expect(normalizeAppearance(JSON.parse(JSON.stringify(stored)))).toEqual(stored)
    expect(paletteFor(stored, false).line).toEqual(stored.lineCustom)
  })
  it('fills defaults and clamps ranges', () => {
    const a = normalizeAppearance({ uiScale: 3, panelOpacity: 0.1, accentId: 'nope', panelSize: 'huge' as never })
    expect(a.uiScale).toBe(1.6)
    expect(a.panelOpacity).toBe(0.3)
    expect(a.accentId).toBe('calm')
    expect(a.panelSize).toBe('medium')
  })
  it('maps the old whole-app themes to accent sets', () => {
    expect(normalizeAppearance({ themeId: 'paper' } as never).accentId).toBe('amber')
    const c = normalizeAppearance({ themeId: 'contrast' } as never)
    expect(c.highContrast).toBe(true)
    expect('themeId' in c).toBe(false)
  })
})

describe('panel sizes', () => {
  it('medium is the original panel size; small is smaller; large a little bigger', () => {
    // The panel design is 300 x 76 compact; the original panel was about 232 x 58.
    expect(Math.round(300 * PANEL_SIZES.medium)).toBeGreaterThanOrEqual(228)
    expect(Math.round(300 * PANEL_SIZES.medium)).toBeLessThanOrEqual(240)
    expect(PANEL_SIZES.small).toBeLessThan(PANEL_SIZES.medium * 0.85)
    expect(PANEL_SIZES.large).toBeGreaterThan(PANEL_SIZES.medium)
    expect(PANEL_SIZES.large).toBeLessThan(PANEL_SIZES.medium * 1.25)
  })
})

/** Saturation and lightness (0 to 1) of a hex colour. */
function satLight(hex: string): { s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  return { s: max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)), l }
}

describe('timeline colours', () => {
  it('preserves old custom distraction colours and gives focus a shared configurable colour',()=>{
    const old={distracted:'#123456',detected:'#654321',idle:'#ABCDEF'}
    const a=normalizeAppearance({linePalette:'custom',lineCustom:old})
    expect(a.lineCustom).toMatchObject(old)
    expect(toCssVars(a,false)['--tf-line-focus']).toBe(DEFAULT_APPEARANCE.lineCustom.focus)
    const custom=normalizeAppearance({...a,lineCustom:{...old,focus:'#204060'}})
    expect(toCssVars(custom,true)['--tf-line-focus']).toBe('#204060')
    for(const preset of LINE_PALETTES)for(const mode of ['light','dark'] as const){
      const appearance=normalizeAppearance({mode,linePalette:preset.id}),palette=paletteFor(appearance,false),vars=toCssVars(appearance,false)
      expect(vars['--tf-line-focus']).toBe(preset[mode].focus)
      for(const kind of ['focus','distracted','detected','idle'] as const)expect(contrastRatio(palette.line[kind]!,vars[`--tf-line-${kind}-text`])).toBeGreaterThanOrEqual(4.5)
    }
  })
  for (const palette of LINE_PALETTES)
    for (const mode of ['light', 'dark'] as const) {
      const c = palette[mode]
      const base = BASES[mode]
      it(`${palette.name} ${mode}: never close to a subject colour, apart from each other, visible on the base`, () => {
        for (const kind of [c.distracted, c.detected, c.idle]) {
          for (const subject of ITEM_PALETTE) expect(colorDistance(kind, subject)).toBeGreaterThanOrEqual(18)
          expect(contrastRatio(kind, base.bg)).toBeGreaterThanOrEqual(3)
        }
        expect(colorDistance(c.distracted, c.detected)).toBeGreaterThanOrEqual(20)
        expect(colorDistance(c.detected, c.idle)).toBeGreaterThanOrEqual(30)
        expect(colorDistance(c.distracted, c.idle)).toBeGreaterThanOrEqual(24)
      })
    }
  for (const mode of ['light', 'dark'] as const) {
    const c = LINE_COLORS[mode]
    it(`Calm ${mode}: calm (low saturation, sand and rose at a similar lightness)`, () => {
      for (const kind of [c.distracted, c.detected, c.idle]) expect(satLight(kind).s).toBeLessThanOrEqual(0.45)
      expect(Math.abs(satLight(c.distracted).l - satLight(c.detected).l)).toBeLessThanOrEqual(0.05)
    })
  }
  it('uses the chosen palette, or the custom colours', () => {
    const custom = { distracted: '#111111', detected: '#222222', idle: '#333333' }
    expect(paletteFor(normalizeAppearance({ mode: 'dark', linePalette: 'classic' }), false).line).toEqual(LINE_PALETTES[1].dark)
    expect(paletteFor(normalizeAppearance({ mode: 'light', linePalette: 'custom', lineCustom: custom }), false).line).toEqual({...custom,focus:DEFAULT_APPEARANCE.lineCustom.focus})
    expect(normalizeAppearance({ linePalette: 'nope' } as never).linePalette).toBe('calm')
  })
  it('warns when a custom colour is close to a subject colour', () => {
    expect(tooCloseTo('#5B8DEE', ITEM_PALETTE)).toContain('#5B8DEF')
    expect(tooCloseTo('#000000', ITEM_PALETTE)).toEqual([])
  })
})

describe('theme system and beta.27 migration', () => {
  it('starts fresh profiles on Ivory & Ink and Ink Dim, following Windows', () => {
    const a = normalizeAppearance(null)
    expect([a.mode, a.lightTheme, a.darkTheme, a.navTone]).toEqual(['system', 'ivory-ink', 'ink-dim', 'theme'])
    expect(toCssVars(a, false)['--fr-bg-canvas']).toBe('#F5F1E8')
    expect(toCssVars(a, true)['--fr-bg-canvas']).toBe(themeTokensFor(a, 'dark')['bg.canvas'])
    expect(toCssVars(a, false)['--tf-focus']).toBe('#183D56')
  })
  it('moves the beta.27 default (paper-auto) to the approved default pair without overrides', () => {
    const a = normalizeAppearance({ colourId: 'paper-auto', accentId: 'palette', mode: 'system', sidebarStyle: 'journal' })
    expect([a.lightTheme, a.darkTheme]).toEqual(['ivory-ink', 'ink-dim'])
    expect(a.stageOverrides).toEqual({ light: {}, dark: {} })
    expect(a.colourId).toBe('paper-auto')
  })
  it('keeps a custom Focus colour from beta.27, driving buttons as before', () => {
    const beta27 = { colourId: 'approved-14', accentId: 'palette', mode: 'dark' as const, fontUi: 'Georgia', customLight: { focus: '#7A3E9D' }, customDark: { focus: '#C9A7E8', bg: '#202124' } }
    const a = normalizeAppearance(JSON.parse(JSON.stringify(beta27)))
    expect(a.stageOverrides.light.focus).toBe('#7A3E9D')
    expect(a.stageOverrides.dark.focus).toBe('#C9A7E8')
    expect(a.focusIsAccent).toBe(true)
    expect(a.surfaceOverrides.dark).toEqual({ bg: '#202124' })
    expect(a.customLight).toEqual(beta27.customLight)
    expect(a.colourId).toBe('approved-14')
    expect(a.fontUi).toBe('Georgia')
    const vars = toCssVars(a, false)
    expect(vars['--fr-stage-focus']).toBe('#C9A7E8')
    expect(vars['--tf-focus']).toBe('#C9A7E8')
    expect(vars['--tf-bg']).toBe('#202124')
    expect(toCssVars({ ...a, mode: 'light' }, false)['--fr-stage-focus']).toBe('#7A3E9D')
    // Saved and read again, the migration does not run twice and nothing changes.
    expect(normalizeAppearance(JSON.parse(JSON.stringify(a)))).toEqual(a)
  })
  it('writes a legacy accent set into stage overrides for both sides', () => {
    const a = normalizeAppearance({ colourId: 'original', accentId: 'calm' })
    expect([a.lightTheme, a.darkTheme]).toEqual(['ivory-ink', 'graphite-night'])
    expect(a.stageOverrides.light).toEqual({ focus: '#3F6FB0', recall: '#80569A', rest: '#3A7D62', overtime: '#A55F1C' })
    expect(a.stageOverrides.dark.focus).toBe('#86A9DB')
  })
  it('keeps the sidebar intent of mixed layouts', () => {
    expect(normalizeAppearance({ colourId: 'paper-light-dark', accentId: 'palette' }).navTone).toBe('inverse')
    expect(normalizeAppearance({ colourId: 'approved-35', accentId: 'palette' }).navTone).toBe('accent')
  })
  it('repairs unknown theme ids and keeps choices made in the new page', () => {
    const a = normalizeAppearance({ lightTheme: 'nope', darkTheme: 'ivory-ink', navTone: 'loud' as never })
    expect([a.lightTheme, a.darkTheme, a.navTone]).toEqual(['ivory-ink', 'ink-dim', 'theme'])
    const chosen = normalizeAppearance({ ...normalizeAppearance(null), lightTheme: 'library', darkTheme: 'pewter-dim', colourId: 'sage' })
    expect([chosen.lightTheme, chosen.darkTheme]).toEqual(['library', 'pewter-dim'])
  })
  it('sets and clears one custom stage colour', () => {
    const a = normalizeAppearance(null)
    const set = normalizeAppearance({ ...a, ...stageOverridePatch(a, 'light', 'focus', '#204060') })
    expect(set.stageOverrides.light).toEqual({ focus: '#204060' })
    expect(normalizeAppearance({ ...set, ...stageOverridePatch(set, 'light', 'focus', null) }).stageOverrides.light).toEqual({})
  })
})
