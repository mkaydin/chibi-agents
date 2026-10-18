import test from 'node:test';
import assert from 'node:assert/strict';
import { graphicsConfiguration, graphicsEnvironment } from '../lib/graphics.mjs';
test('software mode selects the full SwiftShader ANGLE driver without disabling sandboxing', () => {
  assert.deepEqual(graphicsConfiguration(['--graphics', 'software']), {
    mode: 'software', switches: [['use-gl', 'angle'], ['use-angle', 'swiftshader']],
  });
});
test('NVIDIA offload is configured before spawning Electron and respects explicit software selection', () => {
  const source = { KEEP: 'value' };
  assert.deepEqual(graphicsConfiguration(['--graphics=nvidia']).switches, [['use-gl', 'angle'], ['use-angle', 'gl']]);
  assert.equal(graphicsEnvironment(['--graphics=nvidia'], source).__NV_PRIME_RENDER_OFFLOAD, '1');
  assert.equal(graphicsEnvironment(['--graphics=nvidia'], source).__GLX_VENDOR_LIBRARY_NAME, 'nvidia');
  assert.deepEqual(source, { KEEP: 'value' });
  assert.deepEqual(graphicsEnvironment(['--graphics=software'], source), source);
});
test('supports explicit OpenGL, environment configuration and CLI precedence', () => {
  assert.equal(graphicsConfiguration(['--graphics=opengl'], { COMPANION_GRAPHICS: 'software' }).switches[1][1], 'gl');
  assert.equal(graphicsConfiguration([], { COMPANION_GRAPHICS: 'software' }).mode, 'software');
  assert.deepEqual(graphicsConfiguration([]).switches, []);
  assert.throws(() => graphicsConfiguration(['--graphics', 'invalid']), /Graphics mode/);
});
