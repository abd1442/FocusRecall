// One log for a whole session: the quick questions per subject, the study
// setup and "More detail" once, turned into answers for every part.
import { fieldsIn,isEmptyValue,fieldByKey, type GroupNotes, type LogSchema, type LogValues } from './logfields'
import type { SessionSubject } from './session'
import type { Id } from './types'

export interface SessionLogDraft { perSubject:Record<number,LogAnswers>; shared:LogAnswers }

export interface LogAnswers {
  values: LogValues
  notes: GroupNotes
  /** Slider fields still at their default, never moved (saved, but marked as not touched). */
  untouched?: number[]
}

/** Split answers into the per-subject part (quick groups) and the shared part (setup and detail). */
export function splitBySection(schema: LogSchema, a: LogAnswers): { quick: LogAnswers; shared: LogAnswers } {
  const quickGroups = new Set(schema.groups.filter((g) => g.section === 'quick').map((g) => g.id))
  const quickFields = new Set(schema.fields.filter((f) => quickGroups.has(f.groupId)).map((f) => f.id))
  const quick: LogAnswers = { values: {}, notes: {}, untouched: [] }
  const shared: LogAnswers = { values: {}, notes: {}, untouched: [] }
  for (const [k, v] of Object.entries(a.values)) (quickFields.has(Number(k)) ? quick : shared).values[Number(k)] = v
  for (const [k, v] of Object.entries(a.notes)) (quickGroups.has(Number(k)) ? quick : shared).notes[Number(k)] = v
  for (const id of a.untouched ?? []) (quickFields.has(id) ? quick : shared).untouched!.push(id)
  return { quick, shared }
}

/**
 * The log entry for every part. Each part gets its subject's quick answers
 * and the shared answers; progress goes only on the subject's latest part, so
 * pages are not counted twice when a subject came back in the same session.
 */
export function sessionLogEntries(
  schema: LogSchema,
  subjects: SessionSubject[],
  perSubject: Record<Id, LogAnswers>,
  shared: LogAnswers
): { blockId: Id; values: LogValues; notes: GroupNotes; untouched: number[] }[] {
  const progress = fieldByKey(schema, 'progress')
  const out: { blockId: Id; values: LogValues; notes: GroupNotes; untouched: number[] }[] = []
  for (const s of subjects) {
    const own = perSubject[s.itemId] ?? { values: {}, notes: {} }
    const latest = s.blockIds[s.blockIds.length - 1]
    for (const blockId of s.blockIds) {
      const values: LogValues = { ...shared.values, ...own.values }
      if (progress && blockId !== latest) delete values[progress.id]
      const untouched = [...(shared.untouched ?? []), ...(own.untouched ?? [])].filter((id) => values[id] !== undefined && values[id] !== null)
      out.push({ blockId, values, notes: { ...shared.notes, ...own.notes }, untouched })
    }
  }
  return out
}

/** An explicit answer confirms even an unchanged suggestion; other flags survive. */
export function answerField(previous:LogAnswers,fieldId:number,value:LogValues[number]):LogAnswers {
  return {...previous,values:{...previous.values,[fieldId]:value},untouched:(previous.untouched??[]).filter(id=>id!==fieldId)}
}

/** Carry structured detail answers as suggestions; never repeat free writing or progress. */
export function rememberedDetailSuggestions(schema:LogSchema,previous:LogValues|null):LogValues {
 const values:LogValues={}
 for(const f of fieldsIn(schema,'detail')){
  if(f.type==='text'||f.type==='progress')continue
  const value=previous?.[f.id]
  if(value===undefined||isEmptyValue(value))continue
  if(f.type==='single'||f.type==='activity'){
   if(typeof value==='string'&&f.options.some(o=>o.id===value&&!o.archived))values[f.id]=value
  }else if(f.type==='multi'){
   const selected=Array.isArray(value)?value.filter(v=>f.options.some(o=>o.id===v&&!o.archived)):[]
   if(selected.length)values[f.id]=selected
  }else values[f.id]=value
 }
 return values
}
