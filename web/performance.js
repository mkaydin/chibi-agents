export function summarizeFrames(samples,elapsedMs,paused=false){
  const sorted=samples.filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
  const percentile=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]:null;
  return {frames:sorted.length,elapsedMs,fps:elapsedMs>0?sorted.length*1000/elapsedMs:0,p50FrameMs:percentile(.5),p95FrameMs:percentile(.95),p99FrameMs:percentile(.99),paused};
}
