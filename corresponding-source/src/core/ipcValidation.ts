import policy from './ipc-schema.json'
import type { Channel } from './api'

type Schema = {kind:string;value?:unknown;id?:string;options?:Schema[];items?:Schema[];minimum?:number;item?:Schema;properties?:Record<string,{optional:boolean;schema:Schema}>;index?:Schema}
const definitions = policy.definitions as Record<string,Schema>
export const IPC_CHANNELS = Object.keys(policy.channels) as Channel[]
export const IPC_EVENTS: readonly string[] = policy.events

function bounded(value:unknown, depth=0, budget={size:0,entries:0}):void {
  if(depth>32 || ++budget.entries>100000)throw Error('IPC payload is too complex.')
  if(value===undefined || value===null || typeof value==='boolean')return
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('IPC numbers must be finite.');return}
  if(typeof value==='string'){budget.size+=value.length;if(budget.size>32_000_000)throw Error('IPC payload is too large.');return}
  if(typeof value!=='object' || ![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('IPC requires plain data.')
  for(const [key,child] of Object.entries(value)){
    if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe IPC object key.')
    budget.size+=key.length;bounded(child,depth+1,budget)
  }
}
function matches(s:Schema,value:unknown,depth=0):boolean {
  if(depth>64)return false
  switch(s.kind){
    case 'json':return true
    case 'never':return false
    case 'undefined':return value===undefined
    case 'literal':return value===s.value
    case 'string':return typeof value==='string'
    case 'number':return typeof value==='number'&&Number.isFinite(value)
    case 'boolean':return typeof value==='boolean'
    case 'ref':return matches(definitions[s.id!],value,depth+1)
    case 'union':return s.options!.some(o=>matches(o,value,depth+1))
    case 'tuple':return Array.isArray(value)&&value.length>=s.minimum!&&value.length<=s.items!.length&&s.items!.every((item,i)=>i>=value.length||matches(item,value[i],depth+1))
    case 'array':return Array.isArray(value)&&value.every(v=>matches(s.item!,v,depth+1))
    case 'object':{
      if(!value || typeof value!=='object'||Array.isArray(value))return false
      const object=value as Record<string,unknown>
      if(!Object.entries(s.properties!).every(([key,p])=>p.optional&&object[key]===undefined||matches(p.schema,object[key],depth+1)))return false
      return !s.index || Object.values(object).every(v=>matches(s.index!,v,depth+1))
    }
    default:return false
  }
}
export function validateIpcArgs(channel:string,args:unknown[]):void {
  if(!Object.hasOwn(policy.channels,channel))throw Error('Unknown IPC channel.')
  bounded(args)
  if(!matches((policy.channels as Record<string,Schema>)[channel],args))throw Error(`Invalid arguments for ${channel}.`)
  if(channel==='notes:delete' && !/^[a-z0-9-]{1,80}$/i.test(args[0] as string))throw Error('Invalid note ID.')
  if(channel==='settings:set'){
    const key=args[0] as string
    if(!Object.hasOwn(policy.settings,key)||!matches((policy.settings as Record<string,Schema>)[key],args[1]))throw Error('Invalid setting value.')
    const value=args[1]
    if(key==='dailyStudyGoalMinutes'&&(typeof value!=='number'||!Number.isInteger(value)||value<0||value>1440))throw Error('Invalid setting value.')
    if(['focusTargetMinutes','fixedMinutes'].includes(key)&&(typeof value!=='number'||value<1||value>1440))throw Error('Choose a timer length between 1 and 1440 minutes.')
    if(['sittingAutoEndHours','longAbsenceMinutes'].includes(key)&&(typeof value!=='number'||value<0||value>10080))throw Error('Choose a valid duration.')
    if(key==='soundVolume'&&(typeof value!=='number'||value<0||value>1))throw Error('Choose a volume between 0 and 1.')
    if(key==='dayStart'&&(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))throw Error('Choose a valid study-day start time.')
    if(['studyReminderDailyTime','studyReminderQuietStart','studyReminderQuietEnd'].includes(key)&&(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))throw Error('Choose a valid reminder time.')
    if(key==='preparationChecks'&&(value as string[]).length>6)throw Error('Use at most six preparation checks.')
    if(key==='restRules') {
      const rules = value as {minutesPerFive:number;minMinutes:number;maxMinutes:number;longEvery:number;longMinutes:number}
      if(rules.minutesPerFive<0.5||rules.minutesPerFive>5||rules.minMinutes<1||rules.maxMinutes>90||rules.maxMinutes<rules.minMinutes||!Number.isInteger(rules.longEvery)||rules.longEvery<0||rules.longEvery>12||rules.longMinutes<1||rules.longMinutes>90)throw Error('Choose valid rest durations, with the shortest rest no longer than the longest.')
    }
  }
}
