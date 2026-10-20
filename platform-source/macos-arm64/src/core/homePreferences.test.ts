import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_HOME_ORDER, localCalendarDay, mergeHomeOrder, orderHomeSubjects, showTodayCheck } from './homePreferences'
import { orderSubjects } from './library'
import { StudyDayClock } from './dayClock'

const rows=[{id:1,name:'Zulu',pinned:true,lastUsedAt:null},{id:2,name:'Beta',pinned:false,lastUsedAt:'2026-10-17T10:00:00Z'},{id:3,name:'Alpha',pinned:false,lastUsedAt:null}]
describe('Home subject ordering',()=>{
 it('preserves the exact legacy default without mutating subjects',()=>{
  const before=structuredClone(rows)
  expect(orderHomeSubjects(rows,DEFAULT_HOME_ORDER,new Map(),'en')).toEqual(orderSubjects(rows))
  expect(rows).toEqual(before)
 })
 it('sorts names using the selected locale, independent of pins',()=>{
  expect(orderHomeSubjects(rows,{mode:'alphabetical',ids:[]},new Map(),'en').map(i=>i.id)).toEqual([3,2,1])
  const names=['باب','ألف','جيم'].map((name,id)=>({...rows[0],name,id}))
  expect(orderHomeSubjects(names,{mode:'alphabetical',ids:[]},new Map(),'ar').map(i=>i.name)).toEqual(['ألف','باب','جيم'])
 })
 it('uses recorded focused seconds, retaining familiar ties and never inventing study',()=>{
  expect(orderHomeSubjects(rows,{mode:'most',ids:[]},new Map([[2,120],[3,600]]),'en').map(i=>i.id)).toEqual([3,2,1])
  expect(orderHomeSubjects(rows,{mode:'most',ids:[]},new Map(),'en')).toEqual(orderSubjects(rows))
 })
 it('keeps manual order across recency/pin changes, appending new subjects without duplicates',()=>{
  const pref={mode:'manual',ids:[3,999,3,1]} as const
  expect(orderHomeSubjects(rows,{mode:pref.mode,ids:[...pref.ids]},new Map(),'en').map(i=>i.id)).toEqual([3,1,2])
  expect(mergeHomeOrder([1,44,2,1],[2,1,3])).toEqual([2,44,1,3])
  expect(mergeHomeOrder([],[3,2,1])).toEqual([3,2,1])
  expect(mergeHomeOrder([44,99],[])).toEqual([44,99])
 })
})
describe('Today Check visibility',()=>{
 it('defaults visible, makes permanent hide authoritative, and never changes historical answers',()=>{
  expect(showTodayCheck(true,null,'2026-10-18')).toBe(true)
  expect(showTodayCheck(true,'2026-10-18','2026-10-18')).toBe(false)
  expect(showTodayCheck(false,'2026-10-18','2026-10-19')).toBe(false)
  expect(showTodayCheck(true,'2026-10-18','2026-10-19')).toBe(true)
 })
 it('uses local midnight rather than a four-AM study boundary, including year rollover',()=>{
  expect(localCalendarDay(new Date(2026,0,1,0,1))).toBe('2026-01-01')
  expect(localCalendarDay(new Date(2026,9,18,0,1))).toBe('2026-10-18')
  expect(localCalendarDay(new Date(2026,9,17,23,59))).toBe('2026-10-17')
 })
 it('rechecks at local midnight and after a missed timer or clock change',()=>{
  vi.useFakeTimers()
  try {
   let now=new Date(2026,9,17,23,59,59,999)
   const changed=vi.fn(),clock=new StudyDayClock(()=> '00:00',changed,()=>now)
   clock.recheck();expect(changed).toHaveBeenLastCalledWith('2026-10-17')
   now=new Date(2026,9,18,0,0);vi.advanceTimersByTime(2);expect(changed).toHaveBeenLastCalledWith('2026-10-18')
   now=new Date(2026,9,20,2);clock.recheck();expect(changed).toHaveBeenLastCalledWith('2026-10-20')
   clock.stop();expect(vi.getTimerCount()).toBe(0)
  } finally {vi.useRealTimers()}
 })
})
