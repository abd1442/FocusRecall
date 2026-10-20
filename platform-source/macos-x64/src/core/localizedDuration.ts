import { formatDuration } from './timer'
import { translate, type AppLanguage } from './localization'

/** Keep arithmetic and clock formatting independent of display language. */
export function localizedDuration(seconds:number, language:AppLanguage):string {
  return formatDuration(seconds).replace(/\b(h|min|s)\b/g, unit=>translate(language,unit))
}
