import { calibrationHistory } from './statisticalCalibration.testSupport'
import type { FactorDef, StatSession } from './statsData'
export const methodFactor:FactorDef={key:'field:24',semanticKey:'methods',label:'Study methods used',group:'detail',options:['Re-reading','Self-testing'],multi:true}
export const environmentFactor:FactorDef={key:'field:6',semanticKey:'place',label:'Place',group:'setup',options:['Library','Home'],multi:false}
/** Eight months, repeated days, realistic bounded self-ratings and fixed activity.
 * Immediate ease is planted; no delayed performance is present in Stats data. */
export function policyHistory(factor:FactorDef=methodFactor,choice=factor.options[0]):StatSession[]{
 return calibrationHistory(81031,240).map(s=>{
  const day=Math.floor((Date.parse(s.day+'T00:00:00Z')-Date.UTC(2026,0,1))/86400000),yes=day%2===0,value=yes?4+(s.id%3===0?1:0):1+(s.id%3===0?1:0)
  return {...s,itemId:1,itemIds:[1],activity:'problems',outcomes:{focus:value,recall:value},factors:{[factor.key]:[yes?choice:factor.options.find(o=>o!==choice)??'Other']}}
 })
}
