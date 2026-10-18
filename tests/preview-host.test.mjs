import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createPreviewHost,previewBounds } from '../electron/preview-host.mjs';
test('preview bounds remain inside the native parent and reject malformed rectangles',()=>{
 assert.deepEqual(previewBounds({x:-20,y:30,width:900,height:800},{width:600,height:500}),{x:0,y:30,width:600,height:470});
 assert.throws(()=>previewBounds({x:NaN},{width:600,height:500}),/Invalid/);
});
test('embedded renderer pauses on hide, resumes on show, and is destroyed with its host',()=>{
 const parent=new EventEmitter();let shown=true,attached=false,visible=false,closed=false;const commands=[];
 Object.assign(parent,{isVisible:()=>shown,getContentBounds:()=>({width:1000,height:800}),contentView:{addChildView(){attached=true;},removeChildView(){attached=false;}}});
 const view={getVisible:()=>visible,setVisible:value=>{visible=value;},setBounds(){},webContents:{send:(name,value)=>commands.push(value.command),isDestroyed:()=>false,close:()=>{closed=true;},loadURL:async()=>{}}};
 const host=createPreviewHost(parent,view);assert.equal(attached,true);assert.equal(host.isVisible(),false);
 host.viewport({x:100,y:100,width:300,height:400,visible:true});assert.equal(host.isVisible(),true);
 shown=false;parent.emit('hide');assert.equal(host.isVisible(),false);assert.equal(commands.at(-1).value,false);
 shown=true;parent.emit('show');assert.equal(commands.at(-1).value,true);
 host.destroy();assert.equal(closed,true);assert.equal(attached,false);assert.equal(parent.listenerCount('show'),0);
});
