import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
for (const root of ['electron','lib','scripts','web']) {
  for (const file of await readdir(root)) {
    if (!/\.(mjs|js|cjs)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check',join(root,file)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
