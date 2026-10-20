import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase, type Db } from '../main/db/database'
import { LibraryRepo } from '../main/repos/library'
import { BlocksRepo } from '../main/repos/blocks'
import { LogRepo } from '../main/repos/logs'
import { NotesService } from '../main/notes'
import { SettingsRepo } from '../main/repos/settings'
import { EMPTY_DESTINATION, type NoteInput } from './notes'
vi.mock('electron',()=>({clipboard:{},ClipboardItem:class {}}))
let db:Db,library:LibraryRepo,blocks:BlocksRepo
beforeEach(()=>{
 db=openDatabase(':memory:');library=new LibraryRepo(db);blocks=new BlocksRepo(db,new LogRepo(db))
 db.exec(`INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'QA','#123456',0,'2026-10-15');
 INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'A','#123456','pages','2026-10-15'),(101,100,'B','#123456','pages','2026-10-15');
 INSERT INTO sittings(id,started_at) VALUES(100,'2026-10-15T08:00:00Z');
 INSERT INTO sessions(id,sitting_id,started_at,ended_at) VALUES(100,100,'2026-10-15T08:00:00Z','2026-10-15T08:10:00Z');
 INSERT INTO blocks(id,sitting_id,session_id,item_id,timer_mode,target_seconds,focus_started_at,focus_ended_at,focus_seconds,last_heartbeat_at) VALUES(100,100,100,100,'flow',600,'2026-10-15T08:00:00Z','2026-10-15T08:10:00Z',600,'2026-10-15T08:10:00Z');`)
})
afterEach(()=>db.close())
const note=(patch:Partial<NoteInput>={}):NoteInput=>({id:'release-note',itemId:100,blockId:100,title:'Recall',text:'Fictional recall',strokes:[],image:null,destination:{...EMPTY_DESTINATION},...patch})
it('moves only block-owned notes atomically with a historical subject correction',async()=>{
 const notes=new NotesService(db,new SettingsRepo(db));await notes.save(note(),false);await notes.save(note({id:'subject-note',blockId:null}),false)
 blocks.updateBlock(100,{itemId:101});expect(notes.list(101,100).map(n=>n.id)).toEqual(['release-note']);expect(notes.list(100).map(n=>n.id)).toEqual(['subject-note'])
 expect(()=>blocks.updateBlock(100,{itemId:999999})).toThrow();expect(notes.list(101,100)).toHaveLength(1)
})
it.each(['invalid','Infinity','2026-10-15T99:00:00Z'])('rejects invalid history timestamp %s without partially changing records',value=>{
 expect(()=>blocks.updateBlock(100,{itemId:101,recallText:'should roll back',focusStartedAt:value})).toThrow()
 expect(db.prepare('SELECT item_id,recall_text,focus_seconds FROM blocks WHERE id=100').get()).toEqual({item_id:100,recall_text:null,focus_seconds:600})
})
it('rolls back both subject edits and learning links when a dependency fails',()=>{
 const original=library.getItem(100)
 expect(()=>library.updateItem(100,{...original,name:'Should roll back',buildsOn:[101,999999]})).toThrow()
 expect(library.getItem(100)).toEqual(original)
 expect(()=>library.createItem({...original,name:'Failed creation',buildsOn:[999999]})).toThrow()
 expect(library.listItems({includeArchived:true})).toHaveLength(2)
})
it('clears the active external link and its block link on a locally saved destination change',async()=>{
 const notes=new NotesService(db,new SettingsRepo(db),fetch,async()=> 'obsidian://open?vault=QA&file=Old')
 const input=note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:'out/qa-temp/fictional-vault',file:'Old.md'}})
 const sent=await notes.save(input,true);expect(sent.link).toContain('Old')
 const local=await notes.save({...input,destination:{...input.destination,file:'New.md'}},false)
 expect(local.link).toBeNull();expect(local.status).toBe('local');expect(db.prepare('SELECT notes_link FROM blocks WHERE id=100').get()).toEqual({notes_link:null})
})
it('does not erase a block link supplied by another note when clearing an old note destination',async()=>{
 const notes=new NotesService(db,new SettingsRepo(db),fetch,async()=> 'obsidian://open?file=Old')
 const input=note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:'out/qa-temp/fictional-vault',file:'Old.md'}});await notes.save(input,true)
 db.prepare("UPDATE blocks SET notes_link='obsidian://open?file=Other' WHERE id=100").run()
 await notes.save({...input,destination:{...EMPTY_DESTINATION}},false)
 expect(db.prepare('SELECT notes_link FROM blocks WHERE id=100').get()).toEqual({notes_link:'obsidian://open?file=Other'})
})
