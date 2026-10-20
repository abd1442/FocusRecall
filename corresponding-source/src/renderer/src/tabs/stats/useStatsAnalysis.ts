import { useEffect, useState } from 'react'
import type { StatsAnalysisJob, StatsAnalysisResult } from '@core/statsAnalysis'

export function useStatsAnalysis<J extends StatsAnalysisJob>(job: J | null): { result: StatsAnalysisResult<J> | null; failed: boolean; retry: () => void } {
  type Result=StatsAnalysisResult<J>
  const [attempt,setAttempt]=useState(0)
  const [completed,setCompleted]=useState<{job:J;result:Result|null;failed:boolean}|null>(null)
  useEffect(()=>{
    if(!job)return
    let worker:Worker|undefined,alive=true
    const fail=():void=>{if(alive)setCompleted({job,result:null,failed:true});worker?.terminate()}
    try {
      worker=new Worker(new URL('./statsAnalysis.worker.ts',import.meta.url),{type:'module'})
      worker.onmessage=(event:MessageEvent<{result?:Result;failed?:boolean}>):void=>{
        if(!alive)return
        if(event.data.failed||!event.data.result){fail();return}
        setCompleted({job,result:event.data.result,failed:false})
        worker?.terminate()
      }
      worker.onerror=fail
      worker.onmessageerror=fail
      worker.postMessage(job)
    }catch{fail()}
    // Cancel superseded computations instead of queueing filters or presenting
    // findings calculated for an old scope. No worker survives leaving Stats.
    return ()=>{alive=false;worker?.terminate()}
  },[job,attempt])
  return {result:completed?.job===job?completed.result:null,failed:completed?.job===job&&completed.failed,retry:()=>{setCompleted(null);setAttempt(v=>v+1)}}
}
