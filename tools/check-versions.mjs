// Verify every direct dependency is exactly pinned and at least fourteen days old on the project date.
import { readFile, writeFile } from 'node:fs/promises';
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const asOf = new Date('2026-11-22T00:00:00Z');
const cutoff = new Date(+asOf - 14 * 86400000);
const rows = [];
for (const [name, version] of Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`${name} is not pinned: ${version}`);
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Registry lookup failed for ${name}: ${response.status}`);
  const metadata = await response.json();
  const published = metadata.time?.[version];
  if (!published || new Date(published) > cutoff) throw new Error(`${name}@${version} is newer than ${cutoff.toISOString()}`);
  rows.push({ package: name, version, published });
  console.log(`${name}@${version} · ${published} · OK`);
}
await writeFile(new URL('../docs/DEPENDENCIES.json', import.meta.url), JSON.stringify({ asOf: asOf.toISOString(), cutoff: cutoff.toISOString(), dependencies: rows }, null, 2) + '\n');
