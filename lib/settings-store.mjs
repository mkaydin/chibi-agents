import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { migrateSettings } from './draft-record.mjs';
export async function readSettings(path) {
  try{
    const text=await readFile(path,'utf8'),value=JSON.parse(text);
    if(value.schemaVersion!==1)try{await writeFile(path+'.pre-chibi-backup.json',text,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
    return migrateSettings(value);
  }catch(error){
    if(error.code==='ENOENT')return migrateSettings();
    try{await copyFile(path,path+'.corrupt-'+Date.now()+'.json');}catch{}
    try{return migrateSettings(JSON.parse(await readFile(path+'.last-good','utf8')));}catch{throw new Error(`Settings could not be read; the original file was preserved. ${error.message}`);}
  }
}
export async function writeSettings(path,data){
  await mkdir(dirname(path),{recursive:true});
  try{const old=await readFile(path,'utf8');JSON.parse(old);await writeFile(path+'.last-good',old);}catch(error){if(error instanceof SyntaxError){await copyFile(path,path+'.corrupt-'+Date.now()+'.json');}else if(error.code!=='ENOENT')throw error;}
  await writeFile(path+'.tmp',data);await rename(path+'.tmp',path);
}
