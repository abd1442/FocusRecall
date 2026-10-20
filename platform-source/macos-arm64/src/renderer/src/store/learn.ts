import { create } from 'zustand'
import type { LearnAction, LearnState, LessonId } from '@core/learn'
type LearnView='today'|'guide'|'strategies'|'lab'|'saved'
interface LearnStore {data:LearnState|null;error:string;busy:boolean;view:LearnView;lesson:LessonId|null;revisiting:boolean;query:string;topic:string;collection:string;scroll:number;load:()=>Promise<void>;act:(a:LearnAction)=>Promise<boolean>;navigate:(view:LearnView)=>void;open:(id:LessonId,revisiting?:boolean)=>void;close:()=>void}
let queue=Promise.resolve()
export const useLearn=create<LearnStore>((set,get)=>({
 data:null,error:'',busy:false,view:'today',lesson:null,revisiting:false,query:'',topic:'',collection:'',scroll:0,
 load:async()=>{try{const data=await window.api.invoke('learn:get');set({data,error:''})}catch{set({error:'Could not load Learn progress. Your study records are unaffected. Retry to continue.'})}},
 act:async action=>{
   let ok=false
   const task=async():Promise<void>=>{set({busy:true,error:''});try{const data=await window.api.invoke('learn:act',action);set({data});ok=true}catch{set({error:'Could not save Learn progress. Keep this page open and retry.'})}finally{set({busy:false})}}
   queue=queue.then(task,task);await queue;return ok
 },
 navigate:view=>{set({view,lesson:null,revisiting:false,scroll:0});if(view==='today')void get().act({type:'today'})},
 open:(lesson,revisiting=false)=>{set({lesson,revisiting,scroll:0});void get().act({type:'view',id:lesson})},
 close:()=>set({lesson:null,revisiting:false})
}))
