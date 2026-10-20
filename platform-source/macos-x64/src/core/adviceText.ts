import copy from './adviceCopy.json'
import type { AppLanguage } from './localization'
export interface AdviceCopy {action:string;detail:string}
/** Catalog errors must fail validation, never silently become English. */
export function adviceText(id:string,language:AppLanguage):AdviceCopy {
  const entry=(copy as Record<string,Record<AppLanguage,AdviceCopy>>)[id]?.[language]
  if(!entry)throw Error('Missing advice translation: '+id+':'+language)
  return entry
}
