import { EventEmitter } from 'node:events';
export function previewBounds(value, size) {
  if(!value || !['x','y','width','height'].every(k=>Number.isFinite(value[k])))throw new Error('Invalid preview bounds');
  const x=Math.max(0,Math.min(size.width,Math.round(value.x))), y=Math.max(0,Math.min(size.height,Math.round(value.y)));
  return {x,y,width:Math.max(0,Math.min(size.width-x,Math.round(value.width))),height:Math.max(0,Math.min(size.height-y,Math.round(value.height)))};
}
// Exposes the small native-window interface used by avatar-session, while
// keeping the studio renderer isolated from the controls renderer.
export function createPreviewHost(parent, view) {
  const host=new EventEmitter();let bounds={x:0,y:0,width:520,height:720}, active=false, wanted=true, dead=false;
  parent.contentView.addChildView(view);view.setBounds(bounds);view.setVisible(false);
  const update=()=> {const visible=active && wanted && parent.isVisible() && !parent.isMinimized?.();view.setVisible(visible);if(!dead)view.webContents.send('companion:event',{type:'command',command:{type:'preview-active',value:visible}});};
  parent.on('show',update);parent.on('hide',update);parent.on('minimize',update);parent.on('restore',update);
  Object.assign(host,{
    embedded:true,webContents:view.webContents,
    loadURL:url=>view.webContents.loadURL(url),
    show:()=>{wanted=true;update();},hide:()=>{wanted=false;update();},isVisible:()=>view.getVisible(),
    moveTop:()=>{},center:()=>{},setAlwaysOnTop:()=>{},setIgnoreMouseEvents:()=>{},
    getBounds:()=>bounds,
    setBackground(value){view.setBackgroundColor(value==='solid'?'#202434':'#00000000');},
    viewport(value){bounds=previewBounds(value,parent.getContentBounds());active=value.visible===true && bounds.width>=32 && bounds.height>=32;view.setBounds(bounds);update();},
    destroy(){dead=true;parent.off('show',update);parent.off('hide',update);parent.off('minimize',update);parent.off('restore',update);parent.contentView.removeChildView(view);if(!view.webContents.isDestroyed())view.webContents.close();},
  });return host;
}
