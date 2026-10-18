import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readSettings,writeSettings} from '../lib/settings-store.mjs';
test('migration retains a backup and corrupted settings recover from the last valid save',async t=>{
 const root=await mkdtemp(join(tmpdir(),'chibi-settings-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'settings.json');
 const original={modelPath:'/old/model',studio:{appearance:{Hair:2}}};await writeFile(path,JSON.stringify(original));
 const migrated=await readSettings(path);assert.equal(migrated.schemaVersion,1);assert.deepEqual(JSON.parse(await readFile(path+'.pre-chibi-backup.json','utf8')),original);
 await writeSettings(path,JSON.stringify(migrated));await writeFile(path,'{corrupt');const recovered=await readSettings(path);assert.equal(recovered.modelPath,original.modelPath);
 await writeSettings(path,JSON.stringify(recovered));assert.equal(JSON.parse(await readFile(path,'utf8')).schemaVersion,1);assert.ok((await readdir(root)).some(name=>name.includes('.corrupt-')));
});
test('a failed replacement leaves the prior settings usable',async t=>{
 const root=await mkdtemp(join(tmpdir(),'chibi-atomic-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'settings.json');
 await writeFile(path,'{"safe":true}');await mkdir(path+'.tmp');await assert.rejects(writeSettings(path,'{"safe":false}'));
 assert.deepEqual(JSON.parse(await readFile(path,'utf8')),{safe:true});
});
