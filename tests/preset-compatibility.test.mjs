import test from 'node:test';import assert from 'node:assert/strict';
import {textureForPreset,compatiblePresets,resolvePartPreset} from '../lib/preset-compatibility.mjs';import {resolvePreset} from '../lib/appearance-profile.mjs';
const record={presets:['Preset1','Preset5','Preset6'],textureSets:[{id:'Preset1'}],presetRecords:[{name:'Preset1',supported:true,parameters:[]},{name:'Preset5',supported:true,parameters:[{Id:'Hair',Value:2,Blend:'Add'},{Id:'Coat',Value:3,Blend:'Add'}]},{name:'Preset6',supported:true,parameters:[]}]};
test('only presets sharing the exact artwork set can be mixed',()=>{
 assert.equal(textureForPreset(record,'Preset1'),'Preset1');assert.deepEqual(compatiblePresets(record,''),['Preset5','Preset6']);assert.deepEqual(compatiblePresets(record,'Preset1'),['Preset1']);
});
test('partial preset application only changes the selected appearance group and restores its defaults',()=>{
 const model={display:{ParameterGroups:[{Id:'hair',Name:'Hair Front'},{Id:'outfit',Name:'Outfit'}],Parameters:[{Id:'Hair',GroupId:'hair'},{Id:'Coat',GroupId:'outfit'}]}};
 const params=[{id:'Hair',min:0,max:10,default:1},{id:'Coat',min:0,max:10,default:0}];
 assert.deepEqual(resolvePartPreset(record,'Preset5','hair',model,params,resolvePreset),{Hair:3});assert.deepEqual(resolvePartPreset(record,'Preset6','hair',model,params,resolvePreset),{Hair:1});
 assert.throws(()=>resolvePartPreset(record,'Preset5','face',model,params,resolvePreset),/Unknown/);
});
