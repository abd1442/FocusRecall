import { describe, expect, it } from 'vitest'
import { catalogs, isLanguage, LANGUAGES, normalizeLanguage, translate } from './localization'
import { fieldDisplay, groupDisplayName, reasonDisplayName } from './localizedFields'
import { SEED_GROUPS, seedOptions, type LogField, type LogGroup } from './logfields'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'

describe('localization safety', () => {
  it('never resolves inherited object properties as application copy', () => {
    for (const {id} of LANGUAGES) for (const key of ['constructor', 'toString', '__proto__'])
      expect(translate(id, key)).toBe(key)
  })
  it('matches ellipsis variants symmetrically while preserving fragment spacing', () => {
    expect(translate('ar', ' Opening Spotify... ')).toBe(' جارٍ فتح Spotify… ')
    expect(translate('de', 'Opening Spotify...')).toBe(translate('de', 'Opening Spotify…'))
  })
  it('isolates mixed-direction values in Arabic without altering stored content', () => {
    const name = 'Physics 101 — 中文'
    expect(translate('ar', 'Remove {value0}', {value0:name})).toContain(`\u2068${name}\u2069`)
    expect(translate('de', 'Remove {value0}', {value0:name})).not.toContain('\u2068')
    expect(name).toBe('Physics 101 — 中文')
  })
  it('uses English for old or invalid preferences, without guessing a country', () => {
    for (const value of [undefined, null, '', 'ar-EG', '../../ar', '<script>', 'xx']) expect(normalizeLanguage(value)).toBe('en')
    expect(isLanguage('ar')).toBe(true)
    expect(LANGUAGES.filter(language => language.direction === 'rtl').map(language => language.id)).toEqual(['ar'])
  })
  for (const { id } of LANGUAGES) it(`provides usable controls and safe interpolation in ${id}`, () => {
    expect(translate(id, 'Start').trim().length).toBeGreaterThan(0)
    expect(translate(id, 'Unknown application copy')).toBe('Unknown application copy')
    const privateName = 'My private مادة <not markup> 中文'
    expect(translate(id, '{value0} of focus', { value0: privateName })).toContain(privateName)
    expect(translate(id, 'Keep this {missing}')).toBe('Keep this {missing}')
  })
  it('preserves interpolation placeholders in every translated message', () => {
    const tokens = (s: string): string[] => [...s.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort()
    for (const [language, catalog] of Object.entries(catalogs)) for (const [key, value] of Object.entries(catalog)) {
      expect(value.trim(), `${language}: ${key}`).not.toBe('')
      expect(tokens(value), `${language}: ${key}`).toEqual(tokens(key))
    }
  })
  it('translates only unchanged built-in metadata, keeping canonical answer IDs and custom labels', () => {
    const group = SEED_GROUPS.find(group => group.fields.some(field => (field.options?.length ?? 0) > 2))!
    const seed = group.fields.find(field => (field.options?.length ?? 0) > 2)!
    const field: LogField = { id: 123, key: seed.key, label: seed.label, groupId: 1, type: seed.type,
      options: seedOptions(seed.options), scale: seed.scale ?? null, sortOrder: 0, archived: false }
    const before = JSON.stringify(field)
    for (const { id } of LANGUAGES) expect(fieldDisplay(id, field).options.map(option => option.id)).toEqual(field.options.map(option => option.id))
    expect(JSON.stringify(field)).toBe(before)
    expect(fieldDisplay('ar', { ...field, label: 'My private custom label' }).label).toBe('My private custom label')
    const custom = { ...field, key: null, label: 'Focus', options: [{ id: 'mine', label: 'Home' }] }
    expect(fieldDisplay('ar', custom)).toBe(custom)
    expect(fieldDisplay('ar', { ...field, options: [{ id: 'mine', label: 'Home' }] }).options[0].label).toBe('Home')
    const renamed = { id: 1, key: group.key, name: 'My group', section: group.section, sortOrder: 0, archived: false } satisfies LogGroup
    expect(groupDisplayName('ar', renamed)).toBe('My group')
  })
  it('adds a preference without a schema migration or rewriting historical settings', () => {
    const db = openDatabase(':memory:')
    try {
      db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('nextGoal', JSON.stringify('Private existing goal'))
      const settings = new SettingsRepo(db)
      const schema = db.prepare('PRAGMA user_version').get()
      expect(settings.getAll().language).toBe('en')
      settings.set('language', 'ar')
      expect(new SettingsRepo(db).getAll().language).toBe('ar')
      expect(settings.getAll().nextGoal).toBe('Private existing goal')
      expect(db.prepare('PRAGMA user_version').get()).toEqual(schema)
      expect(() => settings.set('language', 'bad' as never)).toThrow('supported language')
      settings.writeRaw('language', 'old-unknown-language')
      expect(settings.getAll().language).toBe('en')
      expect(settings.readRaw('language')).toBe('old-unknown-language')
    } finally { db.close() }
  })
  it('keeps custom and renamed distraction reasons unchanged', () => {
    expect(reasonDisplayName('ar', {id:'phone',label:'Phone'})).toBe('الهاتف')
    expect(reasonDisplayName('ar', {id:'custom',label:'Phone'})).toBe('Phone')
    expect(reasonDisplayName('ar', {id:'phone',label:'My work phone'})).toBe('My work phone')
  })
})
