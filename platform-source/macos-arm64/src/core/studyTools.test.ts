import { describe, expect, it } from 'vitest'
import { experimentResults, validateExperiment, validateView, weeklyReview, type StudyExperiment, type ComparisonView } from './studyTools'
import type { StatSession } from './statsData'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
import { StudyToolsRepo } from '../main/repos/studyTools'

const experiment:StudyExperiment={id:'test',name:'Phone outside',change:'Leave phone outside',itemId:1,baselineFrom:'2026-10-01',changeOn:'2026-10-08',endDay:'2026-10-14',outcome:'focus',notes:'',status:'planned',includeUntouched:false}
const view:ComparisonView={id:'view',name:'Morning focus',range:'last-30',custom:{from:'2026-10-01',to:'2026-10-14'},filter:{itemId:1,categoryId:null,activity:null},options:{withinSubject:true,includeUntouched:false},outcome:'focus'}
const session=(p:Partial<StatSession>={}):StatSession=>({id:1,itemId:1,itemIds:[1],activity:'revision',day:'2026-10-01',focusSeconds:1200,outcomes:{focus:3},untouchedOutcomes:[],factors:{},untouchedFactors:[],...p} as StatSession)

describe('study tools',()=>{
  it('does not mix the change day into baseline, other subjects, future or mixed sessions',()=>{
    const rows=[session(),session({day:'2026-10-08',outcomes:{focus:5}}),session({day:'2026-10-09',itemIds:[1,2]}),session({day:'2026-10-09',itemId:2,itemIds:[2]}),session({day:'2026-10-15'}),session({day:'2026-10-10'})]
    const r=experimentResults(rows,experiment,'2026-10-09')
    expect(r.before).toMatchObject({total:1,n:1,mean:3});expect(r.after).toMatchObject({total:1,n:1,mean:5});expect(r.mixedExcluded).toBe(1);expect(r.difference).toBeNull()
  })
  it('requires five usable outcomes on each side and excludes untouched ratings by default',()=>{
    const rows=[...Array.from({length:5},()=>session()),...Array.from({length:5},()=>session({day:'2026-10-08',outcomes:{focus:4}})),session({day:'2026-10-08',outcomes:{focus:1},untouchedOutcomes:['focus']})]
    expect(experimentResults(rows,experiment,'2026-10-14').observedDifference).toBeNull() // Many repeated entries on one day do not support matching.
    expect(experimentResults(rows,experiment,'2026-10-14').difference).toBeNull()
    expect(experimentResults(rows,{...experiment,includeUntouched:true},'2026-10-14').after.n).toBe(6)
    expect(experimentResults(rows.slice(1),experiment,'2026-10-14').difference).toBeNull()
  })
  it('reviews exactly the selected week, keeps previous-week totals and distinguishes missing ratings',()=>{
    const rows=[session({day:'2026-10-04'}),session({day:'2026-10-05',untouchedOutcomes:['focus']}),session({day:'2026-10-11'}),session({day:'2026-10-12'}),session({day:'2026-10-15'})]
    const r=weeklyReview(rows,[],'2026-10-05','2026-10-14')
    expect(r.rows).toBe(2);expect(r.days).toBe(2);expect(r.focusSeconds).toBe(2400);expect(r.previousSeconds).toBe(1200);expect(r.missingFocus).toBe(1);expect(r.missingRecall).toBe(2);expect(r.finding).toBeNull()
    expect(r.daily).toHaveLength(7);expect(r.daily.reduce((n,d)=>n+d.seconds,0)).toBe(r.focusSeconds);expect(r.daily[0].sessions).toBe(1);expect(r.daily[6].sessions).toBe(1)
  })
  it('rejects reversed/nonexistent dates and malformed saved view options',()=>{
    expect(()=>validateExperiment({...experiment,changeOn:experiment.baselineFrom})).toThrow()
    expect(()=>validateExperiment({...experiment,endDay:'2026-02-30'})).toThrow()
    expect(()=>validateView({...view,custom:{from:'2026-10-14',to:'2026-10-01'}})).toThrow()
    expect(()=>validateView({...view,options:{withinSubject:'yes',includeUntouched:false} as never})).toThrow()
  })
  it('keeps weekly subject time additive and uses only answered single-subject outcomes',()=>{
    const r=weeklyReview([session(),session({itemId:2,itemIds:[2],focusSeconds:600,outcomes:{focus:5,recall:4}}),session({itemIds:[1,2],focusSeconds:300,outcomes:{focus:1}}),session({untouchedOutcomes:['focus'],outcomes:{focus:1}})],[],'2026-10-01','2026-10-07')
    expect(r.subjects.reduce((n,s)=>n+s.seconds,0)).toBe(r.focusSeconds)
    expect(r.subjects.find(s=>s.itemId===null)).toEqual({itemId:null,seconds:300,sessions:1})
    expect(r.outcomes[0].current).toEqual({n:2,mean:4})
    expect(r.outcomes[1].current).toEqual({n:1,mean:4})
    expect(r.outcomes[0].previous).toEqual({n:0,mean:null})
  })
  it('persists and updates independent entries without altering original settings or deleting session data',()=>{
    const db=openDatabase(':memory:')
    try{
      const settings=new SettingsRepo(db);settings.set('focusTargetMinutes',35)
      const repo=new StudyToolsRepo(settings),secondWindow=new StudyToolsRepo(settings)
      repo.saveView(view);secondWindow.saveExperiment(experiment);repo.saveReview({week:'2026-10-05',note:'Useful week',nextStep:'Try quiet room'})
      repo.saveView({...view,name:'Renamed'})
      expect(secondWindow.get()).toMatchObject({views:[{name:'Renamed'}],experiments:[experiment],reviews:[{note:'Useful week'}]})
      repo.remove('view',view.id);expect(repo.get().views).toEqual([]);expect(repo.get().experiments).toHaveLength(1)
      expect(settings.getAll().focusTargetMinutes).toBe(35);expect(JSON.stringify(settings.getAll())).not.toContain('Phone outside')
      expect(()=>repo.saveExperiment({...experiment,change:''})).toThrow();expect(repo.get().experiments).toHaveLength(1)
    }finally{db.close()}
  })
})
