import { readdir, realpath, mkdir, copyFile, readFile, writeFile, rename, rm, stat, open } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { containedFile, inspectModel } from './model-library.mjs';
import { touchVariant } from './asset-cache.mjs';
const fileHashes=new Map();
async function fileHash(path){const info=await stat(path),key=`${path}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;if(fileHashes.has(key))return fileHashes.get(key);const digest=hash(await readFile(path));fileHashes.set(key,digest);if(fileHashes.size>1024)fileHashes.delete(fileHashes.keys().next().value);return digest;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function modelFingerprint(model){
  const hashes=[];for(const [name,file] of [...model.allowed].sort(([a],[b])=>a.localeCompare(b)))hashes.push([name,await fileHash(file)]);
  return hash(JSON.stringify([model.manifest,hashes]));
}
const pngSizes=new Map();
async function pngSize(file){
  const info=await stat(file),key=`${file}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;if(pngSizes.has(key))return pngSizes.get(key);
  const handle=await open(file,'r'),bytes=Buffer.alloc(24);try{await handle.read(bytes,0,24,0);}finally{await handle.close();}
  if(info.size<24 || bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Invalid preset PNG atlas');
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w || !h || w>16384 || h>16384)throw new Error('Invalid preset atlas dimensions');
  const result={w,h,hash:await fileHash(file)};pngSizes.set(key,result);if(pngSizes.size>1024)pngSizes.delete(pngSizes.keys().next().value);return result;
}
export async function inspectPackage(folder) {
  const root=await realpath(folder),manifests=[];let count=0;
  async function scan(dir,depth){for(const entry of await readdir(dir,{withFileTypes:true})){
    if(++count>4000)throw new Error('Package contains too many files');if(entry.isSymbolicLink())continue;
    const path=join(dir,entry.name);if(entry.isDirectory() && depth<3)await scan(path,depth+1);else if(entry.isFile() && entry.name.endsWith('.model3.json'))manifests.push(path);
  }}
  await scan(root,0);if(!manifests.length)throw new Error('No Live2D runtime manifest found. Select the full package folder containing a .model3.json file (for example live2d-assets/Type-H1_v2.0). To import mouse clips, use Agents → Recovered mouse animations and select the legacy Expressions folder.');if(manifests.length>16)throw new Error('Select a smaller package folder (at most 16 models)');
  const result=[];
  for(const path of manifests){
    const model=await inspectModel(path),textureSets=[],presetRecords=model.expressions.filter(e=>e.kind==='appearance').map(e=>({name:e.name,parameters:e.parameters,supported:e.supported,hash:hash(JSON.stringify(e.parameters))}));
    const sampleRoot=resolve(dirname(path),'../Sample Characters');
    if(sampleRoot.startsWith(root+'/')){
      let folders=[];try{folders=await readdir(sampleRoot,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
      for(const entry of folders.filter(e=>e.isFile() && /^Preset(?:0x|\d+)\.exp3\.json$/i.test(e.name))){
        const source=await containedFile(sampleRoot,entry.name),bytes=await readFile(source);if(bytes.length>8*1024*1024)throw new Error('Preset JSON is too large');
        const data=JSON.parse(bytes);if(!Array.isArray(data.Parameters) || data.Parameters.length>2048 || data.Parameters.some(p=>typeof p.Id!=='string' || !Number.isFinite(p.Value)))throw new Error('Invalid sample preset');
        const digest=hash(JSON.stringify(data.Parameters));if(presetRecords.some(p=>p.hash===digest))continue;
        let name=entry.name.slice(0,-10);if(presetRecords.some(p=>p.name===name))name+=' (sample)';
        presetRecords.push({name,parameters:data.Parameters,hash:digest,supported:data.Parameters.every(p=>['Add','Multiply','Overwrite'].includes(p.Blend || 'Add'))});
      }
      for(const entry of folders.filter(e=>e.isDirectory() && !e.isSymbolicLink())){
        const match=entry.name.match(/^(Preset(?:0x|\d+))\s*Texture$/i);if(!match)continue;const files=[],hashes=[];
        for(const original of model.manifest.FileReferences.Textures){
          const file=await containedFile(sampleRoot,join(entry.name,basename(original))),size=await pngSize(file),base=await pngSize(model.allowed.get(original));
          if(size.w*base.h!==size.h*base.w)throw new Error(`Atlas aspect ratio differs: ${entry.name}/${basename(original)}`);
          files.push(file);hashes.push(size.hash);
        }textureSets.push({id:match[1],name:match[1],files,fingerprint:hash(JSON.stringify(hashes))});
      }
    }
    result.push({id:hash(path).slice(0,20),name:model.name,path,root,fingerprint:await modelFingerprint(model),presets:presetRecords.map(p=>p.name),presetRecords,textureSets});
  }return result;
}
// Content-addressed, immutable variants; source models are never edited.
export async function materializeTextureSet(packageRecord,setId,cacheRoot){
  const records=await inspectPackage(packageRecord.root || resolve(dirname(packageRecord.path),'..'));
  const record=records.find(p=>p.path===packageRecord.path);if(!record)throw new Error('Base model is missing; relink the package');
  const set=setId && record.textureSets.find(t=>t.id===setId);if(setId && !set)throw new Error('Texture set is no longer available; reimport the package');
  const model=await inspectModel(record.path);let sourceBytes=0;for(const file of model.allowed.values())sourceBytes+=(await stat(file)).size;if(sourceBytes>512*1024*1024)throw new Error('Runtime assets exceed the 512 MiB import budget');
  const key=hash(JSON.stringify([2,record.fingerprint,set?.fingerprint,record.presetRecords])).slice(0,32);
  const target=join(cacheRoot,'variant-'+key),manifest=join(target,`${model.name}.model3.json`);
  try{
    const existing=await inspectModel(manifest),receipt=JSON.parse(await readFile(join(target,'.companion-variant.json'),'utf8'));
    if(receipt.owner!=='companion-studio')throw new Error('Unowned variant cache folder');
    if(receipt.variantFingerprint!==await modelFingerprint(existing))throw new Error('Variant cache content changed');
    await touchVariant(manifest);return manifest;
  }catch(error){
    try{const receipt=JSON.parse(await readFile(join(target,'.companion-variant.json'),'utf8'));if(receipt.owner!=='companion-studio')throw new Error('Refusing to replace an unowned variant');await rm(target,{recursive:true,force:true});}
    catch(receiptError){if(receiptError.code!=='ENOENT')throw receiptError;}
  }
  const staging=join(cacheRoot,'.staging-'+randomUUID());await mkdir(staging,{recursive:true});
  try{
    for(const [relative,file] of model.allowed){const dest=join(staging,relative);await mkdir(dirname(dest),{recursive:true});await copyFile(file,dest);}
    if(set)for(const [i,relative] of model.manifest.FileReferences.Textures.entries())await copyFile(set.files[i],join(staging,relative));
    model.manifest.CompanionAppearancePresets=record.presets;
    for(const [i,preset] of record.presetRecords.entries()){
      if(model.manifest.FileReferences.Expressions.some(e=>e.Name===preset.name))continue;
      const file=`CompanionPresets/preset_${i}.exp3.json`;await mkdir(join(staging,'CompanionPresets'),{recursive:true});await writeFile(join(staging,file),JSON.stringify({Type:'Live2D Expression',Parameters:preset.parameters}));
      model.manifest.FileReferences.Expressions=model.manifest.FileReferences.Expressions.filter(e=>e.Name!==preset.name);model.manifest.FileReferences.Expressions.push({Name:preset.name,File:file});
    }
    await writeFile(join(staging,basename(manifest)),JSON.stringify(model.manifest));
    await writeFile(join(staging,'.companion-variant.json'),JSON.stringify({owner:'companion-studio',packageId:record.id,source:record.path,setId,fingerprint:record.fingerprint,variantFingerprint:await modelFingerprint(await inspectModel(join(staging,basename(manifest))))}));
    await inspectModel(join(staging,basename(manifest)));
    try{await rename(staging,target);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes(error.code))throw error;await rm(staging,{recursive:true,force:true});}
    return manifest;
  }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
