import test from 'node:test';import assert from 'node:assert/strict';
import {TypingController} from '../web/pose-controller.js';
const params=[{id:'ParamhandLX',min:-30,max:30,default:0},{id:'ParamhandRX',min:-30,max:30,default:0},{id:'key',min:0,max:1,default:0}];
const expression=(name,hand)=>({name,supported:true,parameters:[{Id:hand,Value:10,Blend:'Add'},{Id:'key',Value:1,Blend:'Add'}]});
const catalog=[expression('KeyA','ParamhandLX'),expression('KeyJ','ParamhandRX'),expression('Preset1','ParamhandLX'),{...expression('KeyB','ParamhandLX'),parameters:[{Id:'unknown',Value:1,Blend:'Add'}]}];
function sample(seed,mode){const typing=new TypingController(seed,catalog,params),out=[];for(let i=0;i<1800;i++)out.push(typing.step(1/30,mode,'working'));return out;}
test('typing uses both hands in full mode but preserves mouse hand in half mode',()=>{
 const full=sample('agent','keyboard-full'),half=sample('agent','keyboard-half');assert.deepEqual(new Set(full.filter(Boolean).map(a=>a.expression)),new Set(['KeyA','KeyJ']));assert.deepEqual(new Set(half.filter(Boolean).map(a=>a.expression)),new Set(['KeyA']));
 for(const a of full.filter(Boolean))assert.ok(a.weight>=0&&a.weight<=1);assert.ok(full.some(a=>a===null));
});
test('typing is repeatable per agent, varied between agents, and releases outside work',()=>{
 assert.deepEqual(sample('a','keyboard-full'),sample('a','keyboard-full'));assert.notDeepEqual(sample('a','keyboard-full'),sample('b','keyboard-full'));
 const typing=new TypingController('a',catalog,params);for(let i=0;i<100;i++)typing.step(.1,'keyboard-full','working');assert.equal(typing.step(.1,'keyboard-full','blocked'),null);assert.equal(typing.key,null);assert.equal(typing.step(.1,'standing','working'),null);
});
test('empty or incompatible typing catalogs are safe',()=>{const typing=new TypingController('a',[],params);for(let i=0;i<20;i++)assert.equal(typing.step(.1,'keyboard-half','working'),null);});
