import test from 'node:test';import assert from 'node:assert/strict';
import {desktopSize} from '../lib/desktop-size.mjs';import {characterLayout,titlePosition} from '../web/desktop-layout.js';
test('native avatar size is bounded by the display while preserving large-window proportions',()=>{
 assert.deepEqual(desktopSize(1000,2000,{width:1920,height:1000}),{width:500,height:1000});
 assert.deepEqual(desktopSize(20,30),{width:160,height:180});assert.throws(()=>desktopSize(NaN,400),/Invalid/);
});
test('desktop layout reserves space above the character and titles follow its upper bound',()=>{
 const bounds={width:400,height:600,centerX:200,centerY:300};const layout=characterLayout(520,720,bounds);
 const top=layout.y;assert.ok(top>=46);assert.ok(layout.factor>0);
 const title=titlePosition({x:100,y:110,width:200,height:400},520,720,28);assert.deepEqual(title,{x:200,y:74});
 assert.equal(titlePosition({x:0,y:-40,width:100,height:100},160,180).y,4);
});
test('long project title pills remain fully inside the character window',()=>{
 const title=titlePosition({x:-80,y:120,width:100,height:300},520,720,42,240);assert.equal(title.x,128);assert.ok(title.x-120>=8);
});
