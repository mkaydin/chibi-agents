import test from 'node:test';
import assert from 'node:assert/strict';
import { textureDimensions } from '../web/textures.js';
test('reduces software atlas allocation while preserving UV aspect ratio', () => {
  assert.deepEqual(textureDimensions(8192, 8192, 2048), { width: 2048, height: 2048 });
  assert.deepEqual(textureDimensions(8192, 4096, 2048), { width: 2048, height: 1024 });
  assert.deepEqual(textureDimensions(512, 256, 2048), { width: 512, height: 256 });
  assert.throws(() => textureDimensions(0, 512, 2048), /Invalid/);
});
