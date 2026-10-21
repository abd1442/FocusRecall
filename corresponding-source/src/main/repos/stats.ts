import { isOwnAppProcess } from '@core/identity'
import type { DistractionSource } from '@core/distractions'
import type { RawBlock, RawDistraction, RawValue, StatsRaw } from '@core/statsData'
import { siteOf } from '@core/tracking'
import type { Db } from '../db/database'
import type { LogRepo } from './logs'

const ms = (iso: string): number => Date.parse(iso)
const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Everything the Stats page analyses, read in one go (a few thousand rows at most). */
export class StatsRepo {
  constructor(
    private db: Db,
    private logs: LogRepo
  ) {}

  raw(): StatsRaw {
    const blockRows = this.db
      .prepare(
        `SELECT b.* FROM blocks b
         WHERE b.focus_ended_at IS NOT NULL AND b.session_id IS NOT NULL
         ORDER BY b.focus_started_at`
      )
      .all() as Record<string, unknown>[]

    const values = new Map<number, RawValue[]>()
    for (const r of this.db.prepare('SELECT block_id, field_id, value, touched FROM block_log_values').all() as {
      block_id: number
      field_id: number
      value: string
      touched: number
    }[]) {
      const list = values.get(r.block_id) ?? []
      list.push({ fieldId: r.field_id, value: parse(r.value), touched: r.touched !== 0 })
      values.set(r.block_id, list)
    }

    const distractions = new Map<number, RawDistraction[]>()
    for (const r of this.db.prepare('SELECT * FROM distractions ORDER BY id').all() as Record<string, unknown>[]) {
      const blockId = r.block_id as number
      const list = distractions.get(blockId) ?? []
      list.push({
          offsetSeconds: r.at_offset_seconds as number,
          durationSeconds: r.duration_seconds as number,
          startedAt: r.started_at ? ms(r.started_at as string) : 0,
          source: r.source as DistractionSource,
          kind: r.kind as string,
          app: (r.app_name as string | null) ?? null,
          title: (r.window_title as string | null) ?? null,
          confirmed: r.confirmed === 1
        })
      distractions.set(blockId, list)
    }

    const marks = new Map<number, { stuck: number; resisted: number }>()
    for (const r of this.db.prepare('SELECT block_id, kind, COUNT(*) AS n FROM session_marks GROUP BY block_id, kind').all() as {
      block_id: number
      kind: 'stuck' | 'resisted'
      n: number
    }[]) {
      const m = marks.get(r.block_id) ?? { stuck: 0, resisted: 0 }
      m[r.kind] = r.n
      marks.set(r.block_id, m)
    }

    // Time per program or site in front during focus, and whether screens were used during the rest.
    const appSeconds = new Map<number, Record<string, number>>()
    const restScreen = new Set<number>()
    const owners=new Map((this.db.prepare('SELECT id,session_id FROM blocks').all() as {id:number;session_id:number|null}[]).map(b=>[b.id,b.session_id]))
    const partsBySession=new Map<number,Record<string,unknown>[]>()
    for(const b of blockRows){const id=b.session_id as number,list=partsBySession.get(id)??[];list.push(b);partsBySession.set(id,list)}
    for (const r of this.db.prepare('SELECT block_id, stage, started_at, ended_at, process_name, window_title FROM window_activity').all() as {
      block_id: number
      stage: 'focus' | 'rest'
      started_at: string
      ended_at: string
      process_name: string | null
      window_title: string | null
    }[]) {
      if (r.stage === 'rest') {
        restScreen.add(r.block_id)
        continue
      }
      if (!r.process_name || (isOwnAppProcess(r.process_name)||/^(electron|lockapp)$/i.test(r.process_name))) continue
      const label = siteOf(r.process_name, r.window_title ?? '').label
      for(const b of partsBySession.get(owners.get(r.block_id)??-1)??[]){
        const seconds=Math.max(0,(Math.min(ms(r.ended_at),ms(b.focus_ended_at as string))-Math.max(ms(r.started_at),ms(b.focus_started_at as string)))/1000)
        if(!seconds)continue
        const id=b.id as number,m=appSeconds.get(id)??{}
        m[label]=(m[label]??0)+seconds;appSeconds.set(id,m)
      }
    }

    const blocks: RawBlock[] = blockRows.map((b) => {
      const id = b.id as number
      return {
        id,
        sessionId: b.session_id as number,
        sittingId: b.sitting_id as number,
        itemId: b.item_id as number,
        start: ms(b.focus_started_at as string),
        end: ms(b.focus_ended_at as string),
        focusSeconds: (b.focus_seconds as number | null) ?? 0,
        targetSeconds: b.target_seconds as number,
        timerMode: b.timer_mode as RawBlock['timerMode'],
        recallRating: (b.recall_rating as number | null) ?? null,
        recallTouched: b.recall_rating_touched !== 0,
        values: values.get(id) ?? [],
        restPlannedSeconds: (b.rest_planned_seconds as number | null) ?? null,
        restActualSeconds: (b.rest_actual_seconds as number | null) ?? null,
        restActivity: (b.rest_activity as string | null) ?? null,
        restSkipped: b.rest_skipped === 1,
        restScreen: restScreen.has(id) || ((b.rest_screen_flags as number) ?? 0) > 0,
        distractions: distractions.get(id) ?? [],
        appSeconds: appSeconds.get(id) ?? {},
        stuck: marks.get(id)?.stuck ?? 0,
        resisted: marks.get(id)?.resisted ?? 0
      }
    })

    const sessions = (this.db.prepare('SELECT * FROM sessions').all() as Record<string, unknown>[]).map((s) => ({
      id: s.id as number,
      sittingId: s.sitting_id as number,
      lostShare: s.lost_share as number,
      distractionCount: s.distraction_count as number,
      distractedSeconds: s.distracted_seconds as number,
      longestStretchSeconds: s.longest_stretch_seconds as number,
      goal: (s.goal as string | null) ?? null,
      goalResult: (s.goal_result as StatsRaw['sessions'][number]['goalResult']) ?? null,
      windowSwitches: (s.window_switches as number) ?? 0
    }))

    const buildsOn = new Map<number, number[]>()
    for (const r of this.db.prepare('SELECT item_id, builds_on FROM item_builds_on').all() as { item_id: number; builds_on: number }[]) {
      const list = buildsOn.get(r.item_id) ?? []
      list.push(r.builds_on)
      buildsOn.set(r.item_id, list)
    }
    const items = (this.db.prepare('SELECT * FROM items').all() as Record<string, unknown>[]).map((i) => ({
      id: i.id as number,
      categoryId: i.category_id as number,
      name: i.name as string,
      color: i.color as string,
      priorKnowledge: (i.prior_knowledge as StatsRaw['items'][number]['priorKnowledge']) ?? null,
      hoursBefore: (i.hours_before as number) ?? 0,
      newField: i.new_field === null || i.new_field === undefined ? null : i.new_field === 1,
      buildsOn: buildsOn.get(i.id as number) ?? []
    }))
    const categories = (this.db.prepare('SELECT id, parent_id, name, color FROM categories').all() as { id: number; parent_id: number | null; name: string; color: string }[]).map(
      (c) => ({ id: c.id, parentId: c.parent_id, name: c.name, color: c.color })
    )

    const dayMap = new Map<string, RawValue[]>()
    for (const r of this.db.prepare('SELECT day, field_id, value, touched FROM day_log_values').all() as { day: string; field_id: number; value: string; touched: number }[]) {
      const list = dayMap.get(r.day) ?? []
      list.push({ fieldId: r.field_id, value: parse(r.value), touched: r.touched !== 0 })
      dayMap.set(r.day, list)
    }

    return {
      blocks,
      sessions,
      items,
      categories,
      schema: this.logs.schema(),
      dayValues: [...dayMap].map(([day, v]) => ({ day, values: v }))
    }
  }
}
