import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ADVICE_CATALOG, ADVICE_SOURCES, adviceConcept, type AdviceSurface } from './adviceCatalog'
import { ADVICE_POLICY, lessAdvice, normalizeAdviceHistory, selectAdvice } from './advice'
import { adviceText } from './adviceText'
import adviceCopy from './adviceCopy.json'
import { LANGUAGES, catalogs } from './localization'
import { validateIpcArgs } from './ipcValidation'
import { roleCanInvoke } from './desktopSecurity'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
const now=Date.UTC(2026,9,16),DAY=86400000

describe('canonical educational content',()=>{
  it('has unique stable concepts and exact seven-language coverage without fallback',()=>{
    expect(new Set(ADVICE_CATALOG.map(c=>c.id)).size).toBe(ADVICE_CATALOG.length)
    expect(Object.keys(adviceCopy).sort()).toEqual(ADVICE_CATALOG.map(c=>c.id).sort())
    for(const concept of ADVICE_CATALOG){
      expect(Object.keys(adviceCopy[concept.id as keyof typeof adviceCopy]).sort()).toEqual(LANGUAGES.map(l=>l.id).sort())
      for(const {id} of LANGUAGES){const text=adviceText(concept.id,id);expect(text.action.length).toBeGreaterThan(10);expect(text.detail.length).toBeGreaterThan(10);expect(text.action+text.detail).not.toMatch(/TODO|TBD|placeholder|\{value/);if(id!=='en')expect(text).not.toEqual(adviceText(concept.id,'en'));if(id==='ar')expect(text.action).toMatch(/[\u0600-\u06ff]/)}
      if(concept.basis!=='practical')expect(concept.sources.length).toBeGreaterThan(0)
      for(const source of concept.sources)expect(ADVICE_SOURCES[source as keyof typeof ADVICE_SOURCES].url).toMatch(/^https:\/\/doi\.org\//)
    }
    expect(()=>adviceText('missing','ar')).toThrow('Missing advice translation')
  })
  it('keeps substantive boundaries visible in all languages',()=>{
    for(const {id} of LANGUAGES){for(const concept of ['worked-example','interleave','rest-recovery','predict-check','delayed-check'])expect(adviceText(concept,id).detail).not.toEqual('');}
    expect(adviceText('rest-recovery','en').detail).toContain('not scientific optima')
    expect(adviceText('predict-check','en').detail).toContain('do not measure retained learning')
    expect(adviceText('interleave','en').detail).toContain('not all')
    expect(adviceText('worked-example','en').detail).toContain('mathematics')
  })
  it('translates the shared advice controls in every added language',()=>{
    for(const language of LANGUAGES.filter(l=>l.id!=='en'))for(const key of ['Study suggestions','Purpose','Less of this topic','Reset study suggestions','Why and when','General study strategies','Research-backed strategy','Depends on the task'])expect(catalogs[language.id as Exclude<typeof language.id,'en'>][key]).toBeTruthy()
  })
})
describe('relevant, bounded, local advice rotation',()=>{
  it('selects only a suitable surface and explicit purpose',()=>{
    for(const surface of ['prepare','recall','rest','return','stats'] as AdviceSurface[])for(const intent of ['any','understand','practice','remember'] as const){const {id}=selectAdvice(null,surface,intent,false,now);expect(id).not.toBeNull();const concept=adviceConcept(id!)!;expect(concept.surfaces).toContain(surface);expect(intent==='any'||concept.intent==='any'||concept.intent===intent).toBe(true)}
  })
  it('does not depend on missing personal evidence or user text',()=>{
    const chosen=selectAdvice(null,'prepare','remember',false,now)
    expect(chosen).toEqual(selectAdvice({notes:'unread private text',rating:5,health:'unknown'},'prepare','remember',false,now))
    expect(chosen.id).toBeTruthy()
  })
  it('keeps a mounted/remounted card stable and does not log duplicate exposures',()=>{
    const first=selectAdvice(null,'recall','any',false,now),remount=selectAdvice(first.history,'recall','any',false,now+100)
    expect(remount.id).toBe(first.id);expect(remount.history.exposures).toHaveLength(1)
  })
  it('shares family cooldowns across screens, even with different wording',()=>{
    const first=selectAdvice(null,'prepare','remember',false,now),second=selectAdvice(first.history,'recall','remember',false,now+1)
    expect(adviceConcept(second.id!)!.topic).not.toBe(adviceConcept(first.id!)!.topic)
  })
  it('can honor an explicit purpose change without letting a topic cooldown hide fresh relevant content',()=>{
    const first=selectAdvice(null,'stats','any',false,now)
    const changed=selectAdvice(first.history,'stats','remember',true,now+1)
    expect(changed.id).not.toBeNull();expect(changed.id).not.toBe(first.id)
    expect(['remember','any']).toContain(adviceConcept(changed.id!)!.intent)
    expect(changed.history.exposures).toHaveLength(2)
  })
  it('allows requested variety but never immediately repeats or ignores hidden topics',()=>{
    let history=normalizeAdviceHistory(null,now);const ids:string[]=[]
    for(let i=0;i<8;i++){const next=selectAdvice(history,'prepare','any',true,now+i);history=next.history;if(next.id)ids.push(next.id)}
    expect(new Set(ids).size).toBe(ids.length)
    history=lessAdvice(history,'recall-attempt',now+20)
    for(let i=0;i<30;i++){const next=selectAdvice(history,'recall','any',true,now+30+i);history=next.history;expect(next.id&&adviceConcept(next.id)?.topic).not.toBe('retrieval')}
  })
  it('returns no invented content when eligible concepts are exhausted or hidden',()=>{
    let h=normalizeAdviceHistory(null,now)
    for(const c of ADVICE_CATALOG)h=lessAdvice(h,c.id,now)
    expect(selectAdvice(h,'recall','any',true,now).id).toBeNull()
    expect(selectAdvice(null,'recall','any',false,now).id).not.toBeNull()
  })
  it('expires cooldowns and ignores corrupt, unknown, stale and future records',()=>{
    const raw={exposures:[null,{id:'missing',at:now},{id:'recall-attempt',at:now+1},{id:'recall-attempt',at:now-ADVICE_POLICY.retention-1},{id:'recall-attempt',at:now-8*DAY}],less:[null,'fake','retrieval','retrieval'],current:{'recall:any':{id:'missing',at:now}}}
    const h=normalizeAdviceHistory(raw,now)
    expect(h.exposures).toHaveLength(1);expect(h.less).toEqual(['retrieval']);expect(h.current).toEqual({})
    expect(normalizeAdviceHistory('malformed',now).exposures).toEqual([])
    expect(selectAdvice({...h,less:[]},'prepare','remember',false,now).id).toBeTruthy()
  })
  it('bounds long histories and persists only canonical IDs/timestamps/topics',()=>{
    const raw={exposures:Array.from({length:10000},(_,i)=>({id:'choose-target',at:now-i,note:'private'}))}
    const h=normalizeAdviceHistory(raw,now);expect(h.exposures).toHaveLength(200);expect(JSON.stringify(h)).not.toContain('private')
    expect(JSON.stringify(h).length).toBeLessThan(15000)
  })
  it('persists across repository reads and resets without changing study records or preferences',()=>{
    const db=openDatabase(':memory:');try{
      const repo=new SettingsRepo(db);repo.writeRaw('unrelated',{note:'fictional'});const before=repo.getAll(),blocks=db.prepare('SELECT * FROM blocks').all()
      const selected=selectAdvice(null,'prepare','any',false,now);repo.writeRaw('studyAdvice.v1',selected.history)
      const read=new SettingsRepo(db);expect(selectAdvice(read.readRaw('studyAdvice.v1'),'prepare','any',false,now+1).id).toBe(selected.id)
      read.writeRaw('studyAdvice.v1',normalizeAdviceHistory(null,now))
      expect(repo.getAll()).toEqual(before);expect(repo.readRaw('unrelated')).toEqual({note:'fictional'});expect(db.prepare('SELECT * FROM blocks').all()).toEqual(blocks)
    }finally{db.close()}
  })
  it('validates IPC and rejects advice requests from unrelated helper windows',()=>{
    expect(()=>validateIpcArgs('advice:choose',['focus','any',false])).toThrow()
    expect(()=>validateIpcArgs('advice:choose',['prepare','health',false])).toThrow()
    expect(()=>validateIpcArgs('advice:choose',['prepare','any',false])).not.toThrow()
    expect(roleCanInvoke('panel','advice:choose',['prepare','any',false])).toBe(true)
    for(const role of ['reasons','capture'] as const)expect(roleCanInvoke(role,'advice:choose',['prepare','any',false])).toBe(false)
  })
  it('never adds unsolicited advice to focus or turns general guidance into personal evidence',()=>{
    expect(readFileSync('src/renderer/src/screens/Focus.tsx','utf8')).not.toContain('AdviceCard')
    expect(readFileSync('src/core/advice.ts','utf8')).not.toMatch(/EvidenceResult|focusRating|recallRating/)
    expect(readFileSync('src/main/ipc.ts','utf8')).toContain("if(session.get().running&&session.get().stage==='focus')return null")
  })
})
