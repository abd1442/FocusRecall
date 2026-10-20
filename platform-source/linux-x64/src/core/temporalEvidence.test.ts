import {describe,it,expect} from 'vitest'
import {conditionEpisodes,temporalSupport,type TemporalDay} from './temporalEvidence'
import {compareEvidence,screenEvidence,discoveryQuestions} from './evidence'
import {calibrationHistory,calibrationFactors} from './statisticalCalibration.testSupport'
import {DEFAULT_ANALYSIS} from './insights'
import {evidenceCopy} from './evidenceCopy'
import {translate,type AppLanguage} from './localization'
const day=(i:number)=>new Date(Date.UTC(2023,0,1+i)).toISOString().slice(0,10)
const place=calibrationFactors[0],o=DEFAULT_ANALYSIS
const calculate=(ss:ReturnType<typeof calibrationHistory>)=>compareEvidence(ss,place,'Library','focus',o)
const repeated=(n=180)=>calibrationHistory(359,n).map((s,i)=>({...s,itemId:1,itemIds:[1],outcomes:{focus:i%2?3:4+(i%4===0?.5:0)},factors:{place:[i%2?'Home':'Library']}}))
describe('condition-aware temporal uncertainty',()=>{
 it('does not count missing days or repeated sessions as independent condition switches',()=>{
  const rows=[{day:day(0),side:true,value:3},{day:day(29),side:true,value:4},{day:day(30),side:false,value:2}]
  expect(conditionEpisodes(rows)).toEqual({first:1,other:1,durations:[30,1],effectiveFirst:1,effectiveOther:1})
  expect(conditionEpisodes(rows.flatMap(r=>[r,r,r]))).toEqual(conditionEpisodes(rows))
  expect(temporalSupport(rows).blockDays).toBe(59)
  expect(temporalSupport(rows).supported).toBe(false)
 })
 it('counts mixed-condition days once per side and lengthens blocks for persistent designs',()=>{
  const fast=Array.from({length:180},(_,i)=>[{day:day(i),side:true,value:4},{day:day(i),side:false,value:3}]).flat()
  const slow=Array.from({length:730},(_,i)=>({day:day(i),side:Math.floor(i/28)%2===0,value:3+i%2} satisfies TemporalDay))
  expect(conditionEpisodes(fast).first).toBe(180)
  expect(temporalSupport(fast).blockDays).toBe(14)
  expect(temporalSupport(slow).blockDays).toBe(56)
  expect(temporalSupport(slow).df).toBeLessThan(730/28)
  expect(temporalSupport(slow).supported).toBe(true)
 })
 it('uses only dates and condition assignments to choose support, block scale and degrees of freedom',()=>{
  const a=Array.from({length:365},(_,i)=>({day:day(i),side:Math.floor(i/7)%2===0,value:3}))
  const x=temporalSupport(a),y=temporalSupport(a.map((r,i)=>({...r,value:1+i%5})))
  expect([x.supported,x.blockDays,x.df,x.episodes]).toEqual([y.supported,y.blockDays,y.df,y.episodes])
 })
 it('weights episode duration and caps effective support when a few long bouts dominate',()=>{
  const rows=Array.from({length:138},(_,i)=>({day:day(i),side:i<120||i%2===1,value:3}))
  const t=temporalSupport(rows)
  expect(t.blockDays).toBe(209) // ceil(2*(120² + 18)/138)
  expect(t.episodes.first).toBe(10);expect(t.episodes.other).toBe(9)
  expect(t.episodes.effectiveFirst).toBeCloseTo(129**2/(120**2+9),12)
  expect(t.episodes.effectiveFirst).toBeLessThan(2)
  expect(t.supported).toBe(false)
 })
 it('keeps a supported estimand when four consistent observations enter a sparse new subject',()=>{
  const ss=repeated(),before=calculate(ss)
  const more=ss.slice(0,4).map((s,i)=>({...s,id:90000+i,itemId:3,itemIds:[3],day:day(60+i),outcomes:{focus:i%2?3:5}}))
  const after=calculate([...ss,...more])
  expect(before.testing.pValue).not.toBeNull();expect(after.testing.pValue).toBe(before.testing.pValue)
  expect(after.estimate).toBe(before.estimate);expect(after.uncertainty).toEqual(before.uncertainty)
  expect(after.coverage.unsupportedContexts).toBe(1);expect(after.coverage.temporallyUnsupported).toBe(4)
  expect(after.descriptive.estimate).not.toBe(after.estimate)
  expect(after.descriptive.groups.reduce((n,g)=>n+g.sessions,0)).toBe(ss.length+4)
  expect(evidenceCopy(after).method).toContain('only temporally supported contexts')
  expect(after.dataRevision).not.toBe(before.dataRevision)
 })
 it('discloses all shared observations when no context supports inference; never attaches a subset interval to the full estimate',()=>{
  const e=calculate(repeated(4))
  expect(e.descriptive.groups).toEqual(e.groups);expect(e.uncertainty.low).toBeNull()
  expect(e.testing.pValue).toBeNull();expect(evidenceCopy(e).method).toContain('includes all shared contexts')
 })
 it('still lets sufficiently supported contradictory data change both the estimate and significance',()=>{
  const ss=repeated(),more=repeated().map(s=>({...s,id:s.id+90000,itemId:3,itemIds:[3],outcomes:{focus:s.factors.place[0]==='Library'?2:4}}))
  expect(calculate(ss).status).toBe('exploratory')
  const after=calculate([...ss,...more]);expect(after.coverage.unsupportedContexts).toBe(0)
  expect(after.estimate).toBeLessThan(0);expect(after.testing.pValue).not.toBe(calculate(ss).testing.pValue)
 })
 it('detects a pure calendar trend as a sensitivity failure without erasing the recorded difference',()=>{
  const rows=Array.from({length:365},(_,i)=>({day:day(i),side:(i%30)<20,value:1+i/100}))
  const t=temporalSupport(rows);expect(t.timeAdjusted).toBe(0)
 })
 it('preserves the automatic correction and translates the new scope and temporal disclosures',()=>{
  const rows=repeated(),e=calculate(rows),q=discoveryQuestions([place],rows),a=screenEvidence(e,q)
  expect(a.testing.alpha).toBe(.05/q);expect(a.testing.questions).toBe(q)
  expect(a.uncertainty.standardError).toBe(e.uncertainty.standardError)
  expect(a.uncertainty.high!-a.uncertainty.low!).toBeGreaterThanOrEqual(e.uncertainty.high!-e.uncertainty.low!)
  for(const lang of ['en','ar','es','fr','zh-Hans','pt-BR','de'] as AppLanguage[]){
   const c=evidenceCopy(e,lang);expect(c.uncertainty).not.toMatch(/\{\w+\}/)
   if(lang!=='en'){expect(c.uncertainty).not.toBe(evidenceCopy(e).uncertainty);expect(translate(lang,'Immediate self-rated recall')).not.toBe('Immediate self-rated recall')}
  }
 })
 it('keeps long drifting null histories conservative without eliminating persistent known associations',()=>{
  const template=repeated(1)[0]
  const history=(seed:number,effect:number)=>{
   let state=seed>>>0,mood=0,side=false
   const u=()=>{state=(Math.imul(state,1103515245)+12345)>>>0;return (state+.5)/4294967296}
   const normal=()=>Math.sqrt(-2*Math.log(u()))*Math.cos(2*Math.PI*u())
   return Array.from({length:1095},(_,i)=>{
    mood=.97*mood+.15*normal();if(i%28===0)side=u()<.5
    const start=Date.UTC(2023,0,1+i)
    return {...template,id:i+1,start,end:start+1800000,day:day(i),outcomes:{focus:Math.max(1,Math.min(5,Math.round(3+mood+normal()*.65+effect*Number(side))))},factors:{place:[side?'Library':'Home']}}
   })
  }
  let nullFlags=0,power=0
  for(let seed=1;seed<=60;seed++){
   nullFlags+=Number(calculate(history(seed*179424673,0)).status==='exploratory')
   power+=Number(calculate(history(seed*179424673,1)).status==='exploratory')
  }
  expect(nullFlags).toBeLessThanOrEqual(5);expect(power).toBeGreaterThanOrEqual(48)
 },20000)
})
