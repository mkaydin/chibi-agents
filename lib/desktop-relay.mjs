import {spawn} from 'node:child_process';import {randomUUID} from 'node:crypto';
export class DesktopRelay{
 constructor({script,onEvent=()=>{},launch=spawn}={}){this.script=script;this.onEvent=onEvent;this.launch=launch;this.stopped=false;this.pending=null;this.child=null;this.service=`org.local.CompanionDesktop.p${process.pid}`;this.token=randomUUID();}
 start(){
  if(this.pending)return this.pending;
  this.pending=new Promise((resolve,reject)=>{
   const child=this.launch('python3',['-u',this.script,this.service,this.token],{stdio:['pipe','pipe','pipe']});this.child=child;let buffer='',errorText='',ready=false;
   const timer=setTimeout(()=>{child.kill();reject(new Error('Desktop geometry relay timed out'));},3000);
   child.stderr.on('data',chunk=>{errorText=(errorText+chunk).slice(-1000);});
   child.on('error',error=>{clearTimeout(timer);reject(error);});
   child.on('exit',()=>{clearTimeout(timer);if(!ready)reject(new Error(errorText.trim() || 'Desktop geometry relay exited'));else if(!this.stopped)this.onEvent({type:'relay-error',message:'Desktop position/hover relay stopped. Restart the app to reconnect.'});});
   child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>65536){child.kill();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const event=JSON.parse(line);if(event.type==='ready'){ready=true;clearTimeout(timer);resolve({service:this.service,token:this.token});}else if(['geometry','pointer'].includes(event.type))this.onEvent(event);}catch{}}});
  });return this.pending;
 }
 stop(){this.stopped=true;this.child?.stdin.end();this.child?.kill();this.child=null;}
}
