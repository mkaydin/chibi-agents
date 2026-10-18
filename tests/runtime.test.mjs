import test from 'node:test';
import assert from 'node:assert/strict';
import { supportsWaylandClickThrough, selectRuntime } from '../lib/runtime.mjs';
test('Wayland passthrough is gated on the released native fix', () => {
  for (const version of ['41.10.7', '43.7.5', '44.4.0', '45.0.0-alpha.12']) assert.equal(supportsWaylandClickThrough(version), false);
  for (const version of ['43.7.6', '43.7.9', '44.5.0', '44.6.0', '45.0.0', '45.0.0-alpha.13']) assert.equal(supportsWaylandClickThrough(version), true);
});
test('explicit runtime overrides and other-platform launches retain their chosen binary', () => {
  assert.equal(selectRuntime([], { COMPANION_ELECTRON_BIN: '/custom/electron' }, '/bundled'), '/custom/electron');
  assert.equal(selectRuntime([], {}, '/bundled', 'linux'), '/bundled');
  assert.equal(selectRuntime(['--native-wayland'], {}, '/bundled', 'darwin'), '/bundled');
});
