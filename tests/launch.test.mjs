import test from 'node:test';
import assert from 'node:assert/strict';
import { electronSwitches, launchArguments } from '../lib/launch.mjs';
test('short launcher detects Wayland and preserves explicit display choices', () => {
  assert.deepEqual(launchArguments([], {XDG_SESSION_TYPE:'wayland'}, 'linux'), ['--native-wayland']);
  assert.deepEqual(launchArguments([], {WAYLAND_DISPLAY:'wayland-0'}, 'linux'), ['--native-wayland']);
  assert.deepEqual(launchArguments([], {XDG_SESSION_TYPE:'x11',WAYLAND_DISPLAY:'wayland-0'}, 'linux'), []);
  assert.deepEqual(launchArguments(['--x11'], {XDG_SESSION_TYPE:'wayland'}, 'linux'), ['--x11']);
  assert.deepEqual(launchArguments(['--native-wayland'], {XDG_SESSION_TYPE:'wayland'}, 'linux'), ['--native-wayland']);
  assert.deepEqual(launchArguments([], {XDG_SESSION_TYPE:'wayland'}, 'darwin'), []);
});
test('native display and graphics flags are applied at process launch', () => {
  assert.deepEqual(electronSwitches(['--graphics', 'software', '--native-wayland'], {}, 'linux'), [
    '--ozone-platform=wayland', '--use-gl=angle', '--use-angle=swiftshader',
  ]);
  assert.deepEqual(electronSwitches([], {}, 'linux'), ['--ozone-platform=x11']);
  assert.deepEqual(electronSwitches([], {}, 'darwin'), []);
});
