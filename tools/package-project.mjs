// Portable CURRENT source archive from an explicit allowlist, never the home tree.
// Includes every current report/log, final candidate capture and the self-contained 26-view historical gallery.
// To avoid duplicating multi-megabyte history under the snapshot cap, historical raw
// evidence and explicitly inventoried intermediate/old captures stay unchanged in the workspace.
// Historical release archives stay untouched. No credentials/uploads/build/cache.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync, strToU8 } from 'fflate';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const release = JSON.parse(await readFile(resolve(root, 'public/release.json'), 'utf8'));
const results = JSON.parse(await readFile(resolve(root, 'docs/TEST-RESULTS.json'), 'utf8'));
if (pkg.version !== release.version || pkg.version !== results.release || !results.checks.gallery.passed || !results.checks.localFileLinks.passed || !results.checks.allowlistedSourceScan.passed) throw new Error('Regenerate completed release evidence/checks for this version before packaging.');
const evidenceManifest=JSON.parse(await readFile(resolve(root,'docs/EVIDENCE-MANIFEST.json'),'utf8'));
if(evidenceManifest.release!==pkg.version)throw Error('Stale evidence manifest');
const prefix = 'crosstown', version = pkg.version, entries = {}, excluded=[], mtime = new Date(`${release.date}T00:00:00Z`);
const historicalEvidenceRoots=new Set(['docs/evidence/crosstown-0.5.0','docs/evidence/crosstown-0.7.0','docs/evidence/crosstown-0.9.0','docs/evidence/crosstown-0.13.0']);
const historicalCaptureScope=JSON.parse(await readFile(resolve(root,'docs/SOURCE-ARCHIVE-EXCLUSIONS.json'),'utf8'));
const historicalCaptureExclusions=new Map(historicalCaptureScope.supplementalHistoricalCaptures.map(row=>[row.file,row]));
if(historicalCaptureExclusions.size!==51||historicalCaptureScope.historicalGalleryOriginals.length!==26||historicalCaptureScope.keptHistoricalGalleryOriginals.length!==1)throw Error('Review changed historical screenshot archive scope');
for(const file of historicalCaptureExclusions.keys())if(!/^docs\/screenshots\/[^/]+\.png$/.test(file))throw Error('Invalid historical capture exclusion: '+file);
const intermediateCaptureExclusions=new Map((historicalCaptureScope.inventoryOnlyLightingCaptures??[]).map(row=>[row.file,row]));
const galleryOriginalExclusions=new Map((historicalCaptureScope.inventoryOnlyGalleryOriginals??[]).map(row=>[row.file,row]));if(galleryOriginalExclusions.size!==25)throw Error('Review gallery original export scope');
for(const file of galleryOriginalExclusions.keys())if(!/^docs\/screenshots\/[^/]+\.png$/.test(file)||!historicalCaptureScope.historicalGalleryOriginals.includes(file))throw Error('Invalid gallery original exclusion: '+file);
for(const file of intermediateCaptureExclusions.keys())if(!/^docs\/evidence\/crosstown-0\.14\.0\/(?:pre-singlepass-|initial-|oldtown-initial-)[\w.-]+\.(?:webp|png)$/.test(file))throw Error('Invalid intermediate capture exclusion: '+file);
const files = ['.gitignore', '.env.example', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vercel.json', 'index.html', 'README.md', 'CREDITS.md', ...(await readdir(root)).filter(file => /^playwright.*\.ts$/.test(file))];
const directories = ['.github', 'src', 'tools', 'docs', 'assets', 'public', 'tests'];
const forbidden = new Set(['.git', '.arena', 'uploads', 'node_modules', 'dist', '.cache', '.npm', '.config', '.local', '.git-credentials', '.netrc', '.env']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
for(const item of [...evidenceManifest.runtimeSource.files,...evidenceManifest.verificationSource.files,...evidenceManifest.artifacts]){
 const bytes=await readFile(resolve(root,item.file));
 if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw Error(`Changed after final evidence generation: ${item.file}`);
}
async function collectExcluded(directory){
 for(const entry of (await readdir(resolve(root,directory),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const file=`${directory}/${entry.name}`;
  if(entry.isDirectory())await collectExcluded(file);
  else if(entry.isFile()){const bytes=await readFile(resolve(root,file));excluded.push({file,bytes:bytes.length,sha256:sha256(bytes)});}
  else throw Error(`Nonregular historical evidence: ${file}`);
 }
}
async function add(file) {
 const name=basename(file);if(forbidden.has(name)||name.startsWith('.env.')&&name!=='.env.example')throw Error(`Refusing sensitive path: ${file}`);
 const bytes=await readFile(resolve(root,file)),oldCapture=historicalCaptureExclusions.get(file)??intermediateCaptureExclusions.get(file)??galleryOriginalExclusions.get(file);
 if(oldCapture){if(bytes.length!==oldCapture.bytes||sha256(bytes)!==oldCapture.sha256)throw Error(`Historical capture changed; review before exclusion: ${file}`);excluded.push({...oldCapture,category:intermediateCaptureExclusions.has(file)?'Intermediate lighting capture, unchanged in workspace':galleryOriginalExclusions.has(file)?'Historical full-resolution gallery PNG; embedded preview included':'Supplemental historical PNG, unchanged in workspace'});return;}
 entries[`${prefix}/${file}`]=[bytes,{mtime}];
}
async function walk(directory) {
  for (const entry of (await readdir(resolve(root, directory), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${directory}/${entry.name}`;
    if (forbidden.has(entry.name)) throw new Error(`Refusing generated/sensitive directory: ${path}`);
    if(historicalEvidenceRoots.has(path)){if(!entry.isDirectory())throw Error(`Expected historical evidence directory: ${path}`);await collectExcluded(path);}
    else if (entry.isDirectory()) await walk(path); else if (entry.isFile()) await add(path); else throw new Error(`Refusing non-regular project entry: ${path}`);
  }
}
for (const file of files) await add(file);
for (const directory of directories) await walk(directory);
for(const file of [...historicalCaptureExclusions.keys(),...intermediateCaptureExclusions.keys(),...galleryOriginalExclusions.keys()])if(!excluded.some(row=>row.file===file))throw Error('Missing inventoried capture '+file);
for(const file of historicalCaptureScope.keptHistoricalGalleryOriginals)if(!entries[`${prefix}/${file}`])throw Error('Missing historical gallery original '+file);
entries[`${prefix}/ARCHIVE-EXCLUSIONS.json`]=[strToU8(JSON.stringify({purpose:'Raw historical 0.5/0.7/0.9/0.13 reports/captures, 51 supplemental historical PNGs, 25 full-resolution gallery PNGs and explicitly inventoried intermediate Step 14 capture pixels remain unchanged in the shared workspace but are not duplicated inside this rolling source ZIP, to respect workspace snapshot limits. Every 0.14 report/log, final candidate capture, source/asset/test/document, the README Wren PNG and the self-contained 26-preview historical gallery are included. Exclusion is not deletion or a changed test outcome.',roots:[...historicalEvidenceRoots],supplementalHistoricalCaptureList:'docs/SOURCE-ARCHIVE-EXCLUSIONS.json',files:excluded},null,2)+'\n'),{mtime}];
if (!entries[`${prefix}/playwright.fleet.config.ts`] || !entries[`${prefix}/public/audio/cars/kestrel/high-on.wav`]) throw new Error('Vehicle tests or restored prepared audio missing from archive');
entries[`${prefix}/ARCHIVE.txt`] = [strToU8(`Crosstown · Steps 01–14 prototype · ${version} / ${release.build}

Public address: https://crosstown-sarang-dev.vercel.app
Deployment status at handoff: ${results.deployment.status}
Landing: /   Immediate game: /play   Explicit session choices: /play?setup
Legacy root game queries/saves remain; original DESIGN unchanged.

Node.js ^20.19.0 or >=22.12.0. Run npm ci, then npm run dev.
Prepared licensed models/fonts/96 roster loops are included; no API key or Python needed to play.
Twelve cars/bikes and cabins, living streets, seven stylized tools, raycast police,
HUD/economy/services, six activities/five physical rivals and in-car radio.
TSL lighting/post, bounded surface effects/neon and ordered automatic scaling.
Lighting controls, exact off-cost boundaries and native benchmark limits: docs/LIGHTING.md.
No gore. Spotify is hidden without a public client ID; no client secret is used.
Provider setup, Premium/allowlist/approval limits and actual playback results: docs/RADIO.md.

Current full units: ${results.unitTests.passed}; integration phases: ${Object.entries(results.browsers).map(([k,v])=>`${k} ${v.passed}`).join('; ')}.
Six activity rows: ${results.activities.results.filter(r=>r.passed).length} finishes/rewards with explicit physical fixtures.
Radio: ${results.radio.passed} available-provider rows / ${results.radio.failedOrUnavailable} failed-or-unavailable; authenticated Spotify untested.
Landing: 320/390/768/1440 checks, no engine fetches before play.
Lighting: 14 isolated pixel effects + real windows/mirrors/car/impact/preferences checks on both backends.
Four busy-scene tiers measured on both SOFTWARE backends; actual intervals in docs/PROGRESS.md.
The local candidate is NOT the still-published 0.13.0 site. Do not confuse versions.
Read docs/TESTING.md and TEST-RESULTS.json for exact runs and revision boundaries.

IMPORTANT: Reported lag is NOT considered solved. Near60 FPS with three stars,
five rivals, ten near cars or busy Balanced / native target hardware is NOT accepted.
Strict traffic fairness/no-stuck, long continuous full-map/GPU-memory soak,
physical controller/wheel/rumble, human handling/listening remain OPEN.
Manual simulation steps and debug fixture placement are not real-time/human/FPS acceptance.
External provider readiness or a successful method call is not proof a track played or skipped.

Source/file map and dated journal: docs/PROGRESS.md. Issues: docs/FINDINGS.md.
Offline historical gallery: docs/PROGRESS-GALLERY.html (${results.checks.gallery.captures} captures).
All ${version} reports/logs, final candidate capture pixels, the README Wren PNG and 26 embedded historical previews are included.
Historical 0.5/0.7/0.9/0.13 raw evidence, 51 supplemental old PNGs, 25 full-resolution
gallery PNGs and inventoried intermediate lighting captures remain unchanged in the workspace, not duplicated here. ARCHIVE-EXCLUSIONS.json lists
every omitted path/size/SHA-256. Historical summaries and embedded gallery stay included.
Large raw reports restore exactly with gzip -dc; see docs/EVIDENCE-COMPRESSION.json.
ARCHIVE-MANIFEST.json inventories every OTHER entry; its own hash is not recursive.
Every ZIP entry was extracted in memory and hash-checked after writing.

Existing PRIVATE GitHub sarang-cmd/crosstown is not recreated/deleted; source push/hosted CI are pending.
One-time public-output transfer descriptors are excluded/retired; never redeploy them.
No node_modules/dist/uploads/.arena/local Git state/credentials/environment values are included.
Only the documented non-secret .env.example template is bundled.
`), { mtime }];
const manifest = Object.entries(entries).map(([file, [bytes]]) => ({ file: file.slice(prefix.length + 1), bytes: bytes.length, sha256: sha256(bytes) })).sort((a, b) => a.file.localeCompare(b.file));
entries[`${prefix}/ARCHIVE-MANIFEST.json`] = [strToU8(`${JSON.stringify({ name: 'Crosstown', version, build: release.build, date: release.date, purpose: 'Reviewed source handoff, not a GitHub push', files: manifest }, null, 2)}\n`), { mtime }];
const bytes = zipSync(entries, { level: 9 }), name = `${prefix}.zip`, file = resolve(root, name);
await writeFile(file, bytes);
const actual = unzipSync(await readFile(file));
if (Object.keys(actual).length !== Object.keys(entries).length) throw new Error('Archive entry count mismatch');
for (const [path, [expected]] of Object.entries(entries)) { const decoded = actual[path]; if (!decoded || decoded.length !== expected.length || sha256(decoded) !== sha256(expected)) throw new Error(`Archive roundtrip mismatch: ${path}`); }
const digest = sha256(bytes); let previous = '';
try { previous = await readFile(resolve(root, 'SHA256SUMS.txt'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const checksums = previous.split('\n').filter(line => line.trim() && !line.endsWith(`  ${name}`)); checksums.push(`${digest}  ${name}`);
await writeFile(resolve(root, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);
console.log(`${relative(root, file)} · ${version} · ${Object.keys(entries).length} files · ${bytes.length} bytes\nSHA-256 ${digest}\nEvery archive entry roundtrip-verified; ${excluded.length} historical evidence/capture paths inventory-only (unchanged in workspace); historical Coastline and crosstown-0.5.0 archives were not touched.`);
