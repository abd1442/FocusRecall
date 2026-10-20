import { expect,it } from 'vitest'
import { buildDistractionEvidence,distractionSupportLevel,type DistractionDay } from './distractionEvidence'
const day=(i:number,a=3,b=2,secondsA=a*30,secondsB=b*30):DistractionDay=>({day:`2026-10-${String(i+1).padStart(2,'0')}`,reasons:[{label:'Phone',events:a,seconds:secondsA},{label:'Browsing',events:b,seconds:secondsB}]})
it('grades sparse records, single-day bursts, repeated and well-supported leaders separately',()=>{
 expect(distractionSupportLevel(buildDistractionEvidence([day(0,180,9)],'events'))).toBe(0)
 expect(distractionSupportLevel(buildDistractionEvidence(Array.from({length:6},(_,i)=>day(i,2,1)),'events'))).toBe(2)
 const strong=buildDistractionEvidence(Array.from({length:8},(_,i)=>day(i)),'events')
 expect(strong).toMatchObject({events:40,days:8,leader:'Phone',leaderEvents:24,repeated:true,robustToDayRemoval:true})
 expect(distractionSupportLevel(strong)).toBe(3)
})
it('does not treat many sessions on one day as coverage across days',()=>{
 const e=buildDistractionEvidence(Array.from({length:20},()=>day(0)),'events')
 expect(e.events).toBe(100);expect(e.days).toBe(1);expect(distractionSupportLevel(e)).toBe(0)
})
it('caps plentiful but changing leaders at an early pattern',()=>{
 const e=buildDistractionEvidence(Array.from({length:8},(_,i)=>day(i,i<4?4:1,i<4?1:3)),'events')
 expect(e.leader).toBe('Phone');expect(e.earlier.leader).toBe('Phone');expect(e.later.leader).toBe('Browsing');expect(distractionSupportLevel(e)).toBe(1)
})
it('uses the metric actually being ranked, not frequency to validate a time ranking',()=>{
 const input=Array.from({length:8},(_,i)=>day(i,4,3,40,240))
 expect(buildDistractionEvidence(input,'events').leader).toBe('Phone')
 expect(buildDistractionEvidence(input,'minutes').leader).toBe('Browsing')
 expect(distractionSupportLevel(buildDistractionEvidence(input,'minutes'))).toBe(3)
})
it('withholds the highest level if excluding one day removes the leader',()=>{
 const e=buildDistractionEvidence(Array.from({length:8},(_,i)=>day(i,4,3,100,i===0||i===4?340:60)),'minutes')
 expect(e.leader).toBe('Browsing');expect(e.repeated).toBe(true);expect(e.robustToDayRemoval).toBe(false);expect(distractionSupportLevel(e)).toBe(2)
})
it('does not claim a unique ranking for ties or only one eligible reason',()=>{
 expect(distractionSupportLevel(buildDistractionEvidence(Array.from({length:8},(_,i)=>day(i,3,3)),'events'))).toBe(0)
 const one=Array.from({length:8},(_,i)=>({...day(i),reasons:day(i).reasons.slice(0,1)}))
 expect(distractionSupportLevel(buildDistractionEvidence(one,'events'))).toBe(0)
 expect(buildDistractionEvidence([day(0,3,3,0,0)],'minutes').events).toBe(0)
})
