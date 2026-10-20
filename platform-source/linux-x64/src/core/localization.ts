import ar from './locales/ar.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import zh from './locales/zh-Hans.json'
import pt from './locales/pt-BR.json'
import de from './locales/de.json'

export const LANGUAGES = [
  { id: 'en', name: 'English', direction: 'ltr' },
  { id: 'ar', name: 'العربية', direction: 'rtl' },
  { id: 'es', name: 'Español', direction: 'ltr' },
  { id: 'fr', name: 'Français', direction: 'ltr' },
  { id: 'zh-Hans', name: '简体中文', direction: 'ltr' },
  { id: 'pt-BR', name: 'Português (Brasil)', direction: 'ltr' },
  { id: 'de', name: 'Deutsch', direction: 'ltr' }
] as const
export type AppLanguage = typeof LANGUAGES[number]['id']
export const catalogs: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = { ar, es, fr, 'zh-Hans': zh, 'pt-BR': pt, de }
// A symmetric lookup for authoring variants. Map also prevents inherited
// properties such as "constructor" from being treated as translated text.
const normalizedCatalogs = Object.fromEntries(Object.entries(catalogs).map(([language, catalog]) =>
  [language, new Map(Object.entries(catalog).map(([key, value]) => [key.trim().replaceAll('…', '...'), value]))]))
export function isLanguage(value: unknown): value is AppLanguage {
  return LANGUAGES.some(language => language.id === value)
}
export function normalizeLanguage(value: unknown): AppLanguage { return isLanguage(value) ? value : 'en' }
/** Translates application copy only. Never pass notes, subject names or saved answers here. */
export function translate(language: AppLanguage, english: string, values?: Record<string, string | number | null | undefined>): string {
  const catalog = language === 'en' ? undefined : catalogs[language]
  const trimmed = english.trim()
  const exact = catalog && Object.hasOwn(catalog, english) ? catalog[english] : undefined
  const translated = exact ?? normalizedCatalogs[language]?.get(trimmed.replaceAll('…', '...'))
  const message = translated ? (english === trimmed || exact ? translated : english.slice(0, english.indexOf(trimmed)) + translated + english.slice(english.indexOf(trimmed) + trimmed.length)) : english
  return values ? message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? isolateValue(language, values[key]) : token) : message
}

function isolateValue(language: AppLanguage, value: string | number | null | undefined): string {
  const text = String(value ?? '')
  // Keep embedded names, file paths and numbers in their own bidi run. This is
  // display-only; the stored value and editable notes are never modified.
  return language === 'ar' && text ? `\u2068${text}\u2069` : text
}
