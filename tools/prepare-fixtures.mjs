// Reviewed, version-pinned CC0 fixtures. Each one passes through exactly the same public import function.
import { readFile } from 'node:fs/promises';
import { prepareAsset } from './prepare-asset.mjs';
const fixtures = JSON.parse(await readFile(new URL('../assets/fixtures.json', import.meta.url), 'utf8'));
for (const fixture of fixtures) await prepareAsset(fixture);
