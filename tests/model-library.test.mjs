import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectModel, containedFile, modelPayload } from '../lib/model-library.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'companion-model-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'model.moc3'), 'synthetic binary fixture');
  await writeFile(join(root, 'texture.png'), 'synthetic texture fixture');
  const manifest = { Version: 3, FileReferences: { Moc: 'model.moc3', Textures: ['texture.png'] } };
  const path = join(root, 'Example.model3.json');
  await writeFile(path, JSON.stringify(manifest));
  return { root, path, manifest };
}
test('discovers animations omitted by a VTube Studio manifest', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'Expressions')); await mkdir(join(f.root, 'Motions'));
  await writeFile(join(f.root, 'Expressions/Happy.exp3.json'), JSON.stringify({ Parameters: [{ Id: 'Smile', Value: 1 }] }));
  await writeFile(join(f.root, 'Motions/Idle.motion3.json'), '{}');
  const model = await inspectModel(f.path);
  assert.deepEqual(model.expressions.map(x => x.name), ['Happy']);
  assert.equal(model.motions[0].name, 'Idle');
  assert.equal(model.allowed.size, 4);
  assert.equal(modelPayload(model).root, undefined);
});
test('rejects a missing texture instead of producing an unusable model', async t => {
  const f = await fixture(t); await rm(join(f.root, 'texture.png'));
  await assert.rejects(inspectModel(f.path), /ENOENT/);
});
test('rejects references escaping the selected model root, including symlinks', async t => {
  const f = await fixture(t);
  const external = await mkdtemp(join(tmpdir(), 'companion-external-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  await writeFile(join(external, 'secret.png'), 'private');
  await symlink(join(external, 'secret.png'), join(f.root, 'escape.png'));
  await assert.rejects(containedFile(f.root, 'escape.png'), /escapes/);
  await assert.rejects(containedFile(f.root, '../' + external.split('/').at(-1) + '/secret.png'), /escapes/);
  await assert.rejects(containedFile(f.root, 'https://example.com/model.moc3'), /Invalid/);
});
test('preserves authored catalogs without adding duplicate discovered files', async t => {
  const f = await fixture(t); await mkdir(join(f.root, 'Expressions'));
  await writeFile(join(f.root, 'Expressions/Smile.exp3.json'), '{"Parameters":[]}');
  f.manifest.FileReferences.Expressions = [{ Name: 'Custom Smile', File: 'Expressions/Smile.exp3.json' }];
  await writeFile(f.path, JSON.stringify(f.manifest));
  const model = await inspectModel(f.path);
  assert.equal(model.expressions.length, 1); assert.equal(model.expressions[0].name, 'Custom Smile');
});
test('shared appearance modules are served with a JavaScript MIME type',async()=>{
 const {mime}=await import('../lib/model-library.mjs');assert.equal(mime('/lib/appearance-profile.mjs'),'text/javascript');
});
