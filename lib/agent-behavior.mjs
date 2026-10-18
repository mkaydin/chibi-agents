export function behaviorFromMessage(text) {
  if(typeof text!=='string')return null;
  text=text.replace(/\b(?:no|zero|0)\s+(?:errors?|failures?|failed)\b/gi,'');
  if(/\b(errors?|failed|failures?|exception|fatal)\b/i.test(text))return 'error';
  if(/\b(waiting|approval|permission|question|blocked|need help)\b|\?\s*$/.test(text.toLowerCase()))return 'blocked';
  if(/\b(done|complete[ds]?|success(?:ful(?:ly)?)?|passed|finished|fixed)\b/i.test(text))return 'done';
  if(/\b(reading|searching|running|building|testing|writing|editing|working|thinking)\b/i.test(text))return 'working';
  return null;
}
export class BehaviorLog {
  constructor(limit=60){this.limit=limit;this.entries=[];}
  add(kind,text,expression=null){
    const previous=this.entries.at(-1);if(previous?.kind===kind && previous.text===text && previous.expression===expression)return;
    this.entries.push({time:new Date().toISOString(),kind,text:String(text).slice(0,500),expression});if(this.entries.length>this.limit)this.entries.shift();
  }
  clear(){this.entries=[];}
}
