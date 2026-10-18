import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewTextures } from '../lib/preview-textures.mjs';
const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
test('preview textures use ordinary model-relative URLs and remain isolated by model', () => {
  const cache = new PreviewTextures();
  const path = cache.store('model-a', 0, png);
  assert.equal(path, 'preview/0.png');
  assert.equal(new URL(path, 'http://127.0.0.1:1234/models/model-a/manifest.json').href, 'http://127.0.0.1:1234/models/model-a/preview/0.png');
  assert.deepEqual(cache.get('model-a', path), png);
  assert.equal(cache.get('model-b', path), undefined);
  assert.equal(cache.get('model-a', '../preview/0.png'), undefined);
  cache.clear('model-a'); assert.equal(cache.get('model-a', path), undefined);
});
test('invalid texture data and indices are rejected', () => {
  const cache = new PreviewTextures();
  assert.throws(() => cache.store('a', -1, png), /Invalid/);
  assert.throws(() => cache.store('a', 0, Buffer.from('not a PNG')), /Invalid/);
});
test('resized texture reuse survives model disposal and obeys a bounded shared cache',()=>{
 const textures=new PreviewTextures();const png=Buffer.from([137,80,78,71,13,10,26,10,1]);textures.sharedLimit=20;
 textures.store('a',0,png,'atlas:2048');textures.clear('a');assert.equal(textures.reuse('b',0,'atlas:2048'),'preview/0.png');
 assert.deepEqual(textures.get('b','preview/0.png'),png);
 textures.store('c',0,png,'second');textures.store('d',0,png,'third');assert.ok(textures.sharedBytes<=20);assert.equal(textures.reuse('e',0,'atlas:2048'),null);
});
