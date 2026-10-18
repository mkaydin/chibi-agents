import {readdir,readFile,mkdir,copyFile,writeFile,rename,rm} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=join(root,'dist/companion-studio-source'),staging=join(root,'dist/.source-'+randomUUID());
const allowedRoots=['electron','lib','web','scripts','integrations','tests'];
const rootFiles=['package.json','README.md','CUSTOMIZABLE_CHIBI_PLAN.md','TYPE_H1_ANALYSIS.md','TYPE_H1_VERSION_COMPARISON.md','LIVELY_AGENTS_PLAN.md','LIVE_BEHAVIOR_PLAN.md','.gitignore'];
const allowed=name=>/\.(mjs|js|cjs|py|css|html|toml|md)$/.test(name) && !/cubismcore|\.model3\.|\.exp3\.|\.motion3\./i.test(name);
await mkdir(staging,{recursive:true});let files=0;
async function copy(relative){const target=join(staging,relative);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,relative),target);files++;}
async function scan(relative){for(const entry of await readdir(join(root,relative),{withFileTypes:true})){if(entry.isSymbolicLink())continue;const path=join(relative,entry.name);if(entry.isDirectory())await scan(path);else if(entry.isFile() && allowed(entry.name))await copy(path);}}
try{
 for(const relative of allowedRoots)await scan(relative);for(const file of rootFiles)await copy(file);
 await writeFile(join(staging,'.source-package-receipt.json'),JSON.stringify({owner:'companion-studio-source-builder',files,modelsIncluded:false},null,2));
 try{const receipt=JSON.parse(await readFile(join(output,'.source-package-receipt.json'),'utf8'));if(receipt.owner!=='companion-studio-source-builder')throw new Error('Refusing to replace an unowned output folder');await rm(output,{recursive:true,force:true});}catch(error){if(error.code!=='ENOENT')throw error;}
 await rename(staging,output);console.log(`Source package: ${output} (${files} source files; no model assets)`);
}catch(error){await rm(staging,{recursive:true,force:true});throw error;}
