import { beforeEach, expect, it } from 'vitest'
import { initialHistoryView, useUi } from './store/ui'

beforeEach(()=>useUi.setState({historyView:initialHistoryView(),historyDay:null,historySessionId:null,tab:'home'}))

it('retains a complete History browsing scope while visiting another tab',()=>{
  const scope={view:'notes' as const,query:'cell membrane',preset:'custom' as const,custom:{from:'2026-10-01',to:'2026-10-20'},itemId:12,categoryId:4,activityId:'reading',quality:'some' as const,groupBy:'subject' as const,showCharts:true,selectedDay:'2026-10-15'}
  useUi.getState().setHistoryView(scope)
  useUi.getState().setTab('library')
  useUi.getState().setTab('history')
  expect(useUi.getState().historyView).toEqual(scope)
})

it('opens a requested session even when a previous search or note view would hide it',()=>{
  useUi.getState().setHistoryView({view:'notes',query:'unrelated',itemId:8,categoryId:3,activityId:'reading',quality:'clean',preset:'custom',selectedDay:'2026-09-01'})
  useUi.getState().openHistorySession(42)
  const state=useUi.getState()
  expect(state.tab).toBe('history')
  expect(state.historySessionId).toBe(42)
  expect(state.historyView).toMatchObject({view:'sessions',query:'',itemId:null,categoryId:null,activityId:null,quality:null,preset:'all',selectedDay:null,groupBy:'day'})
})

it('a requested calendar day opens sessions with a clear scope, preserving unrelated display choices',()=>{
  useUi.getState().setHistoryView({view:'review',query:'hidden',itemId:9,showCharts:true})
  useUi.getState().openHistoryDay('2026-10-27')
  const state=useUi.getState()
  expect(state.historyView).toMatchObject({view:'sessions',preset:'day',selectedDay:'2026-10-27',query:'',itemId:null,showCharts:true})
  expect(state.historyDay).toBe('2026-10-27')
  useUi.getState().clearHistoryDay()
  expect(useUi.getState().historyView.selectedDay).toBe('2026-10-27')
})
