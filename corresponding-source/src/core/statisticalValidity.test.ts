import { describe, expect, it } from 'vitest'
import { compareEvidence, discoveryQuestions, EVIDENCE_VERSION, screenEvidence } from './evidence'
import { compare, compareFactor, DEFAULT_ANALYSIS, rankFactors } from './insights'
import { buildReport, reportComparisons } from './report'
import { generatePersonalInsights } from './personalInsights'
import { evidenceCopy } from './evidenceCopy'
import { studentCritical, studentTwoSidedP, jackknifeSE } from './statisticalMath'
import { calibrationFactors, calibrationHistory } from './statisticalCalibration.testSupport'
import type { StatSession } from './statsData'

const place=calibrationFactors[0],o=DEFAULT_ANALYSIS
const calculate=(rows:StatSession[])=>compareEvidence(rows,place,'Library','focus',o)
function controlled(n=60):StatSession[] {
  return calibrationHistory(1759,n).map((s,i)=>({...s,itemId:1,itemIds:[1],outcomes:{focus:i%2?2:4},factors:{place:[i%2?'Home':'Library']}}))
}
describe('statistical arithmetic',()=>{
  it.each([[1,12.7062047364],[2,4.3026527297],[5,2.5705818356],[10,2.22813885196],[30,2.0422724563],[100,1.98397151845]])('agrees with published 97.5th Student-t quantiles (df %i)',(df,critical)=>{
    expect(studentCritical(df)).toBeCloseTo(critical,8)
    expect(studentTwoSidedP(critical,df)).toBeCloseTo(.05,9)
  })
  it('handles zero, symmetry, heavy tails and small multiple-search probabilities',()=>{
    expect(studentTwoSidedP(0,3)).toBe(1)
    expect(studentTwoSidedP(5,3)).toBe(studentTwoSidedP(-5,3))
    expect(studentTwoSidedP(5,3)).toBeCloseTo(.0153924380733,10)
    for(const df of [1,2,4,10,100])for(const alpha of [.01,.0001,.000001])expect(studentTwoSidedP(studentCritical(df,alpha),df)).toBeCloseTo(alpha,11)
    expect(jackknifeSE([1,2,3])).toBeCloseTo(Math.sqrt(4/3),12)
    expect(jackknifeSE([1])).toBeNull()
  })
  it('matches hand-calculated weighted context means and block-delete arithmetic',()=>{
    const rows=controlled(),e=calculate(rows)
    expect(e.estimate).toBe(2);expect(e.groups.map(g=>g.mean)).toEqual([4,2])
    expect(e.uncertainty.low).toBe(2);expect(e.uncertainty.high).toBe(2);expect(e.testing.pValue).toBe(0)
    const noisy=calibrationHistory(123,90),r=calculate(noisy)
    // Independent reference: re-evaluate the fixed matched-context mean after
    // removing each calendar week, then apply the jackknife formula directly.
    const contexts=new Set(r.scope.contexts),week=(d:string)=>Math.floor((Date.parse(d+'T00:00:00Z')/86400000+3)/7)
    const retained=noisy.filter(s=>contexts.has(JSON.stringify([s.itemId,s.activity,''])))
    const mean=(ss:StatSession[]):number=>ss.reduce((sum,s)=>sum+s.outcomes.focus!,0)/ss.length
    const point=(ss:StatSession[]):number=>{
      let sum=0,total=0
      for(const context of contexts){const current=ss.filter(s=>JSON.stringify([s.itemId,s.activity,''])===context),days=new Map<string,StatSession[]>()
        for(const s of current){const key=JSON.stringify([s.day,s.factors.place.includes('Library')]),list=days.get(key)??[];list.push(s);days.set(key,list)}
        const a=[...days.values()].filter(xs=>xs[0].factors.place.includes('Library')),b=[...days.values()].filter(xs=>!xs[0].factors.place.includes('Library'))
        if(!a.length||!b.length)continue
        const full=retained.filter(s=>JSON.stringify([s.itemId,s.activity,''])===context),weight=Math.min(new Set(full.filter(s=>s.factors.place.includes('Library')).map(s=>s.day)).size,new Set(full.filter(s=>!s.factors.place.includes('Library')).map(s=>s.day)).size),av=a.reduce((sum,xs)=>sum+mean(xs),0)/a.length,bv=b.reduce((sum,xs)=>sum+mean(xs),0)/b.length
        sum+=weight*(av-bv);total+=weight
      }return sum/total
    }
    const blocks=[...new Set(retained.map(s=>week(s.day)))],replicates=blocks.map(w=>point(retained.filter(s=>week(s.day)!==w))),avg=replicates.reduce((s,v)=>s+v,0)/blocks.length
    const se=Math.sqrt((blocks.length-1)/blocks.length*replicates.reduce((s,v)=>s+(v-avg)**2,0))
    expect(r.uncertainty.standardError).toBeCloseTo(Math.max(se,r.uncertainty.dayVariation!,r.uncertainty.dependenceVariation!),12)
    expect(r.uncertainty.low).toBeCloseTo(r.estimate!-studentCritical(r.uncertainty.degreesOfFreedom)*r.uncertainty.standardError!,12)
  })
})
describe('defensible classification',()=>{
  it('F-STATS-3: date-separated added conditions remain descriptive for an explicit confounding reason',()=>{
    const base=Array.from({length:24},(_,d)=>({...controlled(40)[0],id:d+1,start:Date.UTC(2026,0,1+d),end:Date.UTC(2026,0,1+d)+1800000,day:new Date(Date.UTC(2026,0,1+d)).toISOString().slice(0,10),outcomes:{focus:d%2?3:(d%4?4:5)},factors:{place:[d%2?'Home':'Library']}}))
    const extra=[30,31,32,33].map((d,i)=>({...base[i],id:100+i,itemId:2,itemIds:[2],day:new Date(Date.UTC(2026,0,1+d)).toISOString().slice(0,10),outcomes:{focus:[4,5,3,3][i]},factors:{place:[i<2?'Library':'Home']}}))
    const before=calculate(base),after=calculate([...base,...extra])
    expect(before.status).toBe('descriptive');expect(after.estimate).toBeCloseTo(1.5);expect(after.status).toBe('descriptive');expect(after.uncertainty.dayLow).not.toBeNull();expect(after.uncertainty.blockSupport).toBe(false);expect(after.sensitivityChecks.overlappingDateRanges).toBe(false)
    const interleaved=extra.map((s,i)=>({...s,outcomes:{focus:[4,3,5,3][i]},factors:{place:[i%2?'Home':'Library']}}))
    const longer=Array.from({length:80},(_,d)=>({...base[d%24],id:d+1,day:new Date(Date.UTC(2026,0,1+d)).toISOString().slice(0,10)}))
    const spread=interleaved.map((s,i)=>({...s,id:1000+i,day:new Date(Date.UTC(2026,0,91+Math.floor(i/2)*16+i%2)).toISOString().slice(0,10)}))
    expect(calculate([...longer,...spread]).status).toBe('exploratory')
  })
  it('allows legitimate downgrades when added records contradict the association',()=>{
    const base=controlled(60),more=controlled(180).map(s=>({...s,id:10000+s.id,outcomes:{focus:s.factors.place[0]==='Library'?1:5}}))
    expect(calculate(base).estimate).toBe(2)
    expect(calculate([...base,...more]).estimate).toBeLessThan(0)
  })
  it('keeps densely repeated short histories descriptive rather than manufacturing independent weeks',()=>{
    const short=controlled(10),duplicated=short.flatMap((s,i)=>Array.from({length:50},(_,j)=>({...s,id:i*1000+j})))
    const e=calculate(duplicated)
    expect(e.status).toBe('descriptive');expect(e.uncertainty.low).toBeNull();expect(e.testing.pValue).toBeNull()
    expect(evidenceCopy(e).uncertainty).toContain('descriptive')
  })
  it('reports no difference as inconclusive, without treating it as proof of equivalence',()=>{
    const rows=controlled().map(s=>({...s,outcomes:{focus:3}})),e=calculate(rows)
    expect(e.estimate).toBe(0);expect(e.testing.pValue).toBe(1);expect(e.status).toBe('descriptive')
    const report=buildReport({title:'Fictional',periodLabel:'All',previousLabel:'Prior',sessions:rows,previous:[],factors:[place],options:o,itemName:()=> 'Fictional'})
    expect(report).not.toContain('goes with higher');expect(report).not.toContain('goes with lower');expect(report).toContain('3.0 vs 3.0');expect(report).toContain('Recorded comparison')
  })
  it('does not turn known subject, activity, time separation, missingness or defaults into a promoted finding',()=>{
    const ss=controlled(90)
    expect(calculate(ss.map(s=>({...s,activity:s.factors.place[0]}))).status).toBe('insufficient')
    const separated=ss.map((s,i)=>({...s,factors:{place:[i<ss.length/2?'Library':'Home']}}))
    expect(calculate(separated).status).toBe('descriptive')
    const missing=ss.map((s,i)=>i%4===0?{...s,outcomes:{}}:s),e=calculate(missing)
    expect(e.answerRates.imbalanced).toBe(true);expect(e.status).toBe('descriptive');expect(e.coverage.outcomeAnswered).toBeLessThan(ss.length)
    expect(compareEvidence(ss,place,'Library','focus',{...o,includeUntouched:true}).status).toBe('descriptive')
  })
  it('keeps before/after comparisons descriptive even when their observed change is large',()=>{
    const e=compareEvidence(controlled().map(s=>({...s,factors:{'experiment-period':s.factors.place}})),{...place,key:'experiment-period'},'Library','focus',o)
    expect(e.estimate).toBe(2);expect(e.status).toBe('descriptive');expect(e.permittedActions).not.toContain('plan-comparison')
  })
  it('uses one snapshot budget for automatic rankings, reports and cards',()=>{
    const rows=controlled(90),factors=[place],questions=discoveryQuestions(factors,rows)
    const c=compare(rows,place,'Library','focus'),a=screenEvidence(c.evidence!,questions)
    const rank=rankFactors(rows,factors,'focus'),report=reportComparisons(rows,factors,o),cards=generatePersonalInsights(rows,factors,o,{today:rows.at(-1)!.day}).candidates
    expect(rank.positive[0].evidence).toEqual(a)
    expect(report.find(c=>c.option==='Library'&&c.outcome==='focus')!.evidence).toEqual(a)
    expect(cards.find(c=>c.id==='place:Library:focus')!.sharedEvidence).toEqual(a)
    expect(c.evidence!.testing.questions).toBe(1)
    expect(compareFactor(rows,place,'focus')[0].evidence!.testing.questions).toBe(2)
    expect(discoveryQuestions([...factors,calibrationFactors[1]],rows)).toBeGreaterThan(questions)
  })
  it('does not reduce the automatic budget after selecting a factor family or discarding ineligible tests',()=>{
    const rows=controlled(90),q=discoveryQuestions(calibrationFactors,rows),rank=rankFactors(rows,[place],'focus',o,q)
    expect(rank.positive[0].evidence!.testing.questions).toBe(q)
    expect(discoveryQuestions([{...place,options:[]}],rows)).toBe(176)
  })
  it('has no arbitrary 0.35-point floor and versions saved questions when the method changes',()=>{
    const rows=controlled(120).map(s=>({...s,outcomes:{focus:s.factors.place[0]==='Library'?3.2:3}})),e=calculate(rows)
    expect(e.estimate).toBeCloseTo(.2);expect(e.status).toBe('exploratory');expect(e.algorithmVersion).toBe(EVIDENCE_VERSION);expect(EVIDENCE_VERSION).not.toBe('matched-context-days-v1')
  })
})
describe('seeded calibration regression',()=>{
  it.each([15,30,60,90])('keeps selected null flags low at %i days, including day effects',days=>{
    let selected=0,automatic=0
    for(let r=0;r<120;r++){
      const rows=calibrationHistory(1234567+r*99991+days,days),e=calculate(rows),rank=rankFactors(rows,calibrationFactors,'focus')
      selected+=Number(e.status==='exploratory');automatic+=Number(rank.positive.length+rank.negative.length>0)
    }
    expect(selected/120).toBeLessThanOrEqual(.075);expect(automatic/120).toBeLessThanOrEqual(.05)
  })
  it('handles serially correlated outcomes and week-persistent conditions',()=>{
    let selected=0,automatic=0
    for(let r=0;r<120;r++){
      const rows=calibrationHistory(34567+r*99991,90,0,'serial'),e=compareEvidence(rows,calibrationFactors[1],'Music','focus',o),rank=rankFactors(rows,calibrationFactors,'focus')
      selected+=Number(e.status==='exploratory');automatic+=Number(rank.positive.length+rank.negative.length>0)
    }
    expect(selected/120).toBeLessThanOrEqual(.075);expect(automatic/120).toBeLessThanOrEqual(.05)
  })
  it('detects planted strong and moderate associations without requiring every seed to win',()=>{
    for(const [effect,days,minSelected,minAutomatic] of [[1,180,.95,.6],[.5,365,.8,.3]]){
      let selected=0,automatic=0
      for(let r=0;r<80;r++){
        const rows=calibrationHistory(987654+r*77773+days,days,effect),rank=rankFactors(rows,calibrationFactors,'focus')
        selected+=Number(calculate(rows).status==='exploratory');automatic+=Number(rank.positive.some(c=>c.factor.key==='place'&&c.option==='Library'))
      }
      // These are inclusive minimum power checks, not exact guarantees.
      // Temporal concentration can legitimately reduce automatic-search power.
      expect(selected/80).toBeGreaterThanOrEqual(minSelected);expect(automatic/80).toBeGreaterThanOrEqual(minAutomatic)
    }
  },20000)
})
