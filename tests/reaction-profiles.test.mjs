import test from 'node:test';import assert from 'node:assert/strict';import {reactionPose} from '../web/reaction-profiles.js';import {LifeController} from '../web/life-controller.js';import {expressionFor} from '../lib/animation-policy.mjs';
test('distinct activities produce distinct gestures even without unique expression files',()=>{
 const actions=['working','thinking','reading','searching','editing','testing','running','done','blocked','error','notice'];
 const samples=actions.map(a=>JSON.stringify([reactionPose(a,.25),reactionPose(a,.55)]));assert.equal(new Set(samples).size,actions.length);
 for(const action of actions)for(let i=0;i<=100;i++){const p=reactionPose(action,i/100);for(const value of Object.values(p))assert.ok(Number.isFinite(value));assert.ok(Math.abs(p.nod)<=.1);assert.ok(Math.abs(p.gazeX)<=.4);}
 const expressions=['Loading','Idea','Question','Star','Sweating'].map(name=>({name}));assert.equal(expressionFor('thinking',expressions),'Idea');assert.equal(expressionFor('testing',expressions),'Loading');assert.equal(expressionFor('done',expressions),'Star');assert.equal(expressionFor('reading',expressions),null);assert.equal(expressionFor('editing',expressions),null);
});
test('hover notices are bounded, work without look-around, and respect Still and stronger reactions',()=>{
 const life=new LifeController('hover',{lookAround:false});assert.equal(life.hover(.5,.3),true);assert.ok(life.notice);assert.equal(life.hover(.5,.3),false);
 const pose=life.step(.1);assert.ok(pose.gazeX>0);assert.ok(pose.browL>0);for(let i=0;i<50;i++)life.step(.1);assert.equal(life.reaction,null);assert.equal(life.hover(-.5,0),true);
 life.react('error');life.lastHover=-Infinity;assert.equal(life.hover(.5,.3),true);assert.ok(life.notice);assert.equal(life.reaction.action,'error');life.configure({mode:'still'});assert.equal(life.hover(0,0),false);
 const disabled=new LifeController('disabled',{hoverNotice:false});assert.equal(disabled.hover(0,0),false);
});
