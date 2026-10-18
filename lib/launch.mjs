import { graphicsConfiguration } from './graphics.mjs';
export function launchArguments(args, env = {}, platform = process.platform) {
  const result = [...args];
  const wayland = env.XDG_SESSION_TYPE === 'wayland' || (!env.XDG_SESSION_TYPE && Boolean(env.WAYLAND_DISPLAY));
  if (platform === 'linux' && wayland && !result.includes('--x11') && !result.includes('--native-wayland')) result.push('--native-wayland');
  return result;
}
export function electronSwitches(args, env = {}, platform = process.platform) {
  const flags = [];
  if (platform === 'linux') flags.push(`--ozone-platform=${args.includes('--native-wayland') ? 'wayland' : 'x11'}`);
  for (const [name, value] of graphicsConfiguration(args, env).switches) flags.push(`--${name}=${value}`);
  return flags;
}
