import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {pruneVariants} from '../lib/asset-cache.mjs';
test('cache trimming protects active models and never removes unowned asset folders',async t=>{
 const root=await mkdtemp(join(tmpdir(),'chibi-cache-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const active=join(root,'variant-'+'a'.repeat(32)),old=join(root,'variant-'+'b'.repeat(32)),unowned=join(root,'my-model');
 for(const path of [active,old,unowned]){await mkdir(path);await writeFile(join(path,'Rig.model3.json'),'{}');await writeFile(join(path,'texture.png'),Buffer.alloc(100));}
 for(const path of [active,old])await writeFile(join(path,'.companion-variant.json'),JSON.stringify({owner:'companion-studio'}));
 const result=await pruneVariants(root,[join(active,'Rig.model3.json')],1);assert.equal(result.removed,1);assert.equal(result.pinnedOverBudget,true);
 await access(active);await access(unowned);await assert.rejects(access(old));
});
