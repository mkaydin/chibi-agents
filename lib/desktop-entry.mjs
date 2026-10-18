import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';import {dirname} from 'node:path';import {randomUUID} from 'node:crypto';
const marker='X-Companion-Studio-Owned=true';
const clean=value=>{const text=String(value);if(/[\0\r\n]/.test(text))throw new Error('Invalid desktop entry value');return text;};
const value=text=>clean(text).replace(/\\/g,'\\\\');
const argument=text=>('"'+clean(text).replace(/%/g,'%%').replace(/[\\"`$]/g,'\\$&')+'"').replace(/\\/g,'\\\\');
export function desktopEntry({root,icon,node='node',nativeWayland=true,graphics='nvidia'}){
 const args=[node,root+'/scripts/start.mjs',...(nativeWayland?['--native-wayland']:[]),'--graphics',graphics];
 return `[Desktop Entry]\nType=Application\nName=Companion Studio\nComment=Live2D project companions\nExec=${args.map(argument).join(' ')}\nPath=${value(root)}\nIcon=${value(icon)}\nTerminal=false\nCategories=Utility;\nStartupWMClass=companion-studio\n${marker}\n`;
}
export async function installDesktopEntry(path,options){
 const body=desktopEntry(options);try{const current=await readFile(path,'utf8');if(!current.split('\n').includes(marker))throw new Error('Refusing to replace an unrelated desktop entry');if(current===body)return false;}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,body,{mode:0o644});await rename(temporary,path);return true;
}
