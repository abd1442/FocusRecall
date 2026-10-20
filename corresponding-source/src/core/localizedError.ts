import { translate, type AppLanguage } from './localization'

/** Translate known app validation messages; retain diagnostic details for unknown
 * OS/library failures. Never interpret error text as markup or as instructions. */
export function localizedError(language:AppLanguage,error:unknown):string {
  const details=(error instanceof Error?error.message:String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'')
  const known=translate(language,details)
  return language==='en'||known!==details?known:translate(language,'Could not complete this action. Details: {details}',{details})
}
