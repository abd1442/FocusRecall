import { EXPANDED_LESSONS } from './learnExpansion'
import { ADVICE_CATALOG } from './adviceCatalog'
import { parseDayStart, studyDayKey, studyDayRange } from './studyDay'
export const LEGACY_LESSONS = [
  {id:'familiarity',concept:'recall-attempt',related:['predict-check','delayed-check'],kind:'reconstruct',group:'notice'},
  {id:'retrieve',concept:'cue-ladder',related:['question-design','recall-attempt'],kind:'repair',group:'remember'},
  {id:'spacing',concept:'spacing-return',related:['spacing-adjust'],kind:'schedule',group:'remember'},
  {id:'explain',concept:'explain-step',related:['evidence-claim','compare-concepts'],kind:'reason',group:'understand'},
  {id:'examples',concept:'worked-example',related:['fade-support'],kind:'fade',group:'understand'},
  {id:'feedback',concept:'error-retry',related:['feedback-specific'],kind:'feedback',group:'practice'},
  {id:'mix',concept:'interleave',related:['compare-concepts'],kind:'contrast',group:'practice'},
  {id:'reflect',concept:'choose-target',related:['predict-check','plan-feasible','restart-note'],kind:'plan',group:'adapt'}
] as const
export type LegacyLessonId=typeof LEGACY_LESSONS[number]['id']
export const LEARN_LESSONS=[...LEGACY_LESSONS,...EXPANDED_LESSONS] as const
export type LessonId=typeof LEARN_LESSONS[number]['id']
export type LearnKind=typeof LEARN_LESSONS[number]['kind']
export const learnLesson=(id:string)=>LEARN_LESSONS.find(l=>l.id===id)
export interface LessonProgress {version:1; viewedAt:number; activityAt:number; completedAt:number; checks:number; lastCheck:number|null; revisitAt:number; revisitCount:number; revisitEnabled:boolean; draft:number[]}
export interface LearnState {version:5;lessons:Partial<Record<LessonId,LessonProgress>>;saved:string[];exposures:{id:LessonId;day:string}[];today:{day:string;id:string|null;hidden:boolean;seen:string[];revisiting?:boolean};lastLesson:LessonId|null}
export type LearnAction=
  |{type:'view'|'activity'|'complete'|'revisit'|'remind';id:LessonId}
  |{type:'check';id:LessonId;choice:number}
  |{type:'draft';id:LessonId;values:number[]}
  |{type:'save';id:string}
  |{type:'today'}|{type:'another'}|{type:'hide'}|{type:'reset'}
