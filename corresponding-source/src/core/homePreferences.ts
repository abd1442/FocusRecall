import { orderSubjects } from './library'

export interface HomeSubjectOrdering { mode: 'recent' | 'alphabetical' | 'most' | 'manual'; ids: number[] }
export const DEFAULT_HOME_ORDER: HomeSubjectOrdering = { mode: 'recent', ids: [] }

/** Calendar date, deliberately independent of the study-day boundary. */
export function localCalendarDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function showTodayCheck(enabled: boolean, skippedDate: string | null, today: string): boolean {
  return enabled && skippedDate !== today
}

export function orderHomeSubjects<T extends {id:number;name:string;pinned:boolean;lastUsedAt:string|null}>(items:T[], preference:HomeSubjectOrdering, seconds:ReadonlyMap<number,number>, language:string):T[] {
  const base=orderSubjects(items)
  if(preference.mode==='recent')return base
  if(preference.mode==='alphabetical') {
    const compare=new Intl.Collator(language,{numeric:true,sensitivity:'base'}).compare
    return base.sort((a,b)=>compare(a.name,b.name))
  }
  if(preference.mode==='most')return base.sort((a,b)=>(seconds.get(b.id)??0)-(seconds.get(a.id)??0))
  const positions=new Map<number,number>()
  preference.ids.forEach(id=>{if(!positions.has(id))positions.set(id,positions.size)})
  return base.sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity))
}

/** Keep archived/temporarily unavailable IDs in their slots when arranging the
 * active list. New subjects append; stale/duplicate IDs cannot duplicate tiles. */
export function mergeHomeOrder(saved:number[], visible:number[]):number[] {
  const active=new Set(visible),unique=[...new Set(saved)],queue=[...new Set(visible)]
  const out=unique.map(id=>active.has(id)?queue.shift()!:id)
  return [...out,...queue]
}
