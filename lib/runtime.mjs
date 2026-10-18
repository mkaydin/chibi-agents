import { existsSync, readFileSync } from 'node:fs';

export function supportsWaylandClickThrough(version) {
  const [major, minor, patch] = String(version).split('.').map(Number);
  const prerelease = String(version).split('-')[1];
  const fixed45 = !prerelease || /^beta\./.test(prerelease) || Number(/^alpha\.(\d+)/.exec(prerelease)?.[1]) >= 13;
  return major > 45 || (major === 45 && fixed45)
    || (major === 44 && minor >= 5)
    || (major === 43 && (minor > 7 || (minor === 7 && patch >= 6)));
}

export function selectRuntime(args, env, bundled, platform = process.platform) {
  if (env.COMPANION_ELECTRON_BIN) return env.COMPANION_ELECTRON_BIN;
  if (platform === 'linux' && args.includes('--native-wayland')) {
    for (const name of ['electron43', 'electron44']) {
      const binary = `/usr/lib/${name}/electron`;
      const versionFile = `/usr/lib/${name}/version`;
      if (existsSync(binary) && existsSync(versionFile) && supportsWaylandClickThrough(readFileSync(versionFile, 'utf8').trim())) return binary;
    }
  }
  return bundled;
}
