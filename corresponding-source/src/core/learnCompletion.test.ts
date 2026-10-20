import { describe,it,expect } from 'vitest'
import { LEARN_LESSONS,normalizeLearn,updateLearn } from './learn'
import { expansionText,EXPANSION_SOURCES } from './learnExpansion'
import { STRATEGY_VISUALS } from './strategyVisuals'
const now=Date.UTC(2026,9,17,12),day='2026-10-17'
const additions=['forgetting','motivation','targeted','pressure','methods'] as const
const additionIds=new Set<string>(additions)
describe('content completion preserves the beta.25 library',()=>{
 it('migrates all beta.25 bookmarks and records while retaining daily context',()=>{
  let prior=normalizeLearn(null,now)
  const old=LEARN_LESSONS.filter(l=>!additionIds.has(l.id));expect(old).toHaveLength(22)
  for(const {id} of old){prior=updateLearn(prior,{type:'view',id},day,now);prior=updateLearn(prior,{type:'save',id:'lesson:'+id},day,now)}
  for(const id of Object.keys(STRATEGY_VISUALS))prior=updateLearn(prior,{type:'save',id:'concept:'+id},day,now)
  prior=updateLearn(prior,{type:'today'},day,now)
  expect(normalizeLearn({...prior,version:4},now)).toEqual({...prior,version:5})
  for(const id of additions)prior=updateLearn(prior,{type:'view',id},day,now)
  expect(prior.saved).toHaveLength(46)
  expect(prior.lessons.forgetting).toMatchObject({checks:0,activityAt:0,completedAt:0,draft:[]})
 })
 it('retains the important qualifications instead of turning illustrations into evidence',()=>{
  expect(expansionText('forgetting','en').detail).toContain('several explanations')
  expect(expansionText('motivation','en').detail).toContain('associative')
  expect(expansionText('targeted','en').detail).toContain('overlearning is not always useless')
  expect(expansionText('pressure','en').detail).toContain('does not validate this checklist as treatment')
  expect(expansionText('methods','en').detail).toContain('some findings are mixed')
  expect(EXPANSION_SOURCES.methods.some(s=>s.citation.includes('2024'))).toBe(true)
 })
})