export const LEARN_POLICY={revisitDays:[2,7,21,60],freshDays:14} as const
// Start with the core, qualified learning concepts; expansion ideas follow.
export const LEARN_INTRO_ORDER:readonly LessonId[]=['familiarity','retrieve','spacing','feedback','explain','examples','mix','reflect']
export function learnRefreshDelay(now:Date,dayStart:string):number {
  const boundary=parseDayStart(dayStart)
  // Recheck clocks after sleep/time-zone changes without polling the database.
  return Math.max(100,Math.min(60000,studyDayRange(studyDayKey(now,boundary),boundary).end.getTime()-now.getTime()))
}
function previouslyShown(state:LearnState,id:LessonId):boolean {
  const p=state.lessons[id]
  return !!(p&&(p.viewedAt||p.activityAt||p.completedAt||p.revisitAt))||state.exposures.some(e=>e.id===id)
}
const emptyProgress=():LessonProgress=>({version:1,viewedAt:0,activityAt:0,completedAt:0,checks:0,lastCheck:null,revisitAt:0,revisitCount:0,revisitEnabled:false,draft:[]})
const contentIds=new Set([...LEARN_LESSONS.map(l=>'lesson:'+l.id),...ADVICE_CATALOG.map(c=>'concept:'+c.id)])
const validDay=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
export function validLearnDraft(id:LessonId,values:unknown):values is number[] {
  if(!Array.isArray(values)||values.length>16||values.some(n=>!Number.isInteger(n)||n<0||n>30))return false
  if(!values.length)return true
  if(learnLesson(id)!.kind==='visual')return false
  const kind=learnLesson(id)!.kind
  if(kind==='schedule')return values.length===5&&values.slice(0,4).every(n=>n<=13)&&values[4]<=3
  if(kind==='reconstruct')return values.length<=4&&values[0]<=1&&values.slice(1).every(n=>n<=2)&&new Set(values.slice(1)).size===values.length-1
  if(kind==='reason')return values.length===1&&values[0]<=1
  if(kind==='plan')return values.length<=3&&values.every(n=>n<=2)&&new Set(values).size===values.length
  return values.length===3&&values[0]<(kind==='repair'?4:kind==='contrast'?2:3)&&values[1]<=1&&values[2]<=1
}
export function normalizeLearn(raw:unknown,now=Date.now()):LearnState {
  const o=raw&&typeof raw==='object'?raw as Partial<LearnState>:{}
  // Preserve a newer format instead of silently overwriting it after downgrade.
  if(typeof o.version==='number'&&o.version>5)throw Error('This Learn progress was saved by a newer version of FocusRecall.')
  const lessons:LearnState['lessons']={},stamp=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=now?Math.floor(n):0
  for(const lesson of LEARN_LESSONS){const p=o.lessons?.[lesson.id];if(!p||typeof p!=='object')continue;lessons[lesson.id]={...emptyProgress(),viewedAt:stamp(p.viewedAt),activityAt:stamp(p.activityAt),completedAt:stamp(p.completedAt),checks:Number.isSafeInteger(p.checks)?Math.max(0,Math.min(10000,p.checks)):0,lastCheck:Number.isInteger(p.lastCheck)&&p.lastCheck!>=0&&p.lastCheck!<=2?p.lastCheck!:null,revisitAt:stamp(p.revisitAt),revisitCount:Number.isSafeInteger(p.revisitCount)?Math.max(0,Math.min(10000,p.revisitCount)):0,revisitEnabled:p.revisitEnabled===true,draft:validLearnDraft(lesson.id,p.draft)?[...p.draft]:[]}}
  const unique=(a:unknown,valid:(v:string)=>boolean)=>Array.isArray(a)?[...new Set(a.filter((v):v is string=>typeof v==='string'&&valid(v)))]:[]
  const today=o.today&&typeof o.today==='object'?o.today:undefined
  const exposures=(Array.isArray(o.exposures)?o.exposures:[]).filter(e=>e&&learnLesson(e.id)&&validDay(e.day)).slice(-32).map(e=>({id:learnLesson(e.id)!.id,day:e.day}))
  return {version:5,lessons,saved:unique(o.saved,id=>contentIds.has(id)).slice(0,contentIds.size),exposures,today:{day:validDay(today?.day)?today.day:'',id:typeof today?.id==='string'&&!!learnLesson(today.id)?today.id:null,hidden:today?.hidden===true,seen:unique(today?.seen,id=>!!learnLesson(id)).slice(-LEARN_LESSONS.length),revisiting:today?.revisiting===true||(today?.revisiting===undefined&&!!today?.id&&!!lessons[today.id as LessonId]?.viewedAt)},lastLesson:typeof o.lastLesson==='string'?learnLesson(o.lastLesson)?.id??null:null}
}
export function readyRevisit(state:LearnState,now=Date.now()):LessonId|null {
  return LEARN_LESSONS.filter(l=>{const p=state.lessons[l.id];return p?.revisitEnabled&&p.activityAt&&now-Math.max(p.activityAt,p.revisitAt)>=LEARN_POLICY.revisitDays[Math.min(p.revisitCount,3)]*86400000}).sort((a,b)=>(state.lessons[a.id]?.revisitAt??0)-(state.lessons[b.id]?.revisitAt??0))[0]?.id??null
}
export function updateLearn(raw:unknown,action:LearnAction,day:string,now=Date.now()):LearnState {
  if(!validDay(day))throw Error('Invalid Learn study day.')
  const state=normalizeLearn(raw,now)
  if(action.type==='reset')return normalizeLearn(null,now)
  if(action.type==='save'){
    if(!contentIds.has(action.id))throw Error('Unknown Learn content.')
    state.saved=state.saved.includes(action.id)?state.saved.filter(id=>id!==action.id):[...state.saved,action.id];return state
  }
  if(action.type==='hide'){state.today={...state.today,day,hidden:true};return state}
  if(action.type==='today'||action.type==='another'){
    if(action.type==='today'&&state.today.day===day&&(state.today.id||state.today.hidden))return state
    const current=state.today.id
    let seen=state.today.day===day?state.today.seen:[]
    let candidates=LEARN_LESSONS.filter(l=>l.id!==current&&!seen.includes(l.id))
    // Exhaustion restarts the presentation cycle, never the user's progress.
    if(!candidates.length){seen=[];candidates=LEARN_LESSONS.filter(l=>l.id!==current)}
    const rank=(id:LessonId)=>{const i=LEARN_INTRO_ORDER.indexOf(id);return i<0?LEARN_INTRO_ORDER.length+LEARN_LESSONS.findIndex(l=>l.id===id):i}
    const exposure=(id:LessonId)=>state.exposures.findLastIndex(e=>e.id===id)
    candidates.sort((a,b)=>Number(previouslyShown(state,a.id))-Number(previouslyShown(state,b.id))||exposure(a.id)-exposure(b.id)||(state.lessons[a.id]?.viewedAt??0)-(state.lessons[b.id]?.viewedAt??0)||rank(a.id)-rank(b.id))
    const id=candidates[0].id,revisiting=previouslyShown(state,id);state.today={day,id,hidden:false,seen:[...seen,id].slice(-LEARN_LESSONS.length),revisiting};state.exposures=[...state.exposures,{id,day}].slice(-32);return state
  }
  if(!learnLesson(action.id))throw Error('Unknown Learn lesson.')
  const p=state.lessons[action.id]??emptyProgress();state.lessons[action.id]=p
  if(action.type==='view'){p.viewedAt=now;state.lastLesson=action.id}
  else if(action.type==='activity')p.activityAt=now
  else if(action.type==='complete'){if(!p.activityAt)throw Error('Explore an activity before marking the lesson complete.');p.completedAt=now}
  else if(action.type==='remind')p.revisitEnabled=!p.revisitEnabled
  else if(action.type==='revisit'){p.revisitAt=now;p.revisitCount=Math.min(10000,p.revisitCount+1)}
  else if(action.type==='check'){if(!Number.isInteger(action.choice)||action.choice<0||action.choice>2)throw Error('Invalid Learn choice.');p.checks=Math.min(10000,p.checks+1);p.lastCheck=action.choice}
  else if(action.type==='draft'){if(!validLearnDraft(action.id,action.values))throw Error('Invalid Learn activity.');p.draft=[...action.values]}
  return state
}
