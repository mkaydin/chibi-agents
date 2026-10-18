import {stat} from 'node:fs/promises';
import {basename,join,relative,sep} from 'node:path';
import {inspectPackage} from './character-package.mjs';
// Recover only a missing registered root whose relocated runtime is identical.
// Keep the registered ID so saved appearances and agent bindings stay attached.
export async function recoverMovedPackages(settings,assetRoot,inspect=inspectPackage){
 const moves=[];
 for(const record of settings.packages || []){
  if(!record.root || !record.path || !record.fingerprint)continue;
  try{await stat(record.root);continue;}catch(error){if(error.code!=='ENOENT')continue;}
  const destination=join(assetRoot,basename(record.root)),suffix=relative(record.root,record.path);
  if(suffix.startsWith('..') || !suffix)continue;
  let found;try{found=(await inspect(destination)).find(p=>p.path===join(destination,suffix)&&p.fingerprint===record.fingerprint);}catch{continue;}
  if(found)moves.push({old:record.root,next:found.root,record,found});
 }
 if(!moves.length)return [];
 const rewrite=value=>{
  if(typeof value==='string'){for(const move of moves)if(value===move.old || value.startsWith(move.old+sep))return move.next+value.slice(move.old.length);return value;}
  if(Array.isArray(value))return value.map(rewrite);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rewrite(v)]));
  return value;
 };
 const updated=rewrite(settings);
 for(const move of moves){const record=updated.packages.find(p=>p.id===move.record.id);Object.assign(record,move.found,{id:move.record.id});}
 Object.assign(settings,updated);settings.libraryRevision=(settings.libraryRevision || 0)+1;
 return moves.map(m=>({from:m.old,to:m.next}));
}
