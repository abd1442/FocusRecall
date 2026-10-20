import {it,expect} from 'vitest'
import {openDatabase} from '../main/db/database'
import {DistractionRepo} from '../main/repos/distractions'
const setup=()=>{
 const db=openDatabase(':memory:')
 db.exec(`INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Fictional','#123456',0,'2026-10-18');
 INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'Fictional subject','#123456','pages','2026-10-18');
 INSERT INTO sittings(id,started_at) VALUES(100,'2026-10-18');
 INSERT INTO blocks(id,sitting_id,item_id,target_seconds,focus_started_at,focus_ended_at,focus_seconds,recall_text) VALUES(100,100,100,600,'2026-10-18T08:00:00Z','2026-10-18T08:10:00Z',600,'Private study notes stay');
 INSERT INTO window_activity(block_id,stage,started_at,ended_at,process_name,window_title) VALUES(100,'focus','2026-10-18T08:00:00Z','2026-10-18T08:01:00Z','browser','Fictional private message'),(100,'rest','2026-10-18T08:01:00Z','2026-10-18T08:02:00Z','editor','Fictional document');
 INSERT INTO distractions(block_id,at_offset_seconds,duration_seconds,source,kind,app_name,window_title,confirmed) VALUES(100,0,60,'auto','website','browser','Fictional private message',1),(100,70,10,'manual','personal reason',NULL,NULL,1);
 INSERT INTO app_rules(match_type,pattern,classification) VALUES('title','Fictional saved rule','study');`)
 return db
}
it('deletes all title fields only, retaining study data, unrelated fields, confirmations and rules; is idempotent',()=>{
 const db=setup(),repo=new DistractionRepo(db)
 const tables=['blocks','items','sittings','app_rules','settings']
 const before=tables.map(t=>db.prepare('SELECT * FROM '+t).all())
 const activity=db.prepare('SELECT * FROM window_activity').all() as Record<string,unknown>[]
 const distractions=db.prepare('SELECT * FROM distractions').all() as Record<string,unknown>[]
 expect(repo.deleteWindowTitles()).toEqual({activityRows:2,distractionRows:1})
 expect(tables.map(t=>db.prepare('SELECT * FROM '+t).all())).toEqual(before)
 expect(db.prepare('SELECT * FROM window_activity').all()).toEqual(activity.map(r=>({...r,window_title:null})))
 expect(db.prepare('SELECT * FROM distractions').all()).toEqual(distractions.map(r=>({...r,window_title:null})))
 expect(repo.deleteWindowTitles()).toEqual({activityRows:0,distractionRows:0});db.close()
})
it('rolls back both tables if storage fails midway',()=>{
 const db=setup(),repo=new DistractionRepo(db)
 db.exec("CREATE TRIGGER fail_deletion BEFORE UPDATE ON distractions BEGIN SELECT RAISE(ABORT,'fictional disk failure'); END")
 expect(()=>repo.deleteWindowTitles()).toThrow('fictional disk failure')
 expect(db.prepare('SELECT COUNT(*) n FROM window_activity WHERE window_title IS NOT NULL').get()).toEqual({n:2});db.close()
})
