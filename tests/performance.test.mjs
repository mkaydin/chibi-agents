import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeFrames} from '../web/performance.js';
test('performance reports distinguish paused previews from measured frame pacing',()=>{
 const result=summarizeFrames([16,17,16,40,NaN],100);assert.equal(result.frames,4);assert.equal(result.fps,40);assert.equal(result.p95FrameMs,40);
 const paused=summarizeFrames([],10000,true);assert.equal(paused.fps,0);assert.equal(paused.p95FrameMs,null);assert.equal(paused.paused,true);
});
