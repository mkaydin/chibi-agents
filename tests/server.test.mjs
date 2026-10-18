import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
test('offline browser bundles resolve to actual UMD scripts', async () => {
  const pixi = resolve(dirname(require.resolve('pixi.js')), '../browser/pixi.min.js');
  const safe = resolve(dirname(require.resolve('@pixi/unsafe-eval')), '../browser/unsafe-eval.js');
  const live2d = require.resolve('pixi-live2d-display/cubism4');
  assert.match(await readFile(pixi, 'utf8'), /PIXI/);
  assert.match(await readFile(safe, 'utf8'), /install\(globalThis.PIXI\)/);
  assert.match(await readFile(live2d, 'utf8'), /Live2DModel/);
});
