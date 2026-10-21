import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import {withDrawableColors} from '../lib/cubism-colors.mjs';
const require=createRequire(import.meta.url);
test('installed Cubism renderer gains drawable colors without changing mask generation',async()=>{
 const original=await readFile(require.resolve('pixi-live2d-display/cubism4'),'utf8');
 const patched=withDrawableColors(original);
 assert.doesNotThrow(()=>new Script(patched));
 const mask=/const fragmentShaderSrcsetupMask = "[^"]+";/;
 assert.equal(patched.match(mask)[0],original.match(mask)[0]);
 assert.equal(withDrawableColors(patched),patched);
 assert.equal((patched.match(/vec4 companionTextureColor/g)||[]).length,3);
 assert.ok(patched.includes('colors.multiplyColors,screen=colors.screenColors'));
});
test('unexpected dependency versions cannot silently omit color support',()=>{
 assert.throws(()=>withDrawableColors('unrecognized renderer'),/needs review/);
});
