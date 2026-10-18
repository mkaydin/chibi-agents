import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {attachRecoveredMouseMotions} from '../lib/recovered-motions.mjs';
async function fixture(){const folder=await mkdtemp(join(tmpdir(),'recovered-motions-'));for(const b of ['L','M','R'])for(const p of ['ON','OFF'])await writeFile(join(folder,`Mouse${b}_${p}.motion3.json`),JSON.stringify({Version:3,Meta:{Duration:.05,Loop:true},Curves:[{Target:'Parameter',Id:'ParamMouseClick',Segments:[0,p==='ON'?0:1,0,.05,p==='ON'?1:0]}]}));return folder;}
const model=()=>({manifest:{FileReferences:{Motions:{Idle:[{File:'idle.motion3.json'}]}}},motions:[{group:'Idle',index:0,name:'idle'}]});
test('recovered press clips release, remain non-looping and preserve existing motion catalogs',async()=>{
 const folder=await fixture();try{const m=model();await attachRecoveredMouseMotions(m,folder);assert.equal(m.motions.length,7);assert.equal(m.manifest.FileReferences.Motions.Idle[0].File,'idle.motion3.json');
 const press=JSON.parse(m.motionAssets.get('recovered-mouse/MouseL_ON.motion3.json'));assert.equal(press.Meta.Loop,false);assert.equal(press.Meta.Duration,.25);assert.equal(press.Curves[0].Segments.at(-1),0);assert.equal(press.Meta.TotalSegmentCount,2);assert.equal(press.Meta.TotalPointCount,3);
 const off=JSON.parse(m.motionAssets.get('recovered-mouse/MouseL_OFF.motion3.json'));assert.equal(off.Meta.Loop,false);assert.equal(off.Meta.Duration,.05);
 await writeFile(join(folder,'MouseL_ON.motion3.json'),'changed');assert.equal(JSON.parse(m.motionAssets.get('recovered-mouse/MouseL_ON.motion3.json')).Version,3,'snapshot stays stable after external edits');
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('unexpected recovered channels and incomplete imports are rejected before changing the model',async()=>{
 const folder=await fixture();try{const m=model();await writeFile(join(folder,'MouseR_OFF.motion3.json'),JSON.stringify({Version:3,Meta:{Duration:.05},Curves:[{Target:'Parameter',Id:'PhyHair',Segments:[0,0,0,.05,1]}]}));await assert.rejects(attachRecoveredMouseMotions(m,folder),/Unsupported/);assert.equal(m.motionAssets,undefined);assert.equal(m.motions.length,1);
 await rm(join(folder,'MouseR_OFF.motion3.json'));await assert.rejects(attachRecoveredMouseMotions(m,folder));assert.equal(m.motionAssets,undefined);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('recovered poses retain new accessory curves and discard legacy part visibility',async()=>{
 const {attachRecoveredTemplateMotions,curveInfo}=await import('../lib/recovered-motions.mjs');
 const folder=await fixture();try{
 // The adapter intentionally resolves ../Motions, so use a separate package root.
 const packageRoot=join(folder,'package'),expressions=join(packageRoot,'Expressions'),legacy=join(packageRoot,'Motions');await mkdir(expressions,{recursive:true});await mkdir(legacy);
 const {copyFile}=await import('node:fs/promises');for(const b of ['L','M','R'])for(const p of ['ON','OFF'])await copyFile(join(folder,`Mouse${b}_${p}.motion3.json`),join(expressions,`Mouse${b}_${p}.motion3.json`));
 const current={Version:3,Meta:{Duration:1,Loop:true},Curves:[{Target:'Parameter',Id:'ParamEarWing1',Segments:[0,0,0,1,1]},{Target:'Parameter',Id:'ParamhandLX',Segments:[0,0,0,1,0]}]};
 const base=join(folder,'idle.motion3.json');await writeFile(base,JSON.stringify(current));
 const m={manifest:{FileReferences:{Motions:{Imported:[{File:'idle.motion3.json'},{File:'idle_sleep.motion3.json'}]}}},allowed:new Map([['idle.motion3.json',base],['idle_sleep.motion3.json',base]]),motions:[{name:'idle',group:'Imported',index:0},{name:'idle_sleep',group:'Imported',index:1}]};
 for(const mode of ['FULL','HALF','Controller'])for(const sleep of ['', '_sleep'])await writeFile(join(legacy,`idle ${mode}${sleep}.motion3.json`),JSON.stringify({Version:3,Curves:[{Target:'Parameter',Id:'ParamhandLX',Segments:[0,2,0,1,2]},{Target:'PartOpacity',Id:'old-part',Segments:[0,0,0,1,0]}]}));
 await attachRecoveredTemplateMotions(m,expressions);assert.equal(m.motions.filter(c=>c.recovered).length,12);
 const pose=JSON.parse(m.motionAssets.get('recovered-poses/idle FULL.motion3.json'));assert.deepEqual(pose.Curves.find(c=>c.Id==='ParamEarWing1'),current.Curves[0]);assert.equal(pose.Curves.find(c=>c.Id==='ParamhandLX').Segments[1],2);assert.ok(pose.Curves.every(c=>c.Target==='Parameter'));
 assert.throws(()=>curveInfo({Segments:[0,0,9,1,1]}),/segment type/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
