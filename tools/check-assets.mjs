// Acceptance check against decoded, compressed assets, including checksums, SI size, pivot and clip preservation.
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createIO, verifyNormalized } from './asset-lib.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const io = await createIO();
const names = (await readdir(resolve(root, 'docs/assets'))).filter(name => name.endsWith('.json'));
assert.ok(names.length >= 2, 'Prepare both fixture models first.');
for (const name of names) {
  const report = JSON.parse(await readFile(resolve(root, 'docs/assets', name), 'utf8'));
  const bytes = await readFile(resolve(root, 'public/models', `${report.id}.glb`));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.outputSha256, 'Output checksum matches report');
  const document = await io.readBinary(bytes);
  const stats = verifyNormalized(document, report);
  assert.ok(['CC0-1.0', 'CC-BY-4.0'].includes(report.license));
  assert.ok(report.sourceSha256.length === 64);
  assert.ok(report.before.animations.every(name => stats.animations.includes(name)), 'All original animation clips preserved');
  for (const clip of report.requiredAnimations ?? []) assert.ok(stats.animations.includes(clip), `Required embedded animation: ${clip}`);
  assert.ok(document.getRoot().listExtensionsUsed().some(extension => extension.extensionName === 'EXT_meshopt_compression'), 'Meshopt compression present');
  assert.ok(bytes.length < report.sourceBytes, 'Fixture output is smaller than source');
  const credits = await readFile(resolve(root, 'CREDITS.md'), 'utf8');
  assert.ok(credits.includes(report.source) && credits.includes(report.author), 'Credit source and author present');
  console.log(`PASS ${report.id}: ${report.targetSize} m ${report.targetDimension}, ground-centred, +Z forward, ${stats.triangles} triangles, ${stats.animations.length} clips; ${(bytes.length / 1024).toFixed(1)} KiB.`);
}
