import { expect, it } from 'vitest'
import { personalAnalysis, runStatsAnalysis, type PersonalAnalysisJob } from './statsAnalysis'
import { generatePersonalInsights } from './personalInsights'
import { calibrationFactors, calibrationHistory } from './statisticalCalibration.testSupport'
import { discoveryQuestions } from './evidence'
import { DEFAULT_ANALYSIS, rankFactors } from './insights'

it.each([['null',0,'independent'],['known effect',1.2,'independent'],['serial',0,'serial'],['subject confounding',0,'subject-confounding'],['time confounding',0,'time-confounding'],['missing and untouched',1.2,'independent']] as const)('structured-clone analysis preserves complete accepted evidence for %s fictional histories',(name,effect,scenario)=>{
  const sessions=calibrationHistory(291,90,effect,scenario)
  for(const [i,s]of sessions.entries()){
    if(name==='missing and untouched'){if(i%3===0)delete s.outcomes.focus;if(i%4===0)s.untouchedOutcomes.push('recall')}
    if(i%7===0)s.distractions.push({offsetSeconds:60,durationSeconds:90,startedAt:s.start+60000,source:'manual',kind:'phone',app:null,title:null,confirmed:true,itemId:s.itemId,label:null})
  }
  const job:PersonalAnalysisJob={kind:'personal',sessions,factors:calibrationFactors,options:DEFAULT_ANALYSIS,input:{today:'2026-10-17',all:sessions,sleepFieldKey:'sleep',sleepHours:new Map(sessions.map(s=>[s.day,{value:7,touched:true}]))},activities:new Map([['revision','Fictional revision']]),reasons:new Map([['phone','Fictional phone']])}
  const expected=generatePersonalInsights(sessions,job.factors,job.options,{...job.input,activityLabel:id=>job.activities.get(id)??id,reasonLabel:id=>job.reasons.get(id)??id})
  expect(personalAnalysis(structuredClone(job))).toEqual(expected)
  expect(structuredClone(personalAnalysis(job))).toEqual(expected)
  expect(expected.candidates.some(c=>c.rows.some(r=>r.label==='Fictional phone'))).toBe(true)
})
it('preserves empty histories and unusual user labels without interpreting them as object keys',()=>{
  const job:PersonalAnalysisJob={kind:'personal',sessions:[],factors:[],options:DEFAULT_ANALYSIS,input:{today:'2026-10-17'},activities:new Map([['__proto__','Arabic العربية']]),reasons:new Map()}
  expect(personalAnalysis(structuredClone(job))).toEqual(generatePersonalInsights([],[],DEFAULT_ANALYSIS,job.input))
})

it('worker ranking preserves complete multiple-search correction when only one factor family is displayed',()=>{
  const sessions=calibrationHistory(419,160,1.4),factors=calibrationFactors.slice(0,1)
  const job={kind:'ranking' as const,sessions,factors,questionFactors:calibrationFactors,outcome:'focus' as const,options:DEFAULT_ANALYSIS}
  expect(runStatsAnalysis(structuredClone(job))).toEqual(rankFactors(sessions,factors,'focus',DEFAULT_ANALYSIS,discoveryQuestions(calibrationFactors,sessions)))
})
