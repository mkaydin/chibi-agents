import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAvatarSession } from '../electron/avatar-session.mjs';
function host() {
  const window = new EventEmitter(); window.sent = [];
  window.webContents = { send: (...args) => window.sent.push(args) };
  window.loadURL = async () => {}; window.setIgnoreMouseEvents = value => { window.ignored = value; };
  window.setAlwaysOnTop = () => {}; window.hide = () => {}; window.show = () => {}; window.center = () => {};
  window.destroy = () => { window.destroyed = true; };
  return window;
}
function session(id,extraShared={}) {
  return createAvatarSession({ id, label: id, defaults: { clickThroughSupported: true, scale: 1, fps: 30 }, shared: { models: new Map(), previewTextures: { clear() {} }, root: '.', args: [], smoke: false, area: { x:0, y:0, width:1920, height:1080 }, createWindow: host, origin: 'http://localhost', getCore: () => null,...extraShared }, position: 0, onChange: () => {}, persist: async () => {} });
}
test('desktop interaction state and speech commands are isolated per avatar', async () => {
  const a=session('a'), b=session('b'); await Promise.all([a.ready,b.ready]);
  a.command({ type:'click-through',value:true });
  assert.equal(a.state.clickThrough,true); assert.equal(b.state.clickThrough,undefined);
  assert.equal(a.avatar.ignored,true); assert.equal(b.avatar.ignored,undefined);
  a.command({ type:'message',text:'Agent A finished',lifetime:2000 });
  assert.equal(b.avatar.sent.length,0);
  assert.equal(a.avatar.sent.at(-1)[1].command.text,'Agent A finished');
  assert.throws(()=>a.command({type:'expression',name:'Uninstalled expression'}),/Unknown/);
  a.destroy(); b.destroy(); assert.equal(a.avatar.destroyed,true);
});
test('appearance history is per-session and reaction resets preserve persistent appearance',async()=>{
 const a=session('a'),b=session('b');await Promise.all([a.ready,b.ready]);
 a.state.parameters=[{id:'Hair',min:0,max:10,default:2,value:2}];b.state.parameters=[...a.state.parameters];
 a.command({type:'appearance',values:{Hair:3},editGroup:'drag'});
 a.command({type:'appearance',values:{Hair:4},editGroup:'drag'});
 assert.deepEqual(a.state.appearance,{Hair:4});assert.deepEqual(b.state.appearance,{});
 a.command({type:'reset'});assert.deepEqual(a.state.appearance,{Hair:4});
 a.command({type:'undo-appearance'});assert.deepEqual(a.state.appearance,{});
 a.command({type:'redo-appearance'});assert.deepEqual(a.state.appearance,{Hair:4});
 a.checkpoint();assert.equal(a.snapshot().dirty,false);
 a.command({type:'appearance',values:{Hair:6}});a.command({type:'revert-appearance'});
 assert.deepEqual(a.state.appearance,{Hair:4});
 a.command({type:'reset-appearance-fields',ids:['Hair']});assert.deepEqual(a.state.appearance,{});
 a.destroy();b.destroy();
});
test('draft changes remain separate from a saved workspace baseline and restore checkpoints',async()=>{
 const a=session('studio');await a.ready;a.state.parameters=[{id:'Hair',min:0,max:10,default:0,value:0}];
 a.command({type:'appearance',values:{Hair:2}});a.checkpoint('character-a');const saved=a.savedPreferences();
 a.command({type:'appearance',values:{Hair:4}});assert.equal(a.snapshot().dirty,true);assert.equal(a.savedPreferences().appearance.Hair,2);
 assert.equal(saved.appearance.Hair,2);assert.equal(a.preferences().appearance.Hair,4);a.command({type:'undo-appearance'});assert.equal(a.snapshot().dirty,false);a.destroy();
});
test('a newer load cancels its predecessor and invalid assets preserve the last good model',async t=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const root=await mkdtemp(join(tmpdir(),'chibi-session-load-'));let s;t.after(async()=>{s?.destroy();await rm(root,{recursive:true,force:true});});
 async function fixture(name){const dir=join(root,name);await mkdir(dir);await writeFile(join(dir,'rig.moc3'),'fixture');await writeFile(join(dir,'texture.png'),'fixture');const path=join(dir,name+'.model3.json');await writeFile(path,JSON.stringify({Version:3,FileReferences:{Moc:'rig.moc3',Textures:['texture.png']}}));return path;}
 const firstPath=await fixture('First'),secondPath=await fixture('Second'),win=host(),sent=[];let acknowledge=false;
 Object.assign(win,{isVisible:()=>true,getBounds:()=>({width:520,height:720}),moveTop:()=>{}});
 win.webContents.send=(channel,payload)=>{sent.push(payload);if(payload.type==='load' && acknowledge)queueMicrotask(()=>s.report({type:'loaded',id:payload.model.id,parameters:[{id:'Hair',min:0,max:10,default:0,value:0}],appearance:payload.model.initialAppearance || {}}));};
 s=createAvatarSession({id:'studio',label:'test',defaults:{visible:true,scale:1,fps:30},shared:{models:new Map(),previewTextures:{clear(){}},root,args:[],smoke:true,area:{x:0,y:0,width:1920,height:1080},createWindow:()=>win,origin:'http://localhost',getCore:()=>'/trusted/runtime'},position:0,onChange(){},persist:async()=>{}});
 await s.ready;const first=s.importModel(firstPath).then(()=>null,error=>error);
 const deadline=Date.now()+1000;while(!s.pending){if(Date.now()>deadline)throw new Error('Load did not start');await new Promise(r=>setTimeout(r,1));}
 acknowledge=true;await s.importModel(secondPath,{appearance:{Hair:4}});assert.match((await first).message,/superseded/);assert.equal(s.current.path,secondPath);assert.equal(s.state.appearance.Hair,4);
 assert.ok(sent.some(p=>p.type==='cancel-load'));
 await assert.rejects(s.importModel(join(root,'missing.model3.json')));assert.equal(s.current.path,secondPath);
});
test('desktop size changes are isolated, bounded and persisted independently of appearance',async()=>{
 const a=session('a'),b=session('b');await Promise.all([a.ready,b.ready]);let nativeSize;
 a.avatar.setSize=(width,height)=>{nativeSize={width,height};};a.command({type:'resize-window',width:260,height:360});
 assert.deepEqual(nativeSize,{width:260,height:360});assert.deepEqual(a.preferences().windowSize,nativeSize);assert.deepEqual(b.preferences().windowSize,{width:520,height:720});
 assert.deepEqual(a.savedPreferences().windowSize,nativeSize);assert.equal(a.snapshot().dirty,false);assert.throws(()=>a.command({type:'resize-window',width:NaN,height:200}),/Invalid/);a.destroy();b.destroy();
});
test('liveliness preferences are per agent, validate before assignment and do not modify saved appearance',async()=>{
 const a=session('a'),b=session('b');await Promise.all([a.ready,b.ready]);
 a.configure({life:{mode:'lively',temperament:'curious',blink:false}});assert.equal(a.preferences().life.mode,'lively');assert.equal(b.preferences().life.mode,'calm');
 assert.equal(a.savedPreferences().life.blink,false);assert.deepEqual(a.state.appearance,{});assert.equal(a.snapshot().dirty,false);
 assert.throws(()=>a.configure({life:{mode:'broken'}}),/Unknown/);assert.equal(a.state.life.mode,'lively');a.destroy();b.destroy();
});

test('working setup stays stable through activity changes and is picked again on next work session',async()=>{
 let picks=0;const a=session('pose',{nextWorkPose:()=>++picks%2?'keyboard-half':'keyboard-full'});await a.ready;
 a.setAgent({status:'working',kind:'codex',cwd:'/project',activity:'editing'});assert.equal(a.state.workPose,'keyboard-half');
 a.setAgent({status:'working',kind:'codex',cwd:'/project',activity:'reading'});assert.equal(picks,1);assert.equal(a.state.workPose,'keyboard-half');
 a.setAgent({status:'idle',kind:'codex',cwd:'/project'});a.setAgent({status:'working',kind:'codex',cwd:'/project'});assert.equal(picks,2);assert.equal(a.state.workPose,'keyboard-full');a.destroy();
});
