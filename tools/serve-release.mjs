// Temporary transfer of PUBLIC COMPILED ASSETS only. Never serves source, directories, environment variables or credentials.
// Usage: node tools/serve-release.mjs .arena/releases/crosstown-0.13.0/crosstown-0.13.0.tar.gz 4187
// Prepare and verify a NEW build first; never redeploy any retired transfer descriptor.
import http from 'node:http';
import { createReadStream, statSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const archive = resolve(process.argv[2]), port = Number(process.argv[3] ?? 8766);
const name = basename(archive), size = statSync(archive).size, sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  const url = new URL(req.url, 'http://transfer.invalid');
  if (url.pathname === '/' || url.pathname === '/ready') {
    const body = JSON.stringify({ purpose: 'One-time Vercel transfer of verified public game assets; no source or secrets exposed', archive: name, bytes: size, sha256 });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : body); return;
  }
  if (url.pathname !== `/${name}`) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Length': size, 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') res.end(); else createReadStream(archive).pipe(res);
});
server.listen(port, '0.0.0.0', () => console.log(`Public-build transfer ready on ${port}; ${size} bytes; SHA-256 ${sha256}`));
process.on('SIGTERM', () => server.close());
