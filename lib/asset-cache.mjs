import { readdir, stat, readFile, rm, utimes } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
export async function pruneVariants(root, protectedPaths=[], limit=1024*1024*1024) {
  const protectedRoots=new Set(protectedPaths.filter(Boolean).map(path=>resolve(dirname(path))));
  let entries=[];try{entries=await readdir(root,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return {bytes:0,removed:0};throw error;}
  const variants=[];
  for(const entry of entries){
    if(!entry.isDirectory() || !/^variant-[a-f0-9]{32}$/.test(entry.name))continue;
    const path=join(root,entry.name);let receipt;
    try{receipt=JSON.parse(await readFile(join(path,'.companion-variant.json'),'utf8'));}catch{continue;}
    if(receipt.owner!=='companion-studio')continue;
    const info=await stat(path);let bytes=0;
    async function size(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=join(dir,e.name);if(e.isDirectory())await size(p);else if(e.isFile())bytes+=(await stat(p)).size;}}
    await size(path);variants.push({path,bytes,time:info.mtimeMs,protected:protectedRoots.has(resolve(path))});
  }
  let bytes=variants.reduce((n,v)=>n+v.bytes,0),removed=0;
  for(const v of variants.sort((a,b)=>a.time-b.time)){if(bytes<=limit)break;if(v.protected)continue;await rm(v.path,{recursive:true,force:true});bytes-=v.bytes;removed++;}
  return {bytes,removed,pinnedOverBudget:bytes>limit};
}
export async function touchVariant(path){const now=new Date();await utimes(dirname(path),now,now);}
