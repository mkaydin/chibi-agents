import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {DesktopRelay} from '../lib/desktop-relay.mjs';import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
test('desktop relay waits for readiness, delivers bounded events and shuts down its child',async()=>{
 let child;const events=[],relay=new DesktopRelay({script:'/relay.py',onEvent:e=>events.push(e),launch:()=>{child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={end(){child.ended=true;}};child.kill=()=>{child.killed=true;child.emit('exit');};queueMicrotask(()=>child.stdout.emit('data','{"type":"ready"}\n'));return child;}});
 const ready=await relay.start();assert.match(ready.service,/^org\.local\.CompanionDesktop\.p/);child.stdout.emit('data','{"type":"geometry","title":"Companion · one","x":40,"y":60}\n');assert.equal(events[0].type,'geometry');relay.stop();assert.equal(child.ended,true);assert.equal(child.killed,true);assert.equal(events.length,1);
});
test('Python relay parses and GUI control IDs remain unique and wired',async()=>{
 const python=spawnSync('python3',['-c','import ast,sys; ast.parse(open(sys.argv[1]).read())','scripts/desktop-relay.py'],{encoding:'utf8'});assert.equal(python.status,0,python.stderr);
 const html=await readFile('web/control.html','utf8'),control=await readFile('web/control.js','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const [,id]of control.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),`Missing control ${id}`);
});
