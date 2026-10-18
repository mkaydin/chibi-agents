import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {topmostScript,KWinTopmost} from '../lib/kwin-topmost.mjs';
test('KWin helper changes only exact avatar titles owned by this process',()=>{
 const a={pid:42,caption:'Companion · one',keepAbove:false},b={pid:99,caption:a.caption,keepAbove:false},controls={pid:42,caption:'Companion Studio',keepAbove:false};let added;
 vm.runInNewContext(topmostScript(42,new Map([[a.caption,true]])),{workspace:{windowList:()=>[a,b,controls],windowAdded:{connect:fn=>{added=fn;}}}});
 assert.equal(a.keepAbove,true);assert.equal(b.keepAbove,false);assert.equal(controls.keepAbove,false);
 const next={pid:42,caption:a.caption,captionChanged:{connect(){}}};added(next);assert.equal(next.keepAbove,true);
 vm.runInNewContext(topmostScript(42,new Map([[a.caption,false]])),{workspace:{windowList:()=>[a],windowAdded:{connect(){}}}});assert.equal(a.keepAbove,false);
});
test('KWin lifecycle unloads/reloads its own script and surfaces transport failures',async()=>{
 const calls=[],statuses=[];const helper=new KWinTopmost({enabled:true,pid:123,run:async(bin,args)=>{calls.push([bin,...args]);return {stdout:args.includes('org.kde.kwin.Scripting.loadScript')?'7':'true'};},onStatus:s=>statuses.push(s)});
 helper.update('Companion · A',true);await helper.chain;assert.equal(statuses.at(-1).active,true);assert.ok(calls.every(c=>c[0]==='qdbus6'));await helper.stop();assert.ok(calls.at(-1).includes('org.kde.kwin.Scripting.unloadScript'));
 const failed=new KWinTopmost({enabled:true,onStatus:s=>statuses.push(s),run:async()=>{throw new Error('D-Bus unavailable');}});failed.update('Companion · A',true);await failed.chain;assert.equal(statuses.at(-1).active,false);assert.match(statuses.at(-1).error,/D-Bus/);await failed.stop().catch(()=>{});
});
test('KWin restores only owned geometry and reports local hover coordinates through its relay',()=>{
 const signals={},calls=[],window={pid:42,caption:'Companion · project',frameGeometry:{x:0,y:0,width:400,height:600},captionChanged:{connect(){}},frameGeometryChanged:{connect:fn=>{signals.geometry=fn;}}};
 const workspace={windowList:()=>[window],windowAdded:{connect(){}},virtualScreenGeometry:{x:0,y:0,width:1000,height:1000},cursorPos:{x:120,y:230},cursorPosChanged:{connect:fn=>{signals.pointer=fn;}}};
 vm.runInNewContext(topmostScript([42],new Map([[window.caption,{above:true,position:{x:100,y:200}}]]),{service:'org.test',token:'secret'}),{workspace,callDBus:(...args)=>calls.push(args),Date});
 assert.equal(window.frameGeometry.x,100);assert.equal(window.frameGeometry.y,200);assert.equal(window.keepAbove,true);assert.ok(calls.some(c=>c[3]==='Geometry'));
 signals.pointer();const pointer=calls.find(c=>c[3]==='Pointer');assert.equal(pointer[5],20);assert.equal(pointer[6],30);assert.equal(pointer[7],-.76);assert.equal(pointer[8],.54);
 workspace.cursorPos={x:0,y:0};signals.pointer();assert.ok(calls.some(c=>c[3]==='Pointer'&&c[5]===-100&&c[6]===-200));
});
