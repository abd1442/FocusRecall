import { describe,it,expect } from 'vitest'
import { LEARN_LESSONS, LEGACY_LESSONS, normalizeLearn, updateLearn, validLearnDraft } from './learn'
import { EXPANDED_LESSONS, EXPANSION_SOURCES, expansionText } from './learnExpansion'
import { ADVICE_CATALOG } from './adviceCatalog'
import { LANGUAGES } from './localization'
import { validateIpcArgs } from './ipcValidation'
const now=Date.UTC(2026,9,17,12),day='2026-10-17'
describe('visual field guide expansion and compatibility',()=>{
 it.each([1,2,3,4])('migrates Learn version %s without changing old activity or bookmark meanings',version=>{
  let prior=updateLearn(null,{type:'draft',id:'spacing',values:[0,3,7,12,1]},day,now)
  prior=updateLearn(prior,{type:'save',id:'concept:spacing-return'},day,now)
  const migrated=normalizeLearn({...prior,version},now)
  expect(migrated.version).toBe(5);expect(migrated.lessons).toEqual(prior.lessons);expect(migrated.saved).toEqual(prior.saved)
  expect(()=>normalizeLearn({...prior,version:6})).toThrow('newer version')
 })
 it('preserves the complete sixteen-idea state and expands it without losing earlier records',()=>{
  const oldIds=LEARN_LESSONS.slice(0,16).map(l=>l.id)
  let prior=normalizeLearn(null,now)
  for(const id of oldIds){prior=updateLearn(prior,{type:'view',id},day,now);prior=updateLearn(prior,{type:'save',id:'lesson:'+id},day,now)}
  const migrated=normalizeLearn(JSON.parse(JSON.stringify({...prior,version:2})),now)
  expect(migrated).toEqual({...prior,version:5})
  const next=updateLearn(migrated,{type:'save',id:'lesson:exam'},day,now)
  expect(next.saved).toEqual([...prior.saved,'lesson:exam']);expect(next.lessons).toEqual(prior.lessons)
  expect(()=>updateLearn({...next,version:6},{type:'save',id:'lesson:exam'},day,now)).toThrow('newer version')
 })
 it('saves every visual and every canonical strategy through repeated normalization',()=>{
  let s=normalizeLearn(null,now)
  const ids=[...LEARN_LESSONS.map(l=>'lesson:'+l.id),...ADVICE_CATALOG.map(c=>'concept:'+c.id)]
  for(const id of ids)s=updateLearn(s,{type:'save',id},day,now)
  expect(normalizeLearn(JSON.parse(JSON.stringify(s)),now).saved).toEqual(ids);expect(ids).toHaveLength(51)
  expect(LEGACY_LESSONS).toHaveLength(8)
 })
 it('never manufactures assessment activity from opening an expanded idea',()=>{
  for(const l of EXPANDED_LESSONS){const s=updateLearn(null,{type:'view',id:l.id},day,now);expect(s.lessons[l.id]).toMatchObject({viewedAt:now,activityAt:0,completedAt:0,checks:0,draft:[]});expect(validLearnDraft(l.id,[0,0,0])).toBe(false);expect(()=>validateIpcArgs('learn:act',[{type:'view',id:l.id}])).not.toThrow()}
 })
 for(const language of LANGUAGES)it('has equivalent original copy and labels in '+language.id,()=>{
  for(const l of EXPANDED_LESSONS){const c=expansionText(l.id,language.id),en=expansionText(l.id,'en');expect(Object.keys(c).sort()).toEqual(Object.keys(en).sort());for(const field of ['title','caption','action','detail','labels'] as const){expect(c[field].trim().length).toBeGreaterThan(3);if(language.id!=='en')expect(c[field]).not.toEqual(en[field])}expect(c.labels.split('¦')).toHaveLength(en.labels.split('¦').length);expect(EXPANSION_SOURCES[l.id].length).toBeGreaterThan(0)}
 })
})
