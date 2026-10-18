import {stat} from 'node:fs/promises';import {basename,dirname,isAbsolute,join} from 'node:path';
const cache=new Map(),markers=['package.json','pyproject.toml','Cargo.toml','go.mod','CMakeLists.txt'];
export async function projectName(cwd){
 if(typeof cwd!=='string'||!isAbsolute(cwd))return '';
 if(cache.has(cwd))return cache.get(cwd);
 const pending=(async()=>{let path=cwd,fallback='';for(let depth=0;depth<12;depth++){
  const hits=await Promise.all(['.git',...markers].map(name=>stat(join(path,name)).then(()=>true,()=>false)));
  if(hits[0])return basename(path);if(!fallback && hits.slice(1).some(Boolean))fallback=basename(path);
  const parent=dirname(path);if(parent===path)break;path=parent;
 }return fallback || basename(cwd);})();cache.set(cwd,pending);if(cache.size>256)cache.delete(cache.keys().next().value);return pending;
}
