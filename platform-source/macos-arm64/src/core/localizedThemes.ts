import { translate,type AppLanguage } from './localization'

// These are application-owned palette names, never names of saved user presets.
export const THEME_COLOUR_NAMES=['Crimson','Violet','Teal','Cobalt','Amber','Rose','Tangerine','Emerald','Plum','Graphite']
export function localizedThemeName(language:AppLanguage,name:string):string {
  const t=(key:string,values?:Record<string,string>):string=>translate(language,key,values)
  let match=/^(White|Night) \/ (\w+)$/.exec(name)
  if(match&&THEME_COLOUR_NAMES.includes(match[2]))return t('{base} / {accent}',{base:t(match[1]==='White'?'White':'Night'),accent:t(match[2])})
  match=/^White \+ (\w+) night$/.exec(name)
  if(match&&THEME_COLOUR_NAMES.includes(match[1]))return t('White + {colour} night',{colour:t(match[1])})
  match=/^(\w+) ink \+ white$/.exec(name)
  if(match&&THEME_COLOUR_NAMES.includes(match[1]))return t('{colour} ink + white',{colour:t(match[1])})
  match=/^(\w+) · (pale|deep) color \/ (dark|light)$/.exec(name)
  if(match&&THEME_COLOUR_NAMES.includes(match[1]))return t(match[2]==='pale'?'{colour} · pale colour / dark':'{colour} · deep colour / light',{colour:t(match[1])})
  if(name==='Paper & Ink · reference')return t('Paper & Ink · reference')
  return t(name)
}
