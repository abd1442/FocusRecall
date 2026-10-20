import type { PauseSpan } from '@core/session'
import type { Db } from '../db/database'

/** Intervals keep one canonical row/event, even when a divider crosses them.
 * Consumers intersect their timestamps with the requested part; ownership is
 * an anchor for editing, not the extent of the interval.
 */
export function sessionPauses(db:Db,blockId:number):PauseSpan[] {
  const rows=db.prepare(`SELECT p.started_at,p.ended_at FROM block_pauses p
    WHERE p.block_id IN (SELECT id FROM blocks WHERE session_id=(SELECT session_id FROM blocks WHERE id=?))
       OR p.block_id=? ORDER BY p.started_at`).all(blockId,blockId) as {started_at:string;ended_at:string|null}[]
  return rows.map(p=>({startedAt:p.started_at,endedAt:p.ended_at}))
}

export function clipPauses(pauses:PauseSpan[],start:string,end:string|null):PauseSpan[] {
  const from=Date.parse(start),to=end?Date.parse(end):Infinity
  return pauses.flatMap(p=>{
    const s=Math.max(from,Date.parse(p.startedAt)),e=Math.min(to,p.endedAt?Date.parse(p.endedAt):Infinity)
    return e>s?[{startedAt:new Date(s).toISOString(),endedAt:Number.isFinite(e)?new Date(e).toISOString():null}]:[]
  })
}

/** Deleting an anchor part must not cascade away interval portions still
 * belonging to another surviving part of the same session. Caller transacts.
 */
export function preserveCrossingIntervals(db:Db,blockId:number):void {
  const parts=db.prepare(`SELECT id,focus_started_at,focus_ended_at FROM blocks WHERE session_id=(SELECT session_id FROM blocks WHERE id=?) AND id<>? AND focus_ended_at IS NOT NULL ORDER BY focus_started_at`).all(blockId,blockId) as {id:number;focus_started_at:string;focus_ended_at:string}[]
  for(const table of ['block_pauses','distractions','window_activity']){
    const rows=db.prepare(`SELECT * FROM ${table} WHERE block_id=? ${table==='window_activity'?"AND stage='focus'":''}`).all(blockId) as Record<string,unknown>[]
    for(const row of rows){
      if(!row.started_at)continue
      const start=Date.parse(row.started_at as string),end=table==='distractions'?start+(row.duration_seconds as number)*1000:row.ended_at?Date.parse(row.ended_at as string):Infinity
      const hits=parts.flatMap(p=>{const s=Math.max(start,Date.parse(p.focus_started_at)),e=Math.min(end,Date.parse(p.focus_ended_at));return e>s?[{id:p.id,start:s,end:e}]:[]})
      if(!hits.length)continue
      const s=hits[0].start,e=hits[hits.length-1].end
      if(table==='distractions')db.prepare('UPDATE distractions SET block_id=?,started_at=?,duration_seconds=? WHERE id=?').run(hits[0].id,new Date(s).toISOString(),(e-s)/1000,row.id)
      else db.prepare(`UPDATE ${table} SET block_id=?,started_at=?,ended_at=? WHERE id=?`).run(hits[0].id,new Date(s).toISOString(),new Date(e).toISOString(),row.id)
    }
  }
}
