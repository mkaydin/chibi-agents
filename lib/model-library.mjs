import { readFile, realpath, stat, readdir } from 'node:fs/promises';
import { resolve, dirname, basename, sep, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function containedFile(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || /^[a-z]+:/i.test(relative) || relative.startsWith('/')) throw new Error('Invalid model file reference');
  const candidate = await realpath(resolve(root, relative));
  if (!candidate.startsWith(root + sep)) throw new Error('Model reference escapes its folder');
  const info = await stat(candidate);
  if (!info.isFile() || info.size > 256 * 1024 * 1024) throw new Error('Model file is missing or too large');
  return candidate;
}

async function readJson(path) {
  if ((await stat(path)).size > 8 * 1024 * 1024) throw new Error('JSON file exceeds 8 MiB');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function discover(root, folder, suffix) {
  try {
    const entries = await readdir(resolve(root, folder), { withFileTypes: true });
    return entries.filter(item => item.isFile() && item.name.endsWith(suffix)).sort((a,b) => a.name.localeCompare(b.name)).slice(0, 200).map(item => `${folder}/${item.name}`);
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function inspectModel(manifestPath) {
  const absolute = await realpath(manifestPath);
  if (!absolute.endsWith('.model3.json')) throw new Error('Select a Cubism .model3.json runtime manifest');
  const root = await realpath(dirname(absolute));
  const manifest = await readJson(absolute);
  const refs = manifest.FileReferences;
  if (manifest.Version !== 3 || !refs?.Moc || !Array.isArray(refs.Textures) || !refs.Textures.length || refs.Textures.length > 16) throw new Error('Invalid Cubism 3/4 runtime manifest');
  const files = new Set([refs.Moc, ...refs.Textures]);
  for (const name of ['Physics', 'Pose', 'DisplayInfo', 'UserData']) if (refs[name]) files.add(refs[name]);
  refs.Expressions ??= [];
  refs.Motions ??= {};
  if (!Array.isArray(refs.Expressions) || !refs.Motions || typeof refs.Motions !== 'object' || Array.isArray(refs.Motions)) throw new Error('Invalid animation catalog');
  // Many VTube Studio packages omit their animation catalogs from model3.json.
  const expressionFiles = new Set(refs.Expressions.map(item => item.File));
  for (const file of await discover(root, 'Expressions', '.exp3.json')) {
    if (!expressionFiles.has(file)) refs.Expressions.push({ Name: basename(file, '.exp3.json'), File: file });
  }
  const motionFiles = new Set(Object.values(refs.Motions).flat().map(item => item.File));
  const discovered = (await discover(root, 'Motions', '.motion3.json')).filter(file => !motionFiles.has(file));
  if (discovered.length) {
    const group = Object.hasOwn(refs.Motions, 'Imported') ? 'Discovered' : 'Imported';
    refs.Motions[group] = [...(refs.Motions[group] || []), ...discovered.map(File => ({ File }))];
  }
  let display = { Parameters: [], ParameterGroups: [] };
  if (refs.DisplayInfo) display = await readJson(await containedFile(root, refs.DisplayInfo));
  display.ParameterGroups ??= [];
  if (!Array.isArray(display.Parameters) || !Array.isArray(display.ParameterGroups) || display.Parameters.length > 4096) throw new Error('Invalid parameter metadata');
  const expressions = [];
  const motions = [];
  if (refs.Expressions.length > 200) throw new Error('Too many expressions');
  for (const item of refs.Expressions) {
    files.add(item.File);
    const data = await readJson(await containedFile(root, item.File));
    if (!Array.isArray(data.Parameters) || data.Parameters.length > 2048 || data.Parameters.some(p => typeof p.Id !== 'string' || !Number.isFinite(p.Value))) throw new Error(`Invalid expression: ${item.Name}`);
    const name = String(item.Name);
    const supported = data.Parameters.every(p => ['Add', 'Multiply', 'Overwrite'].includes(p.Blend || 'Add'));
    const kind = (/^Preset(?:0x|[0-9]+)$/i.test(name) || manifest.CompanionAppearancePresets?.includes(name)) ? 'appearance' : 'reaction';
    expressions.push({ name, parameters: data.Parameters, kind, supported });
  }
  for (const [group, items] of Object.entries(refs.Motions)) {
    if (!Array.isArray(items)) throw new Error(`Invalid motion group: ${group}`);
    for (const [index, item] of items.entries()) {
      files.add(item.File);
      // Audio is optional here; leave it muted until explicitly supported.
      if (item.Sound) { files.add(item.Sound); delete item.Sound; }
      motions.push({ group, index, name: basename(item.File, '.motion3.json') });
    }
  }
  if (files.size > 512) throw new Error('Too many runtime files');
  const allowed = new Map();
  for (const file of files) allowed.set(file, await containedFile(root, file));
  return { id: randomUUID(), root, path: absolute, name: basename(absolute, '.model3.json'), manifest, allowed, expressions, motions, display };
}

export function modelPayload(model) {
  const manifest = structuredClone(model.manifest);
  manifest.url = `/models/${model.id}/manifest.json`;
  return { id: model.id, name: model.name, manifest, expressions: model.expressions, motions: model.motions, display: model.display };
}

export function mime(path) {
  return ({ '.json': 'application/json', '.moc3': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs':'text/javascript' })[extname(path)] || 'application/octet-stream';
}
