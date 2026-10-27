import { runStatsAnalysis, type StatsAnalysisJob } from '@core/statsAnalysis'

// Bundled local code only. No Electron bridge, files, telemetry or requests.
self.onmessage = (event: MessageEvent<StatsAnalysisJob>): void => {
  try { self.postMessage({ result: runStatsAnalysis(event.data) }) }
  catch { self.postMessage({ failed: true }) }
}
