import copy from './adviceBriefCopy.json'
import type { AppLanguage } from './localization'
export function adviceBrief(id:string,language:AppLanguage):string {
  const text=(copy as Record<string,Record<AppLanguage,string>>)[id]?.[language]
  if(!text)throw Error('Missing concise advice translation: '+id+':'+language)
  return text
}
