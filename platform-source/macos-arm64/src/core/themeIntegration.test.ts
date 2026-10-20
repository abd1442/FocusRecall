import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ACCENT_SETS, normalizeAppearance, stageOverridePatch, toCssVars } from './appearance'
import { validateIpcArgs } from './ipcValidation'
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, resolveThemeTokens, STAGE_KEYS } from './themes'
import migration from './themeMigration.json'

describe('theme integration compatibility boundaries', () => {
  it('validates the current appearance across save, preset and export IPC without weakening enum checks', () => {
    const appearance = normalizeAppearance(null)
    for (const [channel, args] of [['appearance:set', [appearance]], ['appearance:savePreset', ['Fictional setup', appearance]], ['appearance:export', [appearance]]] as const) {
      expect(() => validateIpcArgs(channel, [...args])).not.toThrow()
      expect(() => validateIpcArgs(channel, args.map(a => a === appearance ? { ...appearance, navTone: 'invalid' } : a))).toThrow()
      expect(() => validateIpcArgs(channel, args.map(a => a === appearance ? { ...appearance, stageOverrides: { light: { focus: 42 }, dark: {} } } : a))).toThrow()
    }
  })
  it('preserves the approved branded default tokens on fresh and legacy default profiles', () => {
    for (const a of [normalizeAppearance(null), normalizeAppearance({ colourId: 'paper-auto', accentId: 'palette', mode: 'system' })]) {
      for (const [dark, id] of [[false, DEFAULT_LIGHT_THEME], [true, DEFAULT_DARK_THEME]] as const) {
        const vars = toCssVars(a, dark), expected = resolveThemeTokens({ themeId: id, mode: dark ? 'dark' : 'light' })
        for (const [key, value] of Object.entries(expected)) expect(vars['--fr-' + key.replace(/\./g, '-')]).toBe(value)
      }
    }
  })
  it('migrates every approved legacy id without mutating input or losing unrelated preferences', () => {
    for (const [colourId, [lightTheme, darkTheme, navTone]] of Object.entries(migration)) {
      const old = { colourId, accentId: 'palette', mode: 'system' as const, sidebarCollapsed: true, sidebarWidth: 256, density: 'compact' as const, roundness: 0, uiScale: 1.2, panelSize: 'small' as const, panelOpacity: 0.7, fontWriting: 'Georgia', customLight: { focus: '#7A3E9D' }, customDark: { focus: '#C9A7E8' }, linePalette: 'custom' as const, lineCustom: { focus: '#123456', distracted: '#987654', detected: '#654321', idle: '#888888' } }
      const untouched = structuredClone(old), next = normalizeAppearance(old)
      expect(old).toEqual(untouched)
      expect([next.lightTheme, next.darkTheme, next.navTone], colourId).toEqual([lightTheme, darkTheme, navTone])
      for (const [key, value] of Object.entries(old)) expect(next[key as keyof typeof next], key).toEqual(value)
      expect(normalizeAppearance(JSON.parse(JSON.stringify(next)))).toEqual(next)
    }
  })
  it('carries both sides of a legacy accent set, with custom colours taking precedence and raw requests retained', () => {
    for (const set of ACCENT_SETS.filter(s => s.id !== 'palette')) {
      const next = normalizeAppearance({ colourId: 'original', accentId: set.id, mode: 'light', customLight: { focus: '#FFFFFF' }, customDark: { rest: '#000000' } })
      expect(next.stageOverrides).toEqual({ light: { ...set.light, focus: '#FFFFFF' }, dark: { ...set.dark, rest: '#000000' } })
      expect(next.customLight.focus).toBe('#FFFFFF')
      expect(next.customDark.rest).toBe('#000000')
      expect(toCssVars(next, false)['--fr-stage-focus']).not.toBe('#FFFFFF')
    }
  })
  it('changing or clearing one side never discards the independent other side or its custom Focus colour', () => {
    let a = normalizeAppearance({ ...normalizeAppearance(null), lightTheme: 'library', darkTheme: 'darkroom', stageOverrides: { light: { focus: '#7A3E9D' }, dark: { focus: '#C9A7E8' } } })
    a = normalizeAppearance({ ...a, ...stageOverridePatch(a, 'light', 'focus', null) })
    expect(a.stageOverrides).toEqual({ light: {}, dark: { focus: '#C9A7E8' } })
    expect([a.lightTheme, a.darkTheme]).toEqual(['library', 'darkroom'])
    for (const mode of ['light', 'dark', 'system'] as const) expect(normalizeAppearance({ ...a, mode }).darkTheme).toBe('darkroom')
  })
  it('keeps design seeds, migration rules and the 26 approved palette definitions unchanged by integration', () => {
    const approved = JSON.parse(readFileSync(join(__dirname, '../../docs/design/theme-system-2026/tokens/themes.json'), 'utf8'))
    expect(approved.themes).toHaveLength(26)
    for (const theme of approved.themes) {
      const rendered = resolveThemeTokens({ themeId: theme.id, mode: theme.mode })
      for (const stage of STAGE_KEYS) expect(rendered[`stage.${stage}`]).toBe(theme.semantic[`stage.${stage}`])
    }
  })
})
