import test from 'node:test';import assert from 'node:assert/strict';import {WorkPosePool} from '../lib/work-pose.mjs';
test('work setups are shuffled in balanced pairs',()=>{for(const random of [()=>0,()=>.9]){const pool=new WorkPosePool(random);for(let i=0;i<5;i++)assert.deepEqual(new Set([pool.next(),pool.next()]),new Set(['keyboard-full','keyboard-half']));}});
