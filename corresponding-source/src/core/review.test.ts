import { expect,it } from 'vitest'
import { pauseReview,reviewElapsed,resumedReviewSeconds } from './review'
it('counts explicit review time, excludes pause time and resumes accurately',()=>{
 const initial={seconds:0,startedAt:null}
 expect(reviewElapsed(initial,900000)).toBe(0)
 const running={seconds:0,startedAt:1000}
 expect(reviewElapsed(running,61000)).toBe(60)
 const paused=pauseReview(running,31000)
 expect(reviewElapsed(paused,900000)).toBe(30)
 expect(reviewElapsed({...paused,startedAt:900000},910000)).toBe(40)
})
it('restores persisted review only once without counting app downtime',()=>{
 expect(resumedReviewSeconds(15,20)).toBe(20)
 expect(resumedReviewSeconds(20,15)).toBe(20)
 expect(resumedReviewSeconds(null,undefined)).toBe(0)
 expect(reviewElapsed({seconds:0,startedAt:2000},1000)).toBe(0)
})
