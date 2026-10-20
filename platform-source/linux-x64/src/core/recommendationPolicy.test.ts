import { describe,it,expect } from 'vitest'
import { canSuggestTrial,canSuggestFocusComparison,METHOD_OBSERVATION_NOTE,EXPERIMENT_NOTE,FOCUS_COMPARISON_ACTION } from './recommendations'
import {insightTakeaway,insightReliability} from './insightPresentation'
import { policyHistory,methodFactor,environmentFactor } from './recommendationPolicy.testSupport'
import { generatePersonalInsights,preparationSuggestions,studyTimePatterns } from './personalInsights'
import { compare,rankFactors,DEFAULT_ANALYSIS } from './insights'
import { buildReport } from './report'
import { suggestedExperiment } from './discoveries'
import { experimentResults,validateExperiment,weeklyReview } from './studyTools'
import { displayInsight,displayOrigin } from './insightLocalization'
import { ADVICE_CATALOG } from './adviceCatalog'
import { adviceText } from './adviceText'
import { LANGUAGES,translate } from './localization'

const today='2026-08-28',options=DEFAULT_ANALYSIS
const analyze=(factor=methodFactor,choice=factor.options[0])=>{const rows=policyHistory(factor,choice);return {rows,...generatePersonalInsights(rows,[factor],options,{today})}}

describe('observation versus recommendation',()=>{
 it.each(['Reading','Re-reading','Highlighting','Self-testing','Flashcards','Worked examples','Explaining aloud','Interleaving'])('keeps a favorable %s observation without prescribing a method',choice=>{
  const f={...methodFactor,options:[choice,'Other']},r=analyze(f,choice),comparison=compare(r.rows,f,choice,'focus')
  expect(comparison.evidence?.status).toBe('exploratory');expect(comparison.diff).toBeGreaterThan(2)
  expect(rankFactors(r.rows,[f],'focus').positive.some(c=>c.option===choice)).toBe(true)
  const cards=r.candidates.filter(c=>c.factorKey===f.key);expect(cards.length).toBeGreaterThan(0)
  for(const c of cards){expect(c.action).toBeNull();expect(c.trial).toBeUndefined();expect(c.presentation?.methodComparison).toBe(true);expect(c.limitations).toContain(METHOD_OBSERVATION_NOTE);expect(insightTakeaway(c).tone).toBe('neutral');expect(insightReliability(c)).toMatchObject({level:null,label:'Recorded comparison'})}
  expect(weeklyReview(r.rows,[f],'2026-08-24',today).working).toBeNull()
 })
 it.each([
  {...methodFactor,label:'My best place'},
  {...environmentFactor,key:'field:300',semanticKey:undefined,label:'Place'},
  {...environmentFactor,key:'sleep-hours',semanticKey:'sleep-hours',group:'day' as const},
  {...environmentFactor,key:'medication',semanticKey:undefined,label:'Study aid'},
  {...environmentFactor,key:'activity',semanticKey:'activity',group:'detail' as const}
 ])('never guesses a safe action from a custom, renamed, health or activity label ($key)',factor=>{
  expect(canSuggestTrial(factor)).toBe(false);expect(analyze(factor).candidates.every(c=>!c.action&&!c.trial)).toBe(true)
 })
 it('offers a neutral focus question for a reversible environment, without promoting recall or duration to learning advice',()=>{
  const r=analyze(environmentFactor),cards=r.candidates.filter(c=>c.factorKey===environmentFactor.key)
  const focus=cards.find(c=>c.outcome==='focus')!;expect(focus.trial).toBeDefined();expect(focus.action).toContain('question to explore');expect(focus.action).not.toMatch(/^Try /)
  expect(cards.find(c=>c.outcome==='recall')?.trial).toBeUndefined();expect(cards.find(c=>c.outcome==='recall')?.action).toBeNull()
  expect(canSuggestFocusComparison(environmentFactor,'length')).toBe(false)
  expect(canSuggestFocusComparison(environmentFactor,'understanding')).toBe(false)
  const weekly=weeklyReview(r.rows,[environmentFactor],'2026-08-24',today);expect(weekly.finding).toBeNull();expect(weekly.working?.outcome).toBe('focus')
 })
 it('does not prescribe from defaults or missing answers',()=>{
  const rows=policyHistory(environmentFactor).map(s=>({...s,untouchedOutcomes:['focus','recall'] as typeof s.untouchedOutcomes}))
  expect(generatePersonalInsights(rows,[environmentFactor],options,{today}).candidates.every(c=>!c.trial)).toBe(true)
  expect(generatePersonalInsights(rows.map(s=>({...s,outcomes:{}})),[environmentFactor],options,{today}).cards.every(c=>!c.action)).toBe(true)
 })
 it('does not turn low, absent or reversed ratings into a method recommendation',()=>{
  for(const rows of [[],policyHistory().map(s=>({...s,outcomes:{focus:3,recall:3}})),policyHistory().map(s=>({...s,outcomes:{focus:6-s.outcomes.focus!,recall:6-s.outcomes.recall!}}))]){
   expect(generatePersonalInsights(rows,[methodFactor],options,{today}).candidates.every(c=>!c.action&&!c.trial)).toBe(true)
  }
 })
})

