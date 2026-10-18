export function desktopPosition(position,size,areas=[{x:0,y:0,width:1920,height:1080}]){
 if(!position || !Number.isFinite(position.x)||!Number.isFinite(position.y))return null;
 const valid=areas.filter(a=>[a.x,a.y,a.width,a.height].every(Number.isFinite)&&a.width>0&&a.height>0);if(!valid.length)return null;
 const center={x:position.x+size.width/2,y:position.y+size.height/2};
 const distance=a=>Math.hypot(center.x-Math.max(a.x,Math.min(a.x+a.width,center.x)),center.y-Math.max(a.y,Math.min(a.y+a.height,center.y)));
 const area=[...valid].sort((a,b)=>distance(a)-distance(b))[0];
 return {x:Math.round(Math.max(area.x,Math.min(area.x+Math.max(0,area.width-size.width),position.x))),y:Math.round(Math.max(area.y,Math.min(area.y+Math.max(0,area.height-size.height),position.y)))};
}
export function projectLabel(agent={}){
 const path=String(agent.cwd || '').replace(/\\/g,'/').replace(/\/+$/,'');
 const name=path.split('/').filter(Boolean).at(-1);
 return (agent.project || name || agent.label || agent.kind || 'Agent').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,80);
}
