import {reactionPose} from './reaction-profiles.js';
export const LIFE_DEFAULTS=Object.freeze({mode:'calm',temperament:'relaxed',noticeCursor:false,hoverNotice:true,blink:true,lookAround:true,head:true,breathing:true,rest:false,restAfter:300,poseMode:'auto',propTheme:'original'});
export function lifeSettings(value={}){
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Invalid liveliness settings');
  const result={...LIFE_DEFAULTS,...value};
  if(!['auto','standing','keyboard-full','keyboard-half','controller','microphone'].includes(result.poseMode))throw new Error('Unknown prop mode');
  if(!['original','lavender','mint','amber'].includes(result.propTheme))throw new Error('Unknown prop theme');
  if(!['still','calm','lively'].includes(result.mode))throw new Error('Unknown liveliness mode');
  if(!['relaxed','curious','focused','playful'].includes(result.temperament))throw new Error('Unknown temperament');
  for(const key of ['noticeCursor','hoverNotice','blink','lookAround','head','breathing','rest'])if(typeof result[key]!=='boolean')throw new Error('Invalid liveliness toggle');
  if(![60,300,900].includes(result.restAfter))throw new Error('Invalid rest delay');return Object.fromEntries(Object.keys(LIFE_DEFAULTS).map(key=>[key,result[key]]));
}
function randomSeed(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const smooth=x=>x*x*(3-2*x);
export class LifeController{
  constructor(seed,settings={}){
    this.random=randomSeed(seed);this.settings=lifeSettings(settings);this.time=this.random()*100;this.phase=this.random()*Math.PI*2;
    this.blinkWait=2.5+this.random()*4;this.blinkTime=-1;this.doublePending=false;this.gazeWait=1+this.random()*4;this.gaze={x:0,y:0};this.headGaze={x:0,y:0};this.focus=0;this.waiting=0;this.target={x:0,y:0};this.status='idle';this.inactive=0;this.sleeping=false;this.reaction=null;this.cooldown=0;this.lastPriority=0;this.attention=null;this.activity='idle';this.lastHover=-Infinity;this.notice=null;
  }
  configure(value){this.settings=lifeSettings({...this.settings,...value});if(this.settings.mode==='still'){this.reaction=null;this.notice=null;this.blinkTime=-1;}}
  setStatus(value){if(value!==this.status){this.status=value;this.inactive=0;if(value==='working'||value==='blocked'||value==='done')this.sleeping=false;}}
  setActivity(value){this.activity=value;}
  attend(x,y){if(Number.isFinite(x)&&Number.isFinite(y))this.attention={x:Math.max(-.6,Math.min(.6,x))*.6,y:Math.max(-.5,Math.min(.5,y))*.45,left:1.5};}
  hover(x,y){if(!this.settings.hoverNotice || this.settings.mode==='still' || this.time-this.lastHover<4)return false;this.lastHover=this.time;this.attend(x,y);this.attention.notice=true;this.notice={age:0,duration:1.1};this.sleeping=false;this.inactive=0;return true;}
  react(action){
    if(this.settings.mode==='still')return;
    if(['idle','disconnected','unknown'].includes(action)){this.reaction=null;this.cooldown=0;this.lastPriority=0;return;}
    const priority={notice:2,thinking:1,reading:1,searching:1,editing:1,testing:1,running:1,working:1,done:2,celebrate:2,greet:2,blocked:3,error:4,sad:2}[action] || 1;
    if(this.reaction && this.reaction.priority>priority)return;
    if(this.cooldown>0 && priority<=this.lastPriority)return;this.lastPriority=priority;
    this.reaction={action,priority,age:0,duration:action==='notice'?.95:action==='blocked'?1.7:['reading','searching','testing'].includes(action)?1.8:1.2};this.cooldown=1.8;this.sleeping=false;this.inactive=0;
  }
  step(delta){
    const dt=Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0)),s=this.settings;
    this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
    if(['idle','disconnected','unknown'].includes(this.status))this.inactive+=dt;else this.inactive=0;
    this.sleeping=s.rest && this.inactive>=s.restAfter && s.mode!=='still';
    const active=s.mode!=='still'&&!this.sleeping,personality={relaxed:.8,curious:1,focused:.65,playful:1.15}[s.temperament],intensity=(s.mode==='lively'?1:.55)*personality;
    let blink=0;
    if(active&&s.blink){
      if(this.blinkTime<0){this.blinkWait-=dt;if(this.blinkWait<=0)this.blinkTime=0;}
      if(this.blinkTime>=0){this.blinkTime+=dt;const t=this.blinkTime;
        blink=t<.065?smooth(t/.065):t<.09?1:1-smooth(Math.min(1,(t-.09)/.105));
        if(t>=.195){this.blinkTime=-1;if(!this.doublePending&&this.random()<.12){this.doublePending=true;this.blinkWait=.14;}else{this.doublePending=false;this.blinkWait=2.5+this.random()*4;}}
      }
    }else{this.blinkTime=-1;this.blinkWait=Math.max(1,this.blinkWait);}
    if(active&&s.lookAround){this.gazeWait-=dt;if(this.gazeWait<=0){this.target={x:(this.random()*2-1)*.38,y:(this.random()*2-1)*.2};this.gazeWait=(2.5+this.random()*4)*(s.temperament==='curious'?.7:s.temperament==='focused'?1.5:1);}}
    else this.target={x:0,y:0};
    if(this.attention){this.attention.left-=dt;if(this.attention.left<=0)this.attention=null;else if(active&&(s.noticeCursor || this.attention.notice))this.target={x:this.attention.x,y:this.attention.y};}
    // State posture blends in and out; an activity change never snaps the face.
    const settle=1-Math.exp(-dt*2);
    this.focus+=((this.status==='working'?1:0)-this.focus)*settle;
    this.waiting+=((this.status==='blocked'?1:0)-this.waiting)*settle;
    const wander=1-this.focus*.8-this.waiting*.4;
    const targetX=this.target.x*wander,targetY=this.target.y*wander-this.focus*.12;
    const follow=1-Math.exp(-dt*2.8);this.gaze.x+=(targetX-this.gaze.x)*follow;this.gaze.y+=(targetY-this.gaze.y)*follow;
    const headFollow=1-Math.exp(-dt*1.2);
    this.headGaze.x+=(this.gaze.x-this.headGaze.x)*headFollow;this.headGaze.y+=(this.gaze.y-this.headGaze.y)*headFollow;
    let gesture=reactionPose(null,0);
    if(this.reaction){this.reaction.age+=dt;const t=this.reaction.age/this.reaction.duration;if(t>=1)this.reaction=null;else gesture=reactionPose(this.reaction.action,t);}
    if(this.notice){this.notice.age+=dt;if(this.notice.age>=this.notice.duration)this.notice=null;else {const notice=reactionPose('notice',this.notice.age/this.notice.duration);for(const id of ['nod','tilt','turn','gazeX','gazeY','browL','browR','mouth','browAngleL','browAngleR','browForm','mouthX'])gesture[id]+=notice[id];}}
    const gazeEnabled=s.lookAround || Boolean(this.attention?.notice) || Math.abs(this.gaze.x)+Math.abs(this.gaze.y)>.001;
    return {sleeping:this.sleeping,active,blink:active?blink:0,gazeX:active?((gazeEnabled?this.gaze.x*intensity:0)+gesture.gazeX):0,gazeY:active?((gazeEnabled?this.gaze.y*intensity:0)+gesture.gazeY):0,
      headX:active&&s.head?(Math.sin(this.time*.41+this.phase)*.025+this.headGaze.x*.12)*intensity+gesture.turn:0,
      headY:active&&s.head?(Math.sin(this.time*.29+this.phase)*.018+this.headGaze.y*.1)*intensity+gesture.nod:0,
      headZ:active&&s.head?(Math.sin(this.time*.23+this.phase)*.022+this.waiting*.016)*intensity+gesture.tilt:0,
      browL:gesture.browL,browR:gesture.browR,mouth:gesture.mouth,browAngleL:gesture.browAngleL,browAngleR:gesture.browAngleR,browForm:gesture.browForm,mouthX:gesture.mouthX,eyelid:gesture.eyelid,
      bodyX:active&&s.head?Math.sin(this.time*.19+this.phase)*.008*intensity:0,
      bodyZ:active&&s.head?Math.sin(this.time*.23+this.phase)*.006*intensity:0,
      breath:active&&s.breathing?(Math.sin(this.time*1.55+this.phase)*.5+.5)*.35:0};
  }
}
export const LIFE_CHANNELS=['ParamAngleX','ParamAngleY','ParamAngleZ','ParamEyeBallX','ParamEyeBallY','ParamBreath','ParamEyeLOpen','ParamEyeROpen','ParamBodyAngleX','ParamBodyAngleZ','ParamBrowLY','ParamBrowRY','ParamMouthForm','ParamBrowLAngle','ParamBrowRAngle','ParamBrowLForm','ParamBrowRForm','ParamMouthX'];
// Adapter for the pinned Pixi/Cubism update stages. No parameter writes are
// performed after physics, and Phy* output channels are never owned here.
export function attachLife(internal,parameters,controller,{base,clipChannels=()=>new Set(),onRest=()=>{},onFrame=()=>{}}={}){
  if(typeof internal.updateNaturalMovements!=='function'||typeof internal.on!=='function')throw new Error('Unsupported Cubism animation stages');
  const core=internal.coreModel,bounds=new Map(parameters.map(p=>[p.id,p])),original=internal.updateNaturalMovements,eyeBlink=internal.eyeBlink;
  let previousClip=new Set();
  const seed=()=>{const current=clipChannels();for(const id of previousClip)if(!current.has(id)&&!id.startsWith('Phy')){const p=bounds.get(id);if(p)core.setParameterValueById(id,base?.(id) ?? p.default ?? p.value);}previousClip=current;for(const id of LIFE_CHANNELS){const p=bounds.get(id);if(p)core.setParameterValueById(id,base?.(id) ?? p.default ?? p.value);}};
  if(bounds.has('ParamEyeLOpen')&&bounds.has('ParamEyeROpen'))internal.eyeBlink=null;
  let wasResting=false,wake=null;
  internal.on('beforeMotionUpdate',seed);
  internal.updateNaturalMovements=function(dt){
    const values=controller.step(dt/1000),owned=clipChannels();
    if(values.sleeping!==wasResting){if(wasResting)wake={age:0,values:new Map(LIFE_CHANNELS.filter(id=>bounds.has(id)).map(id=>[id,core.getParameterValueById(id)]))};wasResting=values.sleeping;onRest(wasResting);}
    if(!values.active)return;
    const write=(id,value,add=false)=>{const p=bounds.get(id);if(!p || owned.has(id))return;const existing=core.getParameterValueById(id);core.setParameterValueById(id,Math.max(p.min,Math.min(p.max,add?existing+value:value)));};
    const offset=(id,amount)=>{const p=bounds.get(id);if(p)write(id,(p.max-p.min)*amount,true);};
    offset('ParamAngleX',values.headX);offset('ParamAngleY',values.headY);offset('ParamAngleZ',values.headZ);
    offset('ParamBodyAngleX',values.bodyX ?? 0);offset('ParamBodyAngleZ',values.bodyZ ?? 0);
    offset('ParamEyeBallX',values.gazeX*.5);offset('ParamEyeBallY',values.gazeY*.5);
    offset('ParamBrowLY',values.browL || 0);offset('ParamBrowRY',values.browR || 0);offset('ParamMouthForm',values.mouth || 0);
    offset('ParamBrowLAngle',values.browAngleL || 0);offset('ParamBrowRAngle',values.browAngleR || 0);offset('ParamBrowLForm',values.browForm || 0);offset('ParamBrowRForm',values.browForm || 0);offset('ParamMouthX',values.mouthX || 0);
    const breath=bounds.get('ParamBreath');if(breath)write('ParamBreath',(base?.('ParamBreath') ?? breath.default ?? 0)+(breath.max-breath.min)*values.breath);
    for(const id of ['ParamEyeLOpen','ParamEyeROpen'])if(bounds.has(id))write(id,core.getParameterValueById(id)*(1-values.blink)*(values.eyelid ?? 1));
    onFrame(values,controller.time,Math.max(0,Math.min(.1,dt/1000)));
    if(wake){wake.age+=Math.min(.1,dt/1000);const blend=smooth(Math.min(1,wake.age/.6));for(const [id,start] of wake.values)if(!owned.has(id))write(id,start+(core.getParameterValueById(id)-start)*blend);if(blend>=1)wake=null;}
  };
  let disposed=false;return ()=>{if(disposed)return;disposed=true;internal.off('beforeMotionUpdate',seed);internal.updateNaturalMovements=original;internal.eyeBlink=eyeBlink;};
}
// Pixi's resetExpression intentionally remembers the previous expression for
// motion restoration. Activity expiry must clear that remembered identity too,
// otherwise requesting the same reaction again is treated as a no-op.
export function clearTransientExpression(manager){
  if(!manager)return;manager.resetExpression();
  if('defaultExpression' in manager){manager.currentExpression=manager.defaultExpression;manager.reserveExpressionIndex=-1;}
}
