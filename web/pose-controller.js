export const POSE_MODES=['auto','standing','keyboard-full','keyboard-half','controller','microphone'];
export function poseMode(choice,status,activity,sleeping,available,workPose='keyboard-full'){
 if(choice==='standing')return 'standing';
 let wanted=choice==='auto'?(status==='working'?(['keyboard-full','keyboard-half'].includes(workPose)?workPose:'keyboard-full'):'standing'):choice;
 if(choice==='auto' && status==='working' && !available.has(wanted))wanted=['keyboard-full','keyboard-half'].find(p=>available.has(p)) || 'standing';
 if(!available.has(wanted))wanted='standing';return wanted;
}
export function poseValues(mode,parameters,base){
 const bounds=new Map(parameters.map(p=>[p.id,p])),result={};
 for(const [id,offset] of Object.entries({ModeChange:mode==='controller'?-1:mode.startsWith('keyboard')?1:0,ParamKeyboardPosition:mode==='keyboard-full'?.5:0,ParamPanelper:0,ParamArmRPose:mode==='microphone'?1:0})){
  const p=bounds.get(id);if(!p)continue;const value=(base(id) ?? p.default)+offset;result[id]=Math.max(p.min,Math.min(p.max,value));
 }
 return result;
}
export function compatibleRecovered(motions,parameters){
 const bounds=new Map(parameters.map(p=>[p.id,p]));
 return motions.filter(m=>m.recovered).map(m=>({group:m.group,index:m.index,supported:m.ranges.every(r=>{const p=bounds.get(r.id);return p&&r.values.every(v=>v>=p.min-1e-5&&v<=p.max+1e-5);})}));
}
// Symbolic activity animation, independent of actual desktop key presses.
export function propAccent(mode,status,time){
 if(status!=='working')return null;
 if(mode==='controller'){const t=time%2.4;return t<.18?{parameter:'CtrRDown',weight:Math.sin(Math.PI*t/.18)}:null;}
 if(!mode.startsWith('keyboard'))return null;
 const t=time%1.1,slot=Math.floor(time/1.1)%4;
 return t<.25?{expression:['Key1','Key2','KeyA','KeyD'][slot],weight:Math.sin(Math.PI*t/.25)}:null;
}

export class MousePropTracker{
 constructor(){this.x=0;this.y=0;this.target={x:0,y:0};}
 point(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return;this.target={x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};}
 step(delta){const blend=1-Math.exp(-Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0))*9);this.x+=(this.target.x-this.x)*blend;this.y+=(this.target.y-this.y)*blend;return {x:this.x,y:this.y};}
}

// Agent activity only: never reads physical keys. Catalog entries are Core-validated.
export class TypingController{
 constructor(seed,catalog,parameters){
  let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);
  this.random=()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
  const bounds=new Map(parameters.map(p=>[p.id,p]));
  this.keys=catalog.filter(e=>/^Key(?:[A-Z]|[0-9])$/.test(e.name)&&e.supported&&e.parameters.length&&e.parameters.every(v=>{const p=bounds.get(v.Id);return p&&v.Blend==='Add'&&Number.isFinite(v.Value)&&p.default+v.Value>=p.min&&p.default+v.Value<=p.max;})).map(e=>({...e,right:e.parameters.some(p=>/^ParamhandR/.test(p.Id))}));
  this.clear();
 }
 clear(){this.key=null;this.age=0;this.wait=.1+this.random()*.7;this.remaining=0;this.mode=null;}
 step(delta,mode,status){
  if(status!=='working'||!mode.startsWith('keyboard')){if(this.mode!==null)this.clear();return null;}
  if(this.mode!==mode){this.clear();this.mode=mode;}
  const dt=Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0));
  if(this.key){this.age+=dt;if(this.age<this.duration)return {expression:this.key.name,weight:Math.sin(Math.PI*this.age/this.duration)};this.key=null;this.wait=--this.remaining>0?.045+this.random()*.14:.65+this.random()*2.3;}
  this.wait-=dt;if(this.wait>0)return null;
  const keys=this.keys.filter(k=>mode==='keyboard-full'||!k.right);if(!keys.length)return null;
  if(this.remaining<=0)this.remaining=3+Math.floor(this.random()*7);
  this.key=keys[Math.floor(this.random()*keys.length)];this.duration=.12+this.random()*.16;this.age=0;
  return {expression:this.key.name,weight:0};
 }
}