describe('all proposal and persistence paths',()=>{
 it('guards replayed method/health/recall origins while keeping user-authored method plans readable and unchanged',()=>{
  const r=analyze(environmentFactor),origin=r.candidates.find(c=>c.trial)!.trial!
  const draft=suggestedExperiment(origin,today,'2026-09-12','2026-08-01','allowed',environmentFactor)
  expect(draft.name).toBe('Compare Library');expect(draft.origin).toBe(origin);expect(validateExperiment(draft)).toBe(draft)
  for(const f of [methodFactor,{...methodFactor,semanticKey:'sleep-hours'}])expect(()=>suggestedExperiment({...origin,factorKey:f.key},today,'2026-09-12','2026-08-01','blocked',f)).toThrow('automatic comparison')
  expect(()=>suggestedExperiment({...origin,outcome:'recall'},today,'2026-09-12','2026-08-01','blocked',environmentFactor)).toThrow('automatic comparison')
  const manual={...draft,name:'My re-reading question',change:'Re-reading',origin:undefined,outcome:'recall' as const},before=structuredClone(manual)
  expect(validateExperiment(manual)).toBe(manual);expect(experimentResults(policyHistory(),manual,today).status).toBe('Change not verified');expect(manual).toEqual(before)
 })
 it('keeps old saved wording in storage, while the current origin summary is neutral even in English',()=>{
  const origin={...analyze(environmentFactor).candidates.find(c=>c.trial)!.trial!,title:'Try Re-reading',factorKey:methodFactor.key},snapshot=structuredClone(origin)
  for(const {id} of LANGUAGES){const shown=displayOrigin(origin,{groups:[],fields:[]},id);expect(shown.title).not.toContain('Try Re-reading');expect(origin).toEqual(snapshot)}
 })
 it('does not export method recommendations even from an injected older actionable card',()=>{
  const r=analyze(),card=r.candidates.find(c=>c.outcome==='focus')!,origin=analyze(environmentFactor).candidates.find(c=>c.trial)!.trial!
  const legacy={...card,action:'Try Re-reading',trial:{...origin,factorKey:methodFactor.key}}
  const report=buildReport({title:'Fictional',periodLabel:'All',previousLabel:'Prior',sessions:r.rows,previous:[],factors:[methodFactor],options,itemName:()=> 'Fictional',personalInsights:[legacy]})
  expect(report).not.toContain('Try Re-reading');expect(report).toContain('Re-reading');expect(report).toContain(METHOD_OBSERVATION_NOTE)
 })
 it('retains the inactive compatibility APIs without accessing or searching supplied histories',()=>{
  const poison=new Proxy([],{get(){throw Error('Retired search accessed data')}})
  expect(studyTimePatterns(poison,today)).toEqual([]);expect(preparationSuggestions(poison,poison,1,'problems',today)).toEqual([])
 })
 it('keeps the 24 canonical strategies and their qualifications separate from ratings in all languages',()=>{
  expect(ADVICE_CATALOG).toHaveLength(24)
  for(const {id} of LANGUAGES){
   for(const key of [METHOD_OBSERVATION_NOTE,FOCUS_COMPARISON_ACTION,EXPERIMENT_NOTE,'Study methods used','Re-reading','Self-testing','Highlighting','Flashcards','Practice problems']){const text=translate(id,key,{option:'Private α'});if(id!=='en')expect(text).not.toBe(key);expect(text).not.toMatch(/\{option\}/)}
   const card=analyze().candidates.find(c=>c.outcome==='focus')!,shown=displayInsight(card,{groups:[],fields:[]},id);expect(shown.limitations).toContain(translate(id,METHOD_OBSERVATION_NOTE));expect(shown.action).toBeNull()
   expect(adviceText('delayed-check',id).detail).toBeTruthy();expect(adviceText('worked-example',id).detail).toBeTruthy()
  }
  expect(adviceText('recall-attempt','en').detail).toContain('can support');expect(adviceText('cue-ladder','en').detail).toContain('instruction and examples');expect(adviceText('delayed-check','en').detail).toContain('do not automatically')
 })
})
