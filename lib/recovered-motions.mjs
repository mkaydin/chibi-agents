import {readFile,stat,realpath} from 'node:fs/promises';
import {containedFile} from './model-library.mjs';
// Only these verified, short scalar mouse curves are admitted in the first phase.
// Snapshot their JSON into the session: serving never rereads an external path.
export async function attachRecoveredMouseMotions(model,folder){
 const root=await realpath(folder),clips=new Map();
 for(const button of ['L','M','R'])for(const phase of ['ON','OFF']){
  const name=`Mouse${button}_${phase}`,path=await containedFile(root,`${name}.motion3.json`);
  if((await stat(path)).size>65536)throw new Error('Recovered mouse clip is too large');
  const data=JSON.parse(await readFile(path,'utf8'));
  if(data.Version!==3 || data.Meta?.Duration!==.05 || !Array.isArray(data.Curves) || !data.Curves.length || data.Curves.length>2)throw new Error(`Invalid recovered clip: ${name}`);
  for(const c of data.Curves)if(c.Target!=='Parameter'||!['ParamMouseClick','ParamMouseButton'].includes(c.Id)||!Array.isArray(c.Segments)||c.Segments.length!==5||c.Segments[0]!==0||c.Segments[2]!==0||c.Segments[3]!==.05||c.Segments.some(v=>!Number.isFinite(v)))throw new Error(`Unsupported recovered curve: ${name}`);
  clips.set(name,data);
 }
 if(model.manifest.FileReferences.Motions.RecoveredMouse)throw new Error('Recovered mouse group already exists');
 model.motionAssets=new Map();model.manifest.FileReferences.Motions.RecoveredMouse=[];
 for(const [name,original] of clips){
  const data=structuredClone(original),release=clips.get(name.replace('_ON','_OFF'));
  if(name.endsWith('_ON')){
   for(const c of data.Curves){const off=release.Curves.find(r=>r.Id===c.Id);if(!off)throw new Error('Missing release curve');c.Segments.push(0,.25,off.Segments.at(-1));}
   data.Meta.Duration=.25;
  }
  data.Meta.Loop=false;data.Meta.CurveCount=data.Curves.length;data.Meta.TotalSegmentCount=data.Curves.reduce((n,c)=>n+(c.Segments.length-2)/3,0);data.Meta.TotalPointCount=data.Curves.reduce((n,c)=>n+1+(c.Segments.length-2)/3,0);
  const file=`recovered-mouse/${name}.motion3.json`,index=model.manifest.FileReferences.Motions.RecoveredMouse.length;
  model.motionAssets.set(file,JSON.stringify(data));model.manifest.FileReferences.Motions.RecoveredMouse.push({File:file,FadeInTime:0,FadeOutTime:0});
  model.motions.push({group:'RecoveredMouse',index,name:`${name}${name.endsWith('_ON')?' (auto release)':''}`,recovered:true,channels:data.Curves.map(c=>c.Id),ranges:data.Curves.map(c=>({id:c.Id,values:[c.Segments[1],c.Segments[4],c.Segments.at(-1)]}))});
 }
 return root;
}

