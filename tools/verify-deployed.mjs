// Read-only anonymous integrity check: compare every locally built public file to the public HTTPS release.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const url = new URL(process.env.DEPLOYMENT_URL ?? 'https://crosstown-sarang-dev.vercel.app');
if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a public HTTPS deployment URL without credentials.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [];
async function walk(dir = '') {
  for (const entry of (await readdir(resolve(root, 'dist', dir), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(relative);
    else if (entry.isFile()) {
      const target = new URL(relative, `${url.origin}/`);
      const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
      if (response.status !== 200) throw new Error(`${target}: expected anonymous 200, got ${response.status}. No login/protection bypass is attempted.`);
      const remote = Buffer.from(await response.arrayBuffer()), local = await readFile(resolve(root, 'dist', relative));
      if (hash(remote) !== hash(local)) throw new Error(`Production checksum mismatch: ${relative}`);
      files.push({ path: relative, status: response.status, bytes: remote.length, sha256: hash(remote), contentType: response.headers.get('content-type') });
      console.log(`200 ${relative} ${remote.length} bytes MATCH`);
    }
  }
}
await walk();
if (!files.some(file => file.path === 'models/parkour-runner.glb') || !files.some(file => file.path === 'release.json')) throw new Error('Required release assets missing from local build.');
const release = JSON.parse(await readFile(resolve(root, 'dist/release.json'), 'utf8'));
await writeFile(resolve(root, 'docs/DEPLOYED-FILES.json'), `${JSON.stringify({ version: release.version, build: release.build, checkedAt: new Date().toISOString(), url: url.origin, anonymous: true, allHashesMatch: true, files }, null, 2)}\n`);
console.log(`Verified ${files.length}/${files.length} public production files; no uploads or deployment mutations performed.`);
