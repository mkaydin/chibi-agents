import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {LifeController,attachLife,lifeSettings,LIFE_CHANNELS} from '../web/life-controller.js';
test('independent seeded agents blink, look around and remain within normalized movement limits',()=>{
 const a=new LifeController('agent-a'),b=new LifeController('agent-b'),a2=new LifeController('agent-a');let blinks=0,different=false;
 for(let i=0;i<1800;i++){
   const x=a.step(1/30),y=b.step(1/30),z=a2.step(1/30);assert.deepEqual(x,z);
   if(x.blink>.5)blinks++;if(Math.abs(x.headX-y.headX)>.001)different=true;
   assert.ok(x.blink>=0&&x.blink<=1);assert.ok(Math.abs(x.headX)<.15);assert.ok(Math.abs(x.gazeX)<.4);
 }
 assert.ok(blinks>5&&blinks<200);assert.equal(different,true);
});
test('pauses cannot generate catch-up bursts and Still disables automatic movement',()=>{
 const a=new LifeController('pause');const before=a.time;a.step(600);assert.ok(a.time-before<=.100001);
 a.configure({mode:'still'});a.react('done');const values=a.step(.03);assert.equal(values.active,false);assert.equal(values.blink,0);assert.equal(values.headX,0);assert.equal(a.reaction,null);
 assert.throws(()=>lifeSettings({mode:'wild'}),/Unknown/);assert.throws(()=>lifeSettings({blink:'yes'}),/toggle/);
});
test('rest requires sustained idle and blocked agents stay attentive; newer work wakes immediately',()=>{
 const a=new LifeController('rest',{rest:true,restAfter:60});for(let i=0;i<610;i++)a.step(.1);assert.equal(a.sleeping,true);
 a.setStatus('working');assert.equal(a.step(.03).sleeping,false);a.setStatus('blocked');for(let i=0;i<700;i++)a.step(.1);assert.equal(a.sleeping,false);
});
test('reaction bursts are throttled while important reactions can interrupt',()=>{
 const a=new LifeController('react');a.react('done');a.step(.5);const age=a.reaction.age;a.react('done');assert.equal(a.reaction.age,age);
 a.react('error');assert.equal(a.reaction.action,'error');a.react('working');assert.equal(a.reaction.action,'error');
});
test('adapter blinks during a clip, preserves expression openness, honors ownership and restores SDK methods',()=>{
 const internal=new EventEmitter(),values=new Map(),params=LIFE_CHANNELS.map(id=>({id,min:id.includes('Angle')?-30:0,max:id.includes('Angle')?30:2,default:id.includes('Open')?2:0}));
 internal.coreModel={getParameterValueById:id=>values.get(id) || 0,setParameterValueById:(id,value)=>values.set(id,value)};
 const original=()=>{},blink={};internal.updateNaturalMovements=original;internal.eyeBlink=blink;
 const controller=new LifeController('test');controller.step=()=>({active:true,sleeping:false,headX:.05,headY:0,headZ:0,gazeX:0,gazeY:0,breath:.1,blink:.5});
 const dispose=attachLife(internal,params,controller,{clipChannels:()=>new Set(['ParamAngleX'])});
 internal.emit('beforeMotionUpdate');values.set('ParamAngleX',7);values.set('ParamEyeLOpen',1);internal.updateNaturalMovements(33);
 assert.equal(values.get('ParamEyeLOpen'),.5);assert.equal(values.get('ParamEyeROpen'),1);assert.equal(values.get('ParamAngleX'),7);assert.equal(internal.eyeBlink,null);
 for(let i=0;i<100;i++){internal.emit('beforeMotionUpdate');internal.updateNaturalMovements(33);}assert.ok(values.get('ParamBreath')<=2);
 dispose();assert.equal(internal.updateNaturalMovements,original);assert.equal(internal.eyeBlink,blink);assert.equal(internal.listenerCount('beforeMotionUpdate'),0);
});
test('cursor attention is optional, bounded, expires, and different temperaments stay valid',()=>{
 const a=new LifeController('pointer',{noticeCursor:true,temperament:'curious'});a.attend(100,-100);
 for(let i=0;i<15;i++)a.step(.05);assert.ok(a.gaze.x>0);assert.ok(Math.abs(a.gaze.x)<.6);
 for(let i=0;i<40;i++)a.step(.05);assert.equal(a.attention,null);
 a.configure({temperament:'focused'});assert.equal(a.settings.temperament,'focused');assert.throws(()=>a.configure({temperament:'random'}),/Unknown/);
});
test('pinned SDK runs the procedural composition stage before physics and final Core update',async()=>{
 const {createRequire}=await import('node:module');const {readFile}=await import('node:fs/promises');const require=createRequire(import.meta.url);
 const code=await readFile(require.resolve('pixi-live2d-display/cubism4'),'utf8');
 const start=code.indexOf('this.emit("beforeMotionUpdate")'),end=code.indexOf('model.loadParameters();',start),update=code.slice(start,end);
 assert.ok(start>=0&&end>start);assert.ok(update.indexOf('this.updateNaturalMovements')<update.indexOf('this.physics'));assert.ok(update.indexOf('this.physics')<update.indexOf('model.update()'));
});
test('ending a sleep or pose clip clears its orphaned face channels without touching physics outputs',()=>{
 const internal=new EventEmitter(),values=new Map([['ParamBrowLY',0],['PhyHair',.4]]);internal.coreModel={getParameterValueById:id=>values.get(id)||0,setParameterValueById:(id,value)=>values.set(id,value)};internal.updateNaturalMovements=()=>{};
 let owned=new Set(['ParamBrowLY','PhyHair']);const dispose=attachLife(internal,[{id:'ParamBrowLY',min:-1,max:1,default:0},{id:'PhyHair',min:-1,max:1,default:0}],new LifeController('ownership'),{clipChannels:()=>owned});
 internal.emit('beforeMotionUpdate');values.set('ParamBrowLY',-1);values.set('PhyHair',.6);owned=new Set();internal.emit('beforeMotionUpdate');assert.equal(values.get('ParamBrowLY'),0);assert.equal(values.get('PhyHair'),.6);dispose();
});
test('expired expressions clear the SDK remembered identity so the same reaction can play again',async()=>{
 const {clearTransientExpression}=await import('../web/life-controller.js');const neutral={},reaction={},manager={defaultExpression:neutral,currentExpression:reaction,reserveExpressionIndex:5,resetExpression(){this.faded=true;}};
 clearTransientExpression(manager);assert.equal(manager.faded,true);assert.equal(manager.currentExpression,neutral);assert.equal(manager.reserveExpressionIndex,-1);
});
test('working settles gaze, waiting stays attentive, and state posture fades back to idle',()=>{
 const idle=new LifeController('state'),working=new LifeController('state');working.setStatus('working');
 let idleTravel=0,workTravel=0,oldIdle=0,oldWork=0;
 for(let i=0;i<1800;i++){const a=idle.step(1/30),b=working.step(1/30);if(i>150){idleTravel+=Math.abs(a.gazeX-oldIdle);workTravel+=Math.abs(b.gazeX-oldWork);}oldIdle=a.gazeX;oldWork=b.gazeX;}
 assert.ok(workTravel<idleTravel*.3);assert.ok(working.focus>.99);
 working.setStatus('blocked');working.step(.03);assert.ok(working.focus>.9,'focus fades instead of snapping');
 for(let i=0;i<100;i++)working.step(.1);assert.ok(working.waiting>.99);assert.equal(working.sleeping,false);
 working.setStatus('idle');for(let i=0;i<100;i++)working.step(.1);assert.ok(working.waiting<.001);assert.ok(working.focus<.001);
});
test('eyes lead the head and secondary posture stays bounded and disables with head movement',()=>{
 const a=new LifeController('lag',{noticeCursor:true});a.attend(.6,.3);a.step(.1);
 assert.ok(a.gaze.x>a.headGaze.x&&a.headGaze.x>0);
 for(let i=0;i<1000;i++){const v=a.step(1/30);assert.ok(Math.abs(v.bodyX)<=.01);assert.ok(Math.abs(v.bodyZ)<=.01);}
 a.configure({head:false});const v=a.step(.03);assert.equal(v.bodyX,0);assert.equal(v.bodyZ,0);assert.equal(v.headX,0);
});
test('facial accents clamp to Core bounds and respect authored clip ownership',()=>{
 const internal=new EventEmitter(),values=new Map(),params=['ParamBrowLAngle','ParamBrowRForm','ParamMouthX'].map(id=>({id,min:-1,max:1,default:0}));internal.coreModel={getParameterValueById:id=>values.get(id)||0,setParameterValueById:(id,v)=>values.set(id,v)};internal.updateNaturalMovements=()=>{};
 const controller=new LifeController('face');controller.step=()=>({active:true,sleeping:false,headX:0,headY:0,headZ:0,gazeX:0,gazeY:0,breath:0,blink:0,browAngleL:10,browForm:-10,mouthX:.03});
 const dispose=attachLife(internal,params,controller,{clipChannels:()=>new Set(['ParamMouthX'])});internal.emit('beforeMotionUpdate');values.set('ParamMouthX',.4);internal.updateNaturalMovements(33);assert.equal(values.get('ParamBrowLAngle'),1);assert.equal(values.get('ParamBrowRForm'),-1);assert.equal(values.get('ParamMouthX'),.4);dispose();
});
