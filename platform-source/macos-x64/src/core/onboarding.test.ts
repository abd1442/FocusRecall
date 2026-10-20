import {expect,it} from 'vitest'
import {followStudy} from './onboarding'
import {IDLE_STATE,type SessionState} from './session'
it('waits for actual study actions instead of advancing a slideshow',()=>{
 expect(followStudy(IDLE_STATE,'start',false,false)).toBe('start')
 expect(followStudy(IDLE_STATE,'start',true,false)).toBe('preparation')
 expect(followStudy(IDLE_STATE,'preparation',false,false)).toBe('start')
 const recall={...IDLE_STATE,stage:'recall',step:'recall'} as SessionState
 expect(followStudy(recall,'focus',false,true)).toBe('keep')
 expect(followStudy(recall,'keep',false,false)).toBe('recall')
 expect(followStudy({...recall,step:'log'},'recall',false,false)).toBe('log')
 expect(followStudy(recall,'welcome',false,false)).toBe('welcome')
 expect(followStudy(recall,'history',false,false)).toBe('history')
 expect(recall.step).toBe('recall')
 expect(followStudy(IDLE_STATE,'rest-over',false,false)).toBe('next')
})
