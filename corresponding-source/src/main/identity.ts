import { join, resolve, relative, isAbsolute, parse, dirname, sep } from 'node:path'
import { existsSync, readFileSync, realpathSync, lstatSync } from 'node:fs'
import { DATA_IDENTITY, LEGACY_IDENTITY } from '@core/identity'
export function profileDirectory(appData:string,override:string|undefined,exists:(path:string)=>boolean=existsSync):string {
  if(override)return join(override,'profile')
  const current=join(appData,DATA_IDENTITY.profile),legacy=join(appData,LEGACY_IDENTITY.profile)
  if([DATA_IDENTITY.database,DATA_IDENTITY.demoDatabase].some(name=>exists(join(current,name))))return current
  if([LEGACY_IDENTITY.database,LEGACY_IDENTITY.demoDatabase].some(name=>exists(join(legacy,name))))return legacy
  return current
}
export const isolatedDataDirectory = ():string|undefined => process.env['FOCUSRECALL_DATA_DIR']||process.env[DATA_IDENTITY.dataOverride]||process.env[LEGACY_IDENTITY.dataOverride]

export const QA_MARKER='QA-FICTIONAL.txt'
const canonical=(value:string):string=>{
  let ancestor=resolve(value),tail:string[]=[]
  while(!existsSync(ancestor)){tail.unshift(parse(ancestor).base);const parent=dirname(ancestor);if(parent===ancestor)break;ancestor=parent}
  return resolve(realpathSync(ancestor),...tail)
}
const overlaps=(left:string,right:string):boolean=>{
  const inside=(a:string,b:string):boolean=>{const r=relative(a,b);return r===''||!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep)}
  return inside(left,right)||inside(right,left)
}
/** QA never falls back to normal data. A marker is an explicit fictional-data
 * declaration, not evidence inferred by opening or inspecting a study database. */
export function packagedDataDirectory(qa:boolean,appData:string,env:NodeJS.ProcessEnv=process.env):string|undefined {
  const override=env.FOCUSRECALL_DATA_DIR||env[DATA_IDENTITY.dataOverride]||env[LEGACY_IDENTITY.dataOverride]
  if(!qa){
    if(override){
      // Keep production and all descendants of marked QA roots disjoint.
      for(let dir=canonical(override);;dir=dirname(dir)){
        if(existsSync(join(dir,QA_MARKER)))throw Error('Production cannot open a marked QA data directory.')
        if(dirname(dir)===dir)break
      }
    }
    return override
  }
  const chosen=env.FOCUSRECALL_DATA_DIR
  if(!chosen||!isAbsolute(chosen)||!existsSync(chosen)||!lstatSync(chosen).isDirectory())throw Error('QA requires an explicit existing absolute FOCUSRECALL_DATA_DIR.')
  const folder=canonical(chosen)
  if(folder===parse(folder).root||overlaps(folder,canonical(appData)))throw Error('QA data must be outside normal application profiles.')
  for(const key of [DATA_IDENTITY.dataOverride,LEGACY_IDENTITY.dataOverride])if(env[key]&&canonical(env[key]!)!==folder)throw Error('QA data overrides must identify the same isolated directory.')
  // A crafted Chromium profile junction must not escape the marked fixture.
  const userData=canonical(join(folder,'profile')),within=relative(folder,userData)
  if(isAbsolute(within)||within==='..'||within.startsWith('..'+sep)||overlaps(userData,canonical(appData)))throw Error('QA data must be outside normal application profiles.')
  const marker=join(folder,QA_MARKER)
  if(!existsSync(marker)||!lstatSync(marker).isFile()||lstatSync(marker).isSymbolicLink()||readFileSync(marker,'utf8').trim()!=='FocusRecall fictional profile only')throw Error('QA requires the fictional-profile marker.')
  return folder
}
