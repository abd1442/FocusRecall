import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { LEGACY_LESSONS, LEARN_LESSONS, LEARN_POLICY, LEARN_INTRO_ORDER, learnRefreshDelay, normalizeLearn, updateLearn, readyRevisit, validLearnDraft } from './learn'
import { lessonText } from './learnText'
import copy from './learnCopy.json'
import { ADVICE_CATALOG, adviceConcept, ADVICE_SOURCES } from './adviceCatalog'
import { LANGUAGES } from './localization'
import { roleCanInvoke } from './desktopSecurity'
import { validateIpcArgs } from './ipcValidation'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
const now=Date.UTC(2026,9,16,12),day='2026-10-16',DAY=86400000
describe('original offline Learn curriculum',()=>{
 it('has eight complementary lessons, stable concepts and claim-linked sources',()=>{
   expect(LEGACY_LESSONS).toHaveLength(8);expect(new Set(LEGACY_LESSONS.map(l=>l.kind)).size).toBe(8)
   expect(Object.keys(copy).sort()).toEqual(LEGACY_LESSONS.map(l=>l.id).sort())
   for(const l of LEARN_LESSONS)for(const id of [l.concept,...l.related]){const c=adviceConcept(id);expect(c).toBeTruthy();for(const key of c!.sources)expect(ADVICE_SOURCES[key as keyof typeof ADVICE_SOURCES].url).toMatch(/^https:\/\/doi\.org\//)}
 })
 for(const language of LANGUAGES)it('has complete equivalent teaching fields in '+language.id,()=>{
   for(const l of LEGACY_LESSONS){
     expect(Object.keys(copy[l.id]).sort()).toEqual(LANGUAGES.map(l=>l.id).sort())
     const c=lessonText(l.id,language.id),en=lessonText(l.id,'en')
     expect(Object.keys(c).sort()).toEqual(Object.keys(en).sort())
     // Chinese conveys an entire natural title in fewer characters. Check
     // field presence/equivalence, not an English-derived minimum word length.
     for(const field of ['title','objective','intro','instruction','explanation','question','options','feedback','revisit'] as const){expect(c[field].trim().length).toBeGreaterThan(field==='title'?3:12);expect(c[field]).not.toMatch(/TODO|TBD|placeholder/);if(language.id!=='en')expect(c[field]).not.toEqual(en[field])}
     expect(c.options.split('¦')).toHaveLength(3)
     if(c.items)expect(c.items.split('¦').length).toBe(en.items!.split('¦').length)
     if(c.panels)expect(c.panels.split('¦').length).toBe(en.panels!.split('¦').length)
     if(language.id==='ar')expect(c.explanation).toMatch(/[\u0600-\u06ff]/)
   }
 })
 it('keeps qualifications and transfer boundaries in the English source',()=>{
   expect(lessonText('spacing','en').feedback).toContain('no arrangement here calculates an optimal schedule')
   expect(lessonText('examples','en').explanation).toContain('supervision and real practice')
   expect(lessonText('mix','en').feedback).toContain('task-dependent')
   expect(lessonText('reflect','en').feedback).toContain('separate from personal Stats')
   expect(lessonText('familiarity','en').feedback).toContain('not a memory diagnosis')
 })
})
describe('bounded, distinct local learning activity',()=>{
 it('starts without any study history and keeps the daily idea stable',()=>{
   const s=updateLearn(null,{type:'today'},day,now);expect(s.today.id).toBe('familiarity');expect(s.lessons).toEqual({})
   expect(updateLearn(s,{type:'today'},day,now+1000)).toEqual(s)
 })
 it('cycles exhausted ideas without cooldown dead ends or immediate repeats',()=>{
   let s=normalizeLearn(null,now);const ids:string[]=[]
   for(let i=0;i<LEARN_LESSONS.length;i++){s=updateLearn(s,{type:i?'another':'today'},day,now+i);ids.push(s.today.id!)}
   expect(new Set(ids).size).toBe(LEARN_LESSONS.length)
   const next=updateLearn(s,{type:'another'},day,now+100)
   expect(next.today.id).toBe(ids[0]);expect(next.today.revisiting).toBe(true)
   expect(updateLearn(s,{type:'today'},'2026-10-17',now+DAY).today.id).toBeTruthy()
   expect(updateLearn(s,{type:'today'},'2026-10-30',now+14*DAY).today.id).toBeTruthy()
 })
 it('introduces foundational ideas first and distinguishes shown ideas without inventing completion',()=>{
   let s=normalizeLearn(null,now);const ids:string[]=[]
   for(let i=0;i<LEARN_INTRO_ORDER.length;i++){
     s=updateLearn(s,{type:i?'another':'today'},day,now+i);ids.push(s.today.id!)
     expect(s.today.revisiting).toBe(false)
   }
   expect(ids).toEqual(LEARN_INTRO_ORDER);expect(s.lessons).toEqual({})
 })
 it('repairs persisted empty Today, including all recently exposed or completed lessons',()=>{
   let s=normalizeLearn(null,now)
   for(const l of LEARN_LESSONS){s=updateLearn(s,{type:'activity',id:l.id},day,now);s=updateLearn(s,{type:'complete',id:l.id},day,now)}
   s.exposures=LEARN_LESSONS.map(l=>({id:l.id,day}));s.today={day,id:null,hidden:false,seen:LEARN_LESSONS.map(l=>l.id)}
   const before=structuredClone(s.lessons),repaired=updateLearn(s,{type:'today'},day,now+1)
   expect(repaired.today.id).toBeTruthy();expect(repaired.today.revisiting).toBe(true);expect(repaired.lessons).toEqual(before)
   expect(updateLearn(repaired,{type:'today'},day,now+2)).toEqual(repaired)
 })
 it('keeps ideas available for many study days and repeated same-day cycles across serialization',()=>{
   let s=normalizeLearn(null,now),previous:string|null=null
   for(let d=0;d<90;d++)for(let n=0;n<LEARN_LESSONS.length+3;n++){
     const at=now+d*DAY+n,key=new Date(at).toISOString().slice(0,10)
     s=updateLearn(JSON.parse(JSON.stringify(s)),{type:n?'another':'today'},key,at)
     expect(s.today.id).toBeTruthy();expect(s.today.id).not.toBe(previous);previous=s.today.id
     expect(s.lessons).toEqual({});expect(s.exposures.length).toBeLessThanOrEqual(32)
   }
 })
 it('refreshes at the configured local study boundary and bounds clock-change checks',()=>{
   expect(learnRefreshDelay(new Date(2026,9,19,3,59,59,500),'04:00')).toBe(500)
   expect(learnRefreshDelay(new Date(2026,9,19,4,0,0),'04:00')).toBe(60000)
   expect(learnRefreshDelay(new Date(2026,9,19,23,59,59,500),'00:00')).toBe(500)
 })
 it('hides only the chosen study day and lets the user explicitly explore another idea',()=>{
   const s=updateLearn(null,{type:'today'},day,now),h=updateLearn(s,{type:'hide'},day,now)
   expect(updateLearn(h,{type:'today'},day,now).today.hidden).toBe(true)
   expect(updateLearn(h,{type:'another'},day,now).today.hidden).toBe(false)
 })
 it('distinguishes viewing, activity, check attempts, completion and revisiting',()=>{
   let s=updateLearn(null,{type:'view',id:'spacing'},day,now)
   expect(s.lessons.spacing).toMatchObject({viewedAt:now,activityAt:0,completedAt:0,checks:0,revisitAt:0})
   expect(()=>updateLearn(s,{type:'complete',id:'spacing'},day,now)).toThrow('Explore an activity')
   s=updateLearn(s,{type:'activity',id:'spacing'},day,now)
   s=updateLearn(s,{type:'check',id:'spacing',choice:1},day,now)
   expect(s.lessons.spacing).toMatchObject({checks:1,lastCheck:1,completedAt:0})
   s=updateLearn(s,{type:'complete',id:'spacing'},day,now);s=updateLearn(s,{type:'revisit',id:'spacing'},day,now+1)
   expect(s.lessons.spacing).toMatchObject({completedAt:now,revisitCount:1,revisitAt:now+1})
   expect(Object.keys(s)).not.toContain('mastery')
 })
 it('offers one optional revisit with no overdue debt and supports pause',()=>{
   let s=updateLearn(null,{type:'activity',id:'retrieve'},day,now)
   expect(readyRevisit(s,now+90*DAY)).toBeNull()
   s=updateLearn(s,{type:'remind',id:'retrieve'},day,now)
   expect(readyRevisit(s,now+DAY)).toBeNull();expect(readyRevisit(s,now+2*DAY)).toBe('retrieve')
   s=updateLearn(s,{type:'revisit',id:'retrieve'},'2026-10-18',now+2*DAY)
   expect(readyRevisit(s,now+8*DAY)).toBeNull();expect(readyRevisit(s,now+9*DAY)).toBe('retrieve')
   s=updateLearn(s,{type:'remind',id:'retrieve'},'2026-10-25',now+9*DAY);expect(readyRevisit(s,now+500*DAY)).toBeNull()
   expect(LEARN_POLICY.revisitDays).toEqual([2,7,21,60])
 })
 it('stores lesson and concept bookmarks independently, with toggle semantics',()=>{
   let s=updateLearn(null,{type:'save',id:'lesson:retrieve'},day,now)
   s=updateLearn(s,{type:'save',id:'concept:cue-ladder'},day,now)
   expect(s.saved).toEqual(['lesson:retrieve','concept:cue-ladder'])
   s=updateLearn(s,{type:'save',id:'lesson:retrieve'},day,now);expect(s.saved).toEqual(['concept:cue-ladder'])
   expect(()=>updateLearn(s,{type:'save',id:'private subject'},day,now)).toThrow('Unknown Learn content')
 })
 it.each([
   ['familiarity',[1,2,0,1],[1,2,2]],['spacing',[0,3,7,12,1],[0,3,20,12,1]],['explain',[1],[3]],['examples',[2,1,0],[3,1,0]],['retrieve',[3,1,0],[4,1,0]],['feedback',[2,1,0],[2,5,0]],['mix',[1,1,1],[2,1,0]],['reflect',[2,0,1],[0,0]]
 ] as const)('validates the fixed interaction shape for %s',(id,good,bad)=>{
   expect(validLearnDraft(id,[...good])).toBe(true);expect(validLearnDraft(id,[...bad])).toBe(false)
   const s=updateLearn(null,{type:'draft',id,values:[...good]},day,now)
   expect(normalizeLearn(JSON.parse(JSON.stringify(s)),now).lessons[id]?.draft).toEqual(good)
   expect(()=>updateLearn(s,{type:'draft',id,values:[...bad]},day,now)).toThrow('Invalid Learn activity')
 })
 it('repairs malformed, oversized or unknown records without retaining arbitrary text',()=>{
   const raw={version:1,notes:'PRIVATE',saved:Array(1000).fill('lesson:retrieve'),lessons:{retrieve:{viewedAt:now+DAY,checks:Infinity,draft:[99],text:'PRIVATE'},missing:{text:'PRIVATE'}},exposures:Array(1000).fill({id:'retrieve',day}),today:{id:'missing',day:'2026-02-31',seen:['unknown']}}
   const s=normalizeLearn(raw,now);expect(s.saved).toEqual(['lesson:retrieve']);expect(s.exposures).toHaveLength(32);expect(s.lessons.retrieve).toMatchObject({viewedAt:0,checks:0,draft:[]});expect(s.today.day).toBe('');expect(JSON.stringify(s)).not.toContain('PRIVATE')
   expect(()=>normalizeLearn({version:6},now)).toThrow('newer version')
   expect(()=>updateLearn({version:6},{type:'reset'},day,now)).toThrow('newer version')
 })
 it('rejects invalid dates and impossible choices without mutating the supplied state',()=>{
   const s=normalizeLearn(null,now),snapshot=JSON.stringify(s)
   expect(()=>updateLearn(s,{type:'check',id:'retrieve',choice:8},day,now)).toThrow('Invalid Learn choice')
   expect(()=>updateLearn(s,{type:'today'},'2026-02-31',now)).toThrow('Invalid Learn study day')
   expect(JSON.stringify(s)).toBe(snapshot)
 })
 it('persists to the existing repository and resets only Learn, preserving advice and study preferences',()=>{
   const db=openDatabase(':memory:');try{const repo=new SettingsRepo(db),settings=repo.getAll(),records=db.prepare('SELECT * FROM blocks').all();repo.writeRaw('studyAdvice.v1',{fictional:'unchanged'});const beforeAdvice=repo.readRaw('studyAdvice.v1')
     let s=updateLearn(null,{type:'save',id:'lesson:explain'},day,now);s=updateLearn(s,{type:'draft',id:'explain',values:[1]},day,now);repo.writeRaw('learn.v1',s)
     expect(normalizeLearn(new SettingsRepo(db).readRaw('learn.v1'),now)).toEqual(s)
     repo.writeRaw('learn.v1',updateLearn(s,{type:'reset'},day,now));expect(repo.getAll()).toEqual(settings);expect(repo.readRaw('studyAdvice.v1')).toEqual(beforeAdvice);expect(db.prepare('SELECT * FROM blocks').all()).toEqual(records)
   }finally{db.close()}
 })
 it('keeps even a heavily used fixed curriculum bounded',()=>{
   let s=normalizeLearn(null,now)
   for(const l of LEARN_LESSONS){s=updateLearn(s,{type:'view',id:l.id},day,now);s=updateLearn(s,{type:'activity',id:l.id},day,now);s=updateLearn(s,{type:'save',id:'lesson:'+l.id},day,now)}
   for(const c of ADVICE_CATALOG)s=updateLearn(s,{type:'save',id:'concept:'+c.id},day,now)
   expect(JSON.stringify(s).length).toBeLessThan(10000);expect(s.saved).toHaveLength(LEARN_LESSONS.length+ADVICE_CATALOG.length)
 })
 it('validates IPC actions and denies every helper access to progress',()=>{
   expect(()=>validateIpcArgs('learn:act',[{type:'draft',id:'spacing',values:[0,3,7,12,0]}])).not.toThrow()
   for(const a of [{type:'private',id:'spacing'},{type:'view',id:'unknown'},{type:'draft',id:'spacing',values:['private']},{type:'check',id:'spacing',choice:NaN}])expect(()=>validateIpcArgs('learn:act',[a])).toThrow()
   for(const role of ['panel','reasons','capture'] as const)for(const channel of ['learn:get','learn:act'])expect(roleCanInvoke(role,channel,[])).toBe(false)
 })
 it('has no study mutation, remote dependency or stats evidence consumer',()=>{
   const source=readFileSync('src/core/learn.ts','utf8');expect(source).not.toMatch(/EvidenceResult|statsData|fetch\(|session:start/)
   const ui=readFileSync('src/renderer/src/tabs/Learn.tsx','utf8');expect(ui).not.toMatch(/fetch\(|https:|session:start|setInterval|requestAnimationFrame/)
   expect(readFileSync('src/renderer/src/tabs/learn.css','utf8')).toContain('prefers-reduced-motion')
 })
})
