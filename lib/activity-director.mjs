export const ACTIVITIES=['idle','working','thinking','reading','searching','editing','testing','running','blocked','done','error','disconnected','greet','celebrate','sad'];
const phasePatterns=[['error',/\b(error|failed|failure|exception)\b/i],['testing',/\b(testing|tests?|pytest|vitest|jest)\b/i],['searching',/\b(searching|search|grep|research|lookup)\b/i],['reading',/\b(reading|read|inspect|review|analy[sz]ing)\b/i],['editing',/\b(editing|writing|patch|edit|write|coding)\b/i],['running',/\b(running|building|build|execute|command|shell)\b/i],['thinking',/\b(thinking|reasoning|planning|plan)\b/i]];
export function structuredActivity(agent){
 if(agent.status==='blocked'||agent.status==='disconnected')return agent.status;
 const labels=agent.stateLabels || {},tokens=agent.tokens || {};
 // Explicit activity metadata takes precedence over display labels. Never parse
 // terminal contents or arbitrary token values as commands.
 const value=[tokens.companion_activity,tokens.activity,tokens.phase,labels[agent.status],labels.activity,labels.phase].filter(v=>typeof v==='string').join(' ').slice(0,512);
 const phase=phasePatterns.find(([,pattern])=>pattern.test(value))?.[0];
 return agent.status==='working'?(phase || 'working'):agent.status==='done'?'done':agent.status || 'unknown';
}
export class ActivityDirector{
 constructor(seed='agent',now=()=>Date.now()){this.now=now;this.previous=null;this.lastAccent=0;this.lastActivity=null;this.lastCompletion=null;this.pulse=18000+[...String(seed)].reduce((n,c)=>n+c.charCodeAt(0),0)%12000;}
 update(agent){
  const now=this.now(),activity=structuredActivity(agent),previous=this.previous;
  const seq=Number.isSafeInteger(agent.completionSeq)?agent.completionSeq:null;
  const completed=Boolean(previous && seq!==null && (this.lastCompletion!==null?seq>this.lastCompletion:previous.status==='working'));
  const fallbackCompleted=Boolean(previous?.status==='working'&&agent.status==='idle'&&seq===null);
  let accent=null,source='herdr-status';
  if(completed||fallbackCompleted){accent='done';source=completed?'herdr-completion':'working-to-idle';}
  else if(activity!==this.lastActivity){accent=activity;source=activity!==agent.status?'herdr-metadata':'herdr-status';}
  else if(agent.status==='working'&&now-this.lastAccent>=this.pulse){accent=activity;source='working-pulse';}
  // Waiting wins over a concurrent completion update.
  if(agent.status==='blocked'&&accent==='done')accent='blocked';
  if(accent){this.lastAccent=now;this.lastActivity=activity;}
  if(seq!==null)this.lastCompletion=seq;
  this.previous={status:agent.status,completionSeq:seq};
  return {activity,accent,source};
 }
}
