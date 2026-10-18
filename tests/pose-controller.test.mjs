import test from 'node:test';import assert from 'node:assert/strict';import {poseMode,poseValues,compatibleRecovered,propAccent,MousePropTracker} from '../web/pose-controller.js';
test('automatic props follow work and unsupported modes return to standing',()=>{
 const available=new Set(['keyboard-full','keyboard-half','controller']);assert.equal(poseMode('auto','working','editing',false,available),'keyboard-full');assert.equal(poseMode('auto','working','reading',false,available,'keyboard-half'),'keyboard-half');assert.equal(poseMode('auto','blocked','testing',false,available),'standing');assert.equal(poseMode('microphone','idle','idle',false,available),'standing');
 const p=[{id:'ModeChange',min:-1,max:1,default:0},{id:'ParamKeyboardPosition',min:0,max:1,default:0}];assert.deepEqual(poseValues('keyboard-full',p,()=>0),{ModeChange:1,ParamKeyboardPosition:.5});assert.deepEqual(poseValues('standing',p,()=>0),{ModeChange:0,ParamKeyboardPosition:0});
});
test('Core bounds gate clips and symbolic key/button accents release and stop outside work',()=>{
 const clips=[{recovered:true,group:'Recovered',index:0,ranges:[{id:'hand',values:[0,2]}]}];assert.equal(compatibleRecovered(clips,[{id:'hand',min:0,max:1}])[0].supported,false);
 assert.equal(propAccent('keyboard-full','idle',.1),null);assert.equal(propAccent('keyboard-full','working',.6),null);assert.equal(propAccent('controller','working',.6),null);
 const accent=propAccent('keyboard-full','working',.1);assert.equal(accent.expression,'Key1');assert.ok(accent.weight>0&&accent.weight<=1);
});

test('automatic work choice stays independent of activity and falls back to supported props',()=>{
 const both=new Set(['keyboard-full','keyboard-half']);for(const activity of ['reading','editing','testing'])assert.equal(poseMode('auto','working',activity,false,both,'keyboard-half'),'keyboard-half');
 assert.equal(poseMode('auto','working','editing',false,new Set(['keyboard-full']),'keyboard-half'),'keyboard-full');
});
test('mouse props smoothly follow bounded pointer targets and ignore invalid samples',()=>{
 const tracker=new MousePropTracker();tracker.point(2,-2);const first=tracker.step(.1);assert.ok(first.x>0&&first.x<1);assert.equal(first.y,-first.x);tracker.point(NaN,0);for(let i=0;i<30;i++)tracker.step(.1);assert.ok(tracker.x>.99);assert.ok(tracker.y<-.99);const x=tracker.x;tracker.step(NaN);assert.equal(tracker.x,x);
});
