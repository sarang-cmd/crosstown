// Snapshot the actual runtime source/public/lockfile bytes around a test batch.
// A hash is a revision boundary, not a Git commit or proof a test ran.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
async function walk(dir) {
  const result = [];
  for (const e of await readdir(`${root}/${dir}`, { withFileTypes: true })) {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) result.push(...await walk(path));
    else if (e.isFile()) result.push(path); else throw Error(`Nonregular runtime file: ${path}`);
  }
  return result;
}
const paths = [...await walk('src'), ...await walk('public'), 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'vercel.json'].sort();
const files = await Promise.all(paths.map(async file => { const bytes = await readFile(`${root}/${file}`); return { file, bytes: bytes.length, sha256: sha(bytes) }; }));
const result = { sha256: sha(files.map(i => `${i.file}\0${i.sha256}\n`).join('')), algorithm: 'SHA-256 of sorted path, NUL, file SHA-256, LF records', files };
if (process.argv[2]) await writeFile(process.argv[2], `${JSON.stringify(result, null, 2)}\n`);
console.log(result.sha256);
