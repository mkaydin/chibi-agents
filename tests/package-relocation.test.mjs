import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {recoverMovedPackages} from '../lib/package-relocation.mjs';
test('identical moved packages preserve IDs and rewrite saved characters, drafts and assignments',async()=>{
 const root=await mkdtemp(join(tmpdir(),'relocate-'));try{
 const old=join(root,'Type-H1_v2.0'),next=join(root,'live2d-assets','Type-H1_v2.0'),path=join(old,'Type-H1','Type-H1.model3.json');
 const asset={packageId:'saved-id',sourcePath:path,root:old,fingerprint:'same',textureSet:'Preset3'};
 const settings={packages:[{id:'saved-id',root:old,path,fingerprint:'same'}],characters:[{preferences:{sourceAsset:asset}}],assignments:{agent:{sourceAsset:asset,appearance:{hair:2}}},studioDraft:{sourceAsset:asset}};
 const inspect=async folder=>{assert.equal(folder,next);return [{id:'new-path-id',root:next,path:join(next,'Type-H1','Type-H1.model3.json'),fingerprint:'same',presets:['Preset3']}];};
 assert.equal((await recoverMovedPackages(settings,join(root,'live2d-assets'),inspect)).length,1);
 assert.equal(settings.packages[0].id,'saved-id');assert.equal(settings.assignments.agent.sourceAsset.root,next);assert.equal(settings.characters[0].preferences.sourceAsset.packageId,'saved-id');assert.equal(settings.studioDraft.sourceAsset.textureSet,'Preset3');assert.deepEqual(settings.assignments.agent.appearance,{hair:2});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('changed replacement content is never automatically accepted',async()=>{
 const root=await mkdtemp(join(tmpdir(),'relocate-'));try{const old=join(root,'old'),settings={packages:[{id:'id',root:old,path:join(old,'model.model3.json'),fingerprint:'expected'}]},before=structuredClone(settings);
 assert.deepEqual(await recoverMovedPackages(settings,join(root,'assets'),async folder=>[{root:folder,path:join(folder,'model.model3.json'),fingerprint:'changed'}]),[]);assert.deepEqual(settings,before);
 }finally{await rm(root,{recursive:true,force:true});}
});
