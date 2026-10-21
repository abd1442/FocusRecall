import type { FactorDef, StatSession } from './statsData'
export const calibrationFactors: FactorDef[] = [
  {key:'place',semanticKey:'place',label:'Place',options:['Library','Home','Cafe'],group:'setup',multi:false},
  {key:'sound',semanticKey:'sound',label:'Sound',options:['Quiet','Music'],group:'setup',multi:false},
  {key:'phone',semanticKey:'phone-location',label:'Phone',options:['Away','Desk','Pocket'],group:'setup',multi:false},
  {key:'people',semanticKey:'people',label:'People',options:['Alone','Together'],group:'setup',multi:false}
]
/** Fictional seeded data, with neither app/database access nor production imports. */
export function calibrationHistory(seed:number,days:number,effect=0,scenario='independent'):StatSession[] {
  let state=seed>>>0,serial=0,condition=0
  const random=():number=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296}
  const normal=():number=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random())
  const rows:StatSession[]=[]
  for(let d=0;d<days;d++){
    serial=.7*serial+normal()*.5
    if(d%7===0)condition=random()<.5?1:0
    const mood=scenario==='serial'?serial:normal()*.5
    for(let k=0,n=1+Math.floor(random()*3);k<n;k++){
      const item=1+Math.floor(random()*2),hour=7+Math.floor(random()*14)
      const factors=Object.fromEntries(calibrationFactors.map(f=>[f.key,[f.options[Math.floor(random()*f.options.length)]]]))
      if(scenario==='serial')factors.sound=[condition?'Music':'Quiet']
      if(scenario==='subject-confounding')factors.place=[random()<(item===1?.85:.15)?'Library':'Home']
      if(scenario==='time-confounding')factors.place=[d<days/2?'Library':'Home']
      const value=3+mood+normal()*.8+(factors.place[0]==='Library'?effect:0)+(scenario==='subject-confounding'?(item===1?.8:-.8):0)+(scenario==='time-confounding'?1.5*d/days:0)
      const focus=scenario==='skew'?(random()<.9?1:5):scenario==='heteroskedastic'?(factors.place[0]==='Library'?(random()<.5?2:4):3):Math.max(1,Math.min(5,Math.round(value))),start=Date.UTC(2026,0,1+d,hour)
      rows.push({id:rows.length+1,start,end:start+1800000,day:new Date(start).toISOString().slice(0,10),hour,weekday:new Date(start).getUTCDay(),sittingId:rows.length+1,positionInSitting:1,positionInDay:k+1,itemId:item,itemIds:[item],categoryId:1,topCategoryId:1,activity:'revision',timerMode:'flow',focusSeconds:1800,targetSeconds:1500,overTarget:false,outcomes:{focus,recall:Math.max(1,Math.min(5,Math.round(value+normal()*.4))),length:30,distractionsPerHour:Math.max(0,normal()+2)},untouchedOutcomes:[],factors,untouchedFactors:[],difficulty:null,difficultyTouched:false,progressAmount:null,progressUnit:null,distractions:[],quality:'clean',goalResult:null,hasGoal:false,resisted:0,stuck:0,windowSwitches:0,appSeconds:{},rest:null,restBefore:null,stage:'s',stageIndex:0,hoursOnSubject:0,priorKnowledge:null,newField:null,buildsOn:false} as StatSession)
    }
  }
  return rows
}
