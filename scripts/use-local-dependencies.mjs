import { mkdir, readFile, symlink, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const source = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node scripts/use-local-dependencies.mjs /path/to/Ayla/node_modules');
const required = { electron: '41.10.7', 'pixi.js': '6.5.10', 'pixi-live2d-display': '0.4.0', '@pixi/unsafe-eval': '6.5.10' };
for (const [name, version] of Object.entries(required)) {
  const folder = resolve(source, name);
  const metadata = JSON.parse(await readFile(resolve(folder, 'package.json'), 'utf8'));
  if (metadata.version !== version) throw new Error(`${name}: expected ${version}, found ${metadata.version}`);
  const target = resolve('node_modules', name);
  await mkdir(dirname(target), { recursive: true });
  try { await lstat(target); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await symlink(folder, target, 'dir');
  }
}
console.log('Linked local development dependencies. No models or runtime assets copied.');
