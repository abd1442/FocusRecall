import { describe, expect, it } from 'vitest'
import { recordedActivity } from './recordedActivity'
import { DEFAULT_ANALYSIS } from './insights'
import type { StatSession } from './statsData'
const today='2026-10-16'
const row=(id:number,patch:Partial<StatSession>={}):StatSession=>({id,day:today,itemId:1,itemIds:[1],focusSeconds:1200,outcomes:{focus:3,recall:4},untouchedOutcomes:[],...patch} as StatSession)
const summarize=(rows:StatSession[])=>recordedActivity(rows,today,DEFAULT_ANALYSIS)
describe('recorded activity dashboard',()=>{
 it('splits visual overtime within each session without adding it again to recorded focus totals',()=>{
  const a=summarize([row(1,{focusSeconds:1800,targetSeconds:1200}),row(2,{focusSeconds:300,targetSeconds:1200})]);
  expect(a.seconds).toBe(2100);expect(a.recent.find(d=>d.day===today)).toMatchObject({seconds:2100,overtime:600});
 })
 it('does not invent overtime for missing or invalid targets, invalid durations, or duplicate IDs',()=>{
  const a=summarize([row(1,{focusSeconds:1800,targetSeconds:0}),row(2,{focusSeconds:1800,targetSeconds:NaN}),row(3,{focusSeconds:NaN,targetSeconds:1200}),row(4,{focusSeconds:1800,targetSeconds:1200}),row(4,{focusSeconds:1800,targetSeconds:1200})]);
  expect(a.seconds).toBe(5400);expect(a.recent.find(d=>d.day===today)?.overtime).toBe(600);
 })
 it('gives an honest zero state without fabricated ratings or subjects',()=>{
  const a=summarize([]);expect(a).toMatchObject({sessions:0,days:0,seconds:0,focus:0,recall:0,subjects:[]});expect(a.recent).toHaveLength(14);expect(a.recent.every(d=>!d.recorded)).toBe(true)
 })
 it('describes four sessions on two days without treating them as four independent days',()=>{
  const a=summarize([row(1),row(2),row(3,{day:'2026-10-15'}),row(4,{day:'2026-10-15'})]);expect(a).toMatchObject({sessions:4,days:2,seconds:4800,focus:4,recall:4});expect(a.recent.filter(d=>d.recorded).map(d=>d.seconds)).toEqual([2400,2400])
 })
 it('uses actual subject parts without attributing mixed-session time twice',()=>{
  const a=summarize([row(1,{itemIds:[1,2],subjectParts:[{itemId:1,categoryId:1,topCategoryId:1,focusSeconds:300},{itemId:2,categoryId:1,topCategoryId:1,focusSeconds:900}]})]);expect(a.subjects.map(s=>[s.itemId,s.focusSeconds])).toEqual([[2,900],[1,300]]);expect(a.seconds).toBe(1200)
 })
 it('does not invent a subject split for legacy mixed rows lacking parts',()=>{
  const a=summarize([row(1,{itemIds:[1,2]})]);expect(a.subjects).toEqual([]);expect(a.seconds).toBe(1200)
 })
 it('excludes untouched ratings even when a legacy row also carries an answered aggregate',()=>{
  const a=summarize([row(1,{untouchedOutcomes:['focus','recall']}),row(2,{outcomes:{}}),row(3,{untouchedOutcomes:['recall'],answeredOutcomes:{recall:4}})]);expect(a.focus).toBe(1);expect(a.recall).toBe(0)
 })
 it('uses a valid answered-only aggregate when the aggregate is not marked untouched',()=>{
  const a=summarize([row(1,{outcomes:{recall:NaN},answeredOutcomes:{recall:4}})]);expect(a.recall).toBe(1)
 })
 it('keeps all-range totals separate from the last fourteen-day illustration',()=>{
  const a=summarize([row(1,{day:'2025-01-01'}),row(2)]);expect(a.days).toBe(2);expect(a.seconds).toBe(2400);expect(a.recent.filter(d=>d.recorded)).toHaveLength(1)
 })
 it('deduplicates session IDs and contains invalid durations',()=>{
  const a=summarize([row(1),row(1),row(2,{focusSeconds:-5}),row(3,{focusSeconds:NaN})]);expect(a.sessions).toBe(3);expect(a.seconds).toBe(1200)
 })
})
