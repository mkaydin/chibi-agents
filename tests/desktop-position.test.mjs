import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {desktopPosition,projectLabel} from '../lib/desktop-position.mjs';import {createAvatarSession} from '../electron/avatar-session.mjs';
test('saved positions restore on negative monitors and recover safely when a monitor disappears',()=>{
 const size={width:400,height:600},primary={x:0,y:0,width:1920,height:1080},left={...primary,x:-1920};
 assert.deepEqual(desktopPosition({x:-1000,y:100},size,[primary,left]),{x:-1000,y:100});assert.deepEqual(desktopPosition({x:-1000,y:100},size,[primary]),{x:0,y:100});
 assert.deepEqual(desktopPosition({x:6000,y:4000},size,[primary]),{x:1520,y:480});assert.equal(desktopPosition({x:NaN,y:0},size,[primary]),null);
 assert.equal(projectLabel({cwd:'/Code/Ayla/src/',project:'Ayla'}),'Ayla');assert.equal(projectLabel({cwd:'C:\\Code\\Companions\\'}),'Companions');assert.equal(projectLabel({cwd:'/Code/Ayla'}),'Ayla');
});
test('compositor positions persist per agent and native Wayland zero coordinates do not overwrite them',async()=>{
 const hosts=[],positions=[],area={x:0,y:0,width:1920,height:1080};
 const make=(id,defaults={})=>createAvatarSession({id,label:id,defaults:{...defaults},position:0,onChange(){},persist:async()=>{},shared:{nativeWayland:true,models:new Map(),previewTextures:{clear(){}},area,displays:()=>[area,{...area,x:-1920}],root:'.',args:[],getCore:()=>null,origin:'http://localhost',topmostController:{update(){},remove(){},position:(...args)=>positions.push(args)},createWindow:(_kind,opts)=>{const h=new EventEmitter();h.webContents={send(){}};h.loadURL=async()=>{};h.getPosition=()=>[0,0];h.destroy=()=>{};h.options=opts;hosts.push(h);return h;}}});
 const a=make('a'),b=make('b');await Promise.all([a.ready,b.ready]);a.desktopGeometry({x:-900,y:140});a.avatar.emit('move');assert.deepEqual(a.preferences().windowPosition,{x:-900,y:140});assert.notDeepEqual(b.preferences().windowPosition,a.preferences().windowPosition);
 const restored=make('a-restored',a.preferences());await restored.ready;assert.equal(hosts.at(-1).options.x,-900);assert.equal(hosts.at(-1).options.y,140);assert.ok(positions.some(([,p])=>p.x===-900));
 a.setAgent({kind:'codex',label:'codex',pane:'w1:p1',cwd:'/Code/Ayla',status:'working'});assert.equal(a.state.label,'Ayla');assert.equal(a.state.agentKind,'codex');
 a.destroy();b.destroy();restored.destroy();
});
test('project names resolve repository roots rather than nested source folders',async()=>{
 const {mkdtemp,mkdir,rm,writeFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,basename}=await import('node:path'),{projectName}=await import('../lib/project-name.mjs');
 const root=await mkdtemp(join(tmpdir(),'companion-project-'));try{const cwd=join(root,'src','components');await mkdir(cwd,{recursive:true});await writeFile(join(root,'.git'),'gitdir: elsewhere');assert.equal(await projectName(cwd),basename(root));assert.equal(await projectName(cwd),basename(root));assert.equal(await projectName('relative/path'),'');}finally{await rm(root,{recursive:true,force:true});}
});
