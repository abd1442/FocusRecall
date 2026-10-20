import { describe,it,expect } from 'vitest'
import { STRATEGY_VISUALS, strategySceneText } from './strategyVisuals'
import copy from './strategyVisualCopy.json'
import { ADVICE_CATALOG } from './adviceCatalog'
import { LANGUAGES } from './localization'
import { isExpansion } from './learnExpansion'
import { LEGACY_LESSONS, LEARN_LESSONS, normalizeLearn, updateLearn } from './learn'
const now=Date.UTC(2026,9,17,12),day='2026-10-17'
describe('strategy illustration coverage and context compatibility',()=>{
 it('covers every canonical strategy exactly and resolves every visual',()=>{
  expect(Object.keys(STRATEGY_VISUALS).sort()).toEqual(ADVICE_CATALOG.map(c=>c.id).sort())
  for(const visual of Object.values(STRATEGY_VISUALS)){
   if(visual.type==='field')expect(isExpansion(visual.id)).toBe(true)
   else if(visual.type==='principle')expect([...LEGACY_LESSONS.map(l=>l.id),'attention','rest']).toContain(visual.id)
   else expect(Object.keys(copy)).toContain(visual.id)
  }
  expect(Object.keys(copy).sort()).toEqual(Object.values(STRATEGY_VISUALS).filter(v=>v.type==='strategy').map(v=>v.id).sort())
 })
 for(const language of LANGUAGES)it('supplies original captions and labels without fallback in '+language.id,()=>{
  // Chinese expresses the same explanation with fewer characters than alphabetic languages.
  for(const id of Object.keys(copy) as (keyof typeof copy)[]){const c=strategySceneText(id,language.id),en=strategySceneText(id,'en');expect(c.labels.split('¦')).toHaveLength(3);expect(c.caption.length).toBeGreaterThan(language.id==='zh-Hans'?15:30);if(language.id!=='en'){expect(c.caption).not.toBe(en.caption);expect(c.labels).not.toBe(en.labels)}}
 })
 it('migrates the prior 21-idea payload without losing bookmarks or history',()=>{
  let old=normalizeLearn(null,now)
  for(const l of LEARN_LESSONS.slice(0,21)){old=updateLearn(old,{type:'view',id:l.id},day,now);old=updateLearn(old,{type:'save',id:'lesson:'+l.id},day,now)}
  const migrated=normalizeLearn({...old,version:3},now)
  expect(migrated).toEqual({...old,version:5})
  const next=updateLearn(migrated,{type:'save',id:'lesson:context'},day,now)
  expect(next.saved).toEqual([...old.saved,'lesson:context']);expect(next.lessons).toEqual(old.lessons)
 })
})
