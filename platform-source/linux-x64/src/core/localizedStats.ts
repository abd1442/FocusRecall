import type { FactorDef } from './statsData'
import type { LogSchema } from './logfields'
import { fieldDisplay } from './localizedFields'
import { translate, type AppLanguage } from './localization'

/** Translate seeded labels by identity. A custom field or option keeps its text. */
export function factorCopy(language:AppLanguage,schema:LogSchema,factor:FactorDef,value?:string):string {
  const field=schema.fields.find(f=>'field:'+f.id===factor.key)
  if(field){
    const shown=fieldDisplay(language,field)
    if(value===undefined)return shown.label
    const option=field.options.find(o=>o.label===value)
    if(option)return shown.options.find(o=>o.id===option.id)?.label??value
    const index=field.scale?.labels.indexOf(value)??-1
    return index>=0?shown.scale?.labels[index]??value:value
  }
  if(value===undefined)return factor.group==='derived'?translate(language,factor.label):factor.label
  // Learning-stage names are editable. Do not infer ownership from their text.
  return factor.group==='derived'&&factor.key!=='stage'?translate(language,value):value
}
