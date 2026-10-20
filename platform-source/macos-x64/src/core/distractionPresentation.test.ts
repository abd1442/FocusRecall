import { expect,it } from 'vitest'
import { distractionDuration,distractionTimeParts } from './distractionPresentation'

it('preserves seconds instead of rounding a short recorded interruption to zero minutes',()=>{
  expect(distractionDuration(1/60)).toBe('1 s')
  expect(distractionDuration(0.1/60)).toBe('<1 s')
  expect(distractionDuration(0)).toBe('0 s')
  expect(distractionDuration(35)).toBe('35 min')
  expect(distractionDuration(88)).toBe('1 h 28 min')
})
it('accounts for reasons outside the visible leaders without renormalizing their shares',()=>{
  const rows=[{label:'Phone',value:10},{label:'Messages',value:5},{label:'Away',value:3},{label:'Other',value:2}]
  const parts=distractionTimeParts(rows,25)
  expect(parts.map(p=>p.minutes)).toEqual([10,5,3,7])
  expect(parts[0].share).toBe(.4)
  expect(parts.reduce((n,p)=>n+p.share,0)).toBeCloseTo(1)
  expect(rows).toHaveLength(4)
})
it('does not invent other time for an empty or complete breakdown',()=>{
  expect(distractionTimeParts([],0)).toEqual([])
  expect(distractionTimeParts([{label:'Phone',value:1/60}],1/60)).toEqual([{label:'Phone',minutes:1/60,share:1}])
})
