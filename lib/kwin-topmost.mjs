import {execFile} from 'node:child_process';
import {promisify} from 'node:util';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const execute=promisify(execFile);
export function topmostScript(pid,windows,bridge=null){
 const choices=Object.fromEntries([...windows].map(([title,value])=>[title,typeof value==='object'?value:{above:value}]));
 return `// Companion Studio: temporary process-scoped desktop policy.
const owners=${JSON.stringify(Array.isArray(pid)?pid:[pid])}, choices=${JSON.stringify(choices)}, bridge=${JSON.stringify(bridge)};
function owned(w){return owners.indexOf(Number(w.pid))!==-1 && Object.prototype.hasOwnProperty.call(choices,String(w.caption));}
function geometry(w){if(!bridge || !owned(w) || !w.frameGeometry)return;const g=w.frameGeometry;callDBus(bridge.service,'/CompanionDesktop','org.local.CompanionDesktop','Geometry',String(w.caption),Number(g.x),Number(g.y),Number(g.width),Number(g.height),bridge.token);}
function setup(w){
 if(!owned(w))return;
 const config=choices[String(w.caption)];w.keepAbove=Boolean(config.above);
 if(config.position && w.frameGeometry){const g=w.frameGeometry;w.frameGeometry={x:config.position.x,y:config.position.y,width:g.width,height:g.height};}
 geometry(w);
 if(bridge && w.frameGeometryChanged)w.frameGeometryChanged.connect(function(){geometry(w);});
}
function watch(w){setup(w);if(w.captionChanged)w.captionChanged.connect(function(){if(owned(w))setup(w);});}
workspace.windowList().forEach(watch);workspace.windowAdded.connect(watch);
if(bridge && workspace.cursorPosChanged){
 let last=0,inside={};
 workspace.cursorPosChanged.connect(function(){const p=workspace.cursorPos,now=Date.now();
  workspace.windowList().forEach(function(w){if(!owned(w)||!w.frameGeometry)return;const title=String(w.caption),g=w.frameGeometry;
   const hit=!w.minimized && p.x>=g.x && p.x<=g.x+g.width && p.y>=g.y && p.y<=g.y+g.height;
   const area=workspace.virtualScreenGeometry || (w.output && w.output.geometry) || g;
   const nx=Math.max(-1,Math.min(1,(p.x-area.x)/Math.max(1,area.width)*2-1)),ny=Math.max(-1,Math.min(1,1-(p.y-area.y)/Math.max(1,area.height)*2));
   if(now-last>=90 || hit!==Boolean(inside[title])){callDBus(bridge.service,'/CompanionDesktop','org.local.CompanionDesktop','Pointer',title,Number(p.x-g.x),Number(p.y-g.y),nx,ny,bridge.token);inside[title]=hit;}
  });if(now-last>=90)last=now;
 });
}
`;
}
export class KWinTopmost{
 constructor({enabled=false,pid=process.pid,getPids=()=>[pid],run=execute,onStatus=()=>{},relay=null}={}){this.relay=relay;this.bridge=null;this.bridgeError=null;this.enabled=enabled;this.pid=pid;this.getPids=getPids;this.run=run;this.onStatus=onStatus;this.windows=new Map();this.chain=Promise.resolve();this.name=`companion-studio-topmost-${pid}`;this.directory=null;this.closed=false;}
 update(title,value){if(!this.enabled||this.closed)return;const previous=this.windows.get(title);this.windows.set(title,{...(typeof previous==='object'?previous:{}),above:Boolean(value)});this.queue();}
 position(title,position,{apply=true}={}){if(!this.enabled||this.closed)return;const previous=this.windows.get(title);this.windows.set(title,{...(typeof previous==='object'?previous:{above:Boolean(previous)}),position});if(apply)this.queue();}
 remove(title){if(!this.enabled||this.closed)return;this.windows.delete(title);this.queue();}
 queue(){this.chain=this.chain.catch(()=>{}).then(()=>this.apply()).catch(error=>this.onStatus({backend:'kwin',active:false,error:`KDE keep-above unavailable: ${error.message}`}));}
 async call(...args){return this.run('qdbus6',['org.kde.KWin',...args],{timeout:3000,maxBuffer:65536});}
 async apply(){
  if(this.closed)return;
  this.directory ||= await mkdtemp(join(tmpdir(),'companion-kwin-'));
  if(this.relay && !this.bridge && !this.bridgeError){try{this.bridge=await this.relay.start();}catch(error){this.bridgeError=`Position/hover relay unavailable: ${error.message}`;}}
  const file=join(this.directory,'topmost.js');await writeFile(file,topmostScript(this.getPids(),this.windows,this.bridge),{mode:0o600});
  await this.call('/Scripting','org.kde.kwin.Scripting.unloadScript',this.name);
  const result=await this.call('/Scripting','org.kde.kwin.Scripting.loadScript',file,this.name);
  if(!/^\d+$/.test(result.stdout.trim()))throw new Error('KWin did not load the window script');
  await this.call('/Scripting','org.kde.kwin.Scripting.start');
  this.onStatus({backend:'kwin',active:true,error:this.bridgeError});
 }
 async stop(){this.closed=true;this.relay?.stop();await this.chain;try{if(this.directory)await this.call('/Scripting','org.kde.kwin.Scripting.unloadScript',this.name);}finally{if(this.directory)await rm(this.directory,{recursive:true,force:true});}}
}
