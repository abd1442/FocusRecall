import { jackknifeSE } from './statisticalMath'

export interface TemporalDay { day:string; side:boolean; value:number }
const date=(day:string):number=>Math.round(Date.parse(day+'T00:00:00Z')/86400000)
const sumValues=(xs:number[]):number=>xs.reduce((a,b)=>a+b,0)
const effective=(xs:number[]):number=>xs.length?sumValues(xs)**2/sumValues(xs.map(x=>x*x)):0

/** Design-only episode summary. Missing days do not manufacture switches.
 * A day with both conditions is a local crossover; it supplies one episode
 * on each side, not one independent observation per session. */
export function conditionEpisodes(rows:TemporalDay[]) {
  const days=new Map<number,Set<boolean>>()
  for(const r of rows){const d=date(r.day),s=days.get(d)??new Set<boolean>();s.add(r.side);days.set(d,s)}
  let first=0,other=0,start=0,end=0,previous:boolean|undefined
  const durations:number[]=[],lengths=[[] as number[],[] as number[]]
  const record=(side:boolean,length:number)=>{durations.push(length);lengths[side?0:1].push(length)}
  for(const [d,sides]of [...days].sort((a,b)=>a[0]-b[0])){
    if(sides.size===2){
      if(previous!==undefined)record(previous,end-start+1)
      record(true,1);record(false,1);first++;other++;previous=undefined
    }else{
      const side=sides.has(true)
      if(previous===side)end=d
      else{if(previous!==undefined)record(previous,end-start+1);side?first++:other++;start=end=d;previous=side}
    }
  }
  if(previous!==undefined)record(previous,end-start+1)
  return {first,other,durations,effectiveFirst:effective(lengths[0]),effectiveOther:effective(lengths[1])}
}

/** A conservative multi-scale, condition-aware block sensitivity, not an exact
 * finite-sample test. The slow design's duration-weighted episode length sets
 * the long scale (two duration-weighted episodes); day/week variation are floors.
 * Two origins reduce dependence on which side of a boundary a run starts.
 * All choices use dates/conditions, never the observed effect or p-value. */
export function temporalSupport(rows:TemporalDay[]) {
  const episodes=conditionEpisodes(rows)
  // An episode containing a randomly selected observed calendar position has
  // mean length sum(L²)/sum(L). Long bouts matter even among many short ones.
  // The same concentration limits the effective episode count on each side.
  const durationWeightedLength=sumValues(episodes.durations)?sumValues(episodes.durations.map(x=>x*x))/sumValues(episodes.durations):1
  const blockDays=Math.max(14,Math.ceil(2*durationWeightedLength))
  const dayMap=new Map<number,{sum:number[];n:number[]}>(),sum=[0,0],n=[0,0]
  for(const r of rows){const i=r.side?0:1,d=date(r.day),v=dayMap.get(d)??{sum:[0,0],n:[0,0]};sum[i]+=r.value;n[i]++;v.sum[i]+=r.value;v.n[i]++;dayMap.set(d,v)}
  const atScale=(length:number,offset=0)=>{
    const blocks=new Map<number,{sum:number[];n:number[]}>()
    for(const [day,v]of dayMap){const key=Math.floor((day+offset)/length),b=blocks.get(key)??{sum:[0,0],n:[0,0]};for(let i=0;i<2;i++){b.sum[i]+=v.sum[i];b.n[i]+=v.n[i]}blocks.set(key,b)}
    const first=[...blocks.values()].filter(v=>v.n[0]>0).length,other=[...blocks.values()].filter(v=>v.n[1]>0).length
    const deleted=[...blocks.values()].map(v=>n[0]>v.n[0]&&n[1]>v.n[1]?(sum[0]-v.sum[0])/(n[0]-v.n[0])-(sum[1]-v.sum[1])/(n[1]-v.n[1]):undefined)
    return {blocks:blocks.size,first,other,se:deleted.every((v):v is number=>v!==undefined)?jackknifeSE(deleted):null}
  }
  const day=atScale(1),week=atScale(7,3),long=atScale(blockDays),shifted=atScale(blockDays,Math.floor(blockDays/2))
  const df=Math.floor(Math.min(long.blocks,shifted.blocks,long.first,long.other,shifted.first,shifted.other,episodes.effectiveFirst,episodes.effectiveOther))-1
  const supported=df>=3&&[day,week,long,shifted].every(v=>v.se!==null)
  const se=supported?Math.max(day.se!,week.se!,long.se!,shifted.se!):null
  // A linear-time sensitivity is a diagnostic against an association explained
  // by calendar trend. It does not remove nonlinear or unrecorded confounding.
  const ds=[...dayMap.keys()],origin=ds[0]??0
  let sx=0,st=0,sy=0,sxx=0,stt=0,sxt=0,sxy=0,sty=0,count=0
  for(const r of rows){const x=Number(r.side),t=date(r.day)-origin,y=r.value;sx+=x;st+=t;sy+=y;sxx+=x*x;stt+=t*t;sxt+=x*t;sxy+=x*y;sty+=t*y;count++}
  const xx=sxx-sx*sx/count,tt=stt-st*st/count,xt=sxt-sx*st/count,xy=sxy-sx*sy/count,ty=sty-st*sy/count
  const remaining=tt>0?xx-xt*xt/tt:xx
  const coefficient=remaining>1e-10?(xy-(tt>0?xt*ty/tt:0))/remaining:null
  const timeAdjusted=coefficient!==null&&Math.abs(coefficient)<1e-10?0:coefficient
  return {supported,se,df,blockDays,blocks:Math.min(long.blocks,shifted.blocks),firstBlocks:Math.min(long.first,shifted.first),otherBlocks:Math.min(long.other,shifted.other),weekBlocks:week.blocks,episodes,dayVariation:day.se,weekVariation:week.se,timeAdjusted}
}