// Parse Cubism segment arities; control point values are included in bounds checks.
export function curveInfo(curve){
 const s=curve.Segments;if(!Array.isArray(s)||s.length<2||s.some(v=>!Number.isFinite(v)))throw new Error('Invalid motion segments');
 const values=[s[1]];let points=1,segments=0,end=s[0],i=2;
 while(i<s.length){const kind=s[i++],count=kind===1?6:[0,2,3].includes(kind)?2:0;if(!count||i+count>s.length)throw new Error('Invalid motion segment type');for(let j=0;j<count;j+=2){if(s[i+j]<end)throw new Error('Motion times are not ordered');end=s[i+j];values.push(s[i+j+1]);points++;}i+=count;segments++;}
 return {values,points,segments,end};
}
export async function attachRecoveredTemplateMotions(model,expressionsFolder){
 await attachRecoveredMouseMotions(model,expressionsFolder);
 const source=await realpath(expressionsFolder),motionRoot=await realpath(`${source}/../Motions`);
 const refs=model.manifest.FileReferences.Motions;
 const originals=model.motions.filter(m=>m.name==='idle'||m.name==='idle_sleep');
 for(const mode of ['FULL','HALF','Controller'])for(const sleeping of [false,true]){
  const base=originals.find(m=>m.name===(sleeping?'idle_sleep':'idle'));if(!base)continue;
  const file=refs[base.group][base.index].File,baseData=JSON.parse(await readFile(model.allowed.get(file),'utf8'));
  const name=`idle ${mode}${sleeping?'_sleep':''}`,legacyFile=await containedFile(motionRoot,`${name}.motion3.json`);
  if((await stat(legacyFile)).size>1024*1024)throw new Error('Legacy pose clip is too large');
  const legacy=JSON.parse(await readFile(legacyFile,'utf8'));if(legacy.Version!==3||!Array.isArray(legacy.Curves)||legacy.Curves.length>256)throw new Error('Invalid legacy pose clip');
  const curves=new Map(baseData.Curves.filter(c=>c.Target==='Parameter').map(c=>[c.Id,c]));
  // Legacy part visibility was replaced by ModeChange in v2.0. Retain v2
  // accessory curves and replace only authored parameter curves, never parts.
  for(const c of legacy.Curves)if(c.Target==='Parameter')curves.set(c.Id,c);
  if(mode==='Controller' && !sleeping){
   const pose=model.expressions?.find(e=>e.name==='Mode Controller');
   for(const p of pose?.parameters || [])if(['ParamAngleX','ParamBodyAngleX'].includes(p.Id)&&Number.isFinite(p.Value)&&!curves.has(p.Id))curves.set(p.Id,{Target:'Parameter',Id:p.Id,Segments:[0,p.Value,0,baseData.Meta.Duration,p.Value]});
  }
  const data=structuredClone(baseData);data.Curves=[...curves.values()];
  const infos=data.Curves.map(curveInfo);data.Meta.Duration=Math.max(...infos.map(i=>i.end));data.Meta.Loop=true;data.Meta.CurveCount=data.Curves.length;data.Meta.TotalSegmentCount=infos.reduce((n,i)=>n+i.segments,0);data.Meta.TotalPointCount=infos.reduce((n,i)=>n+i.points,0);
  const group='RecoveredPoses',index=(refs[group] ||= []).length,asset=`recovered-poses/${name}.motion3.json`;
  model.motionAssets.set(asset,JSON.stringify(data));refs[group].push({File:asset,FadeInTime:.3,FadeOutTime:.3});
  model.motions.push({group,index,name,recovered:true,pose:mode==='FULL'?'keyboard-full':mode==='HALF'?'keyboard-half':'controller',sleeping,channels:data.Curves.map(c=>c.Id),ranges:data.Curves.map((c,i)=>({id:c.Id,values:infos[i].values}))});
 }
 return source;
}
export async function attachAlternateIdle(model,file){
 const source=await realpath(file);if((await stat(source)).size>1024*1024)throw new Error('Alternate idle is too large');
 const legacy=JSON.parse(await readFile(source,'utf8'));if(legacy.Version!==3||!Array.isArray(legacy.Curves)||legacy.Curves.length>256)throw new Error('Invalid alternate idle');
 const base=model.motions.find(m=>m.name==='idle');if(!base)return;
 const refs=model.manifest.FileReferences.Motions,original=JSON.parse(await readFile(model.allowed.get(refs[base.group][base.index].File),'utf8'));
 const curves=new Map(original.Curves.filter(c=>c.Target==='Parameter').map(c=>[c.Id,c]));for(const c of legacy.Curves)if(c.Target==='Parameter')curves.set(c.Id,c);
 const data=structuredClone(original);data.Curves=[...curves.values()];const info=data.Curves.map(curveInfo);Object.assign(data.Meta,{Duration:Math.max(...info.map(i=>i.end)),Loop:true,CurveCount:info.length,TotalSegmentCount:info.reduce((n,i)=>n+i.segments,0),TotalPointCount:info.reduce((n,i)=>n+i.points,0)});
 const asset='recovered-idle/alternate.motion3.json';model.motionAssets ||= new Map();model.motionAssets.set(asset,JSON.stringify(data));refs.RecoveredIdle=[{File:asset,FadeInTime:.3,FadeOutTime:.3}];
 model.motions.push({group:'RecoveredIdle',index:0,name:'Legacy alternate tail idle',recovered:true,channels:data.Curves.map(c=>c.Id),ranges:data.Curves.map((c,i)=>({id:c.Id,values:info[i].values}))});
}
