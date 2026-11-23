// Download a reviewed GLB (or one GLB inside a ZIP), normalize, budget, compress and credit it reproducibly.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, posix, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { dedup, prune, weld, simplify, reorder, textureCompress } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { createIO, measure, normalizeDocument, nameKeyNodes, verifyNormalized, MeshoptEncoder, MeshoptSimplifier } from './asset-lib.mjs';
import { writeCredits } from './credits.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ALLOWED_LICENSES = new Set(['CC0-1.0', 'CC-BY-4.0']);
async function download(url, maxBytes = 64 * 1024 * 1024) {
  if (!/^https?:\/\//i.test(url)) throw new Error('A public http(s) source URL is required.');
  const response = await fetch(url, { headers: { 'User-Agent': 'Crosstown-Asset-Pipeline/0.5' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error(`Download exceeds ${maxBytes} bytes: ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
// Decode the public GLB container format, then supply relative images/buffers explicitly to NodeIO.
async function readSource(io, bytes, downloadBytes, archiveEntry, sourceUrl, sourceDirectory) {
  if (bytes.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported.');
  let json, binary;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (data.length !== length) throw new Error('Truncated GLB chunk.');
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    if (type === 0x004e4942) binary = data;
    offset += 8 + length;
  }
  if (!json) throw new Error('GLB JSON chunk missing.');
  const resources = {}, resourceReports = [];
  if (binary) {
    resources['__embedded.bin'] = binary;
    const buffer = json.buffers?.find(buffer => !buffer.uri);
    if (buffer) buffer.uri = '__embedded.bin';
  }
  const uris = [...new Set([...(json.images ?? []), ...(json.buffers ?? [])].map(resource => resource.uri).filter(uri => uri && uri !== '__embedded.bin' && !uri.startsWith('data:')))];
  const archivePaths = new Map(uris.map(uri => [uri, posix.normalize(posix.join(posix.dirname(archiveEntry ?? ''), decodeURIComponent(uri)))]));
  const selected = archiveEntry && uris.length ? unzipSync(downloadBytes, { filter: entry => [...archivePaths.values()].includes(entry.name) && entry.originalSize <= 64 * 1024 * 1024 }) : {};
  for (const uri of uris) {
    const resourceBytes = archiveEntry ? selected[archivePaths.get(uri)] : await download(new URL(uri, sourceUrl).href);
    if (!resourceBytes) throw new Error(`Missing external model resource: ${uri}`);
    resources[uri] = resourceBytes;
    resourceReports.push({ uri, sha256: sha256(resourceBytes), bytes: resourceBytes.length });
    const safePath = resolve(sourceDirectory, decodeURIComponent(uri));
    const relativePath = relative(sourceDirectory, safePath);
    if (relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) throw new Error('Resource path leaves its source directory.');
    await mkdir(dirname(safePath), { recursive: true });
    await writeFile(safePath, resourceBytes);
  }
  return { document: await io.readJSON({ json, resources }), resourceReports };
}
export async function prepareAsset(options) {
  const { id, url, title = id, author, license, source, licenseUrl, kind = 'prop', forward = '+Z', size: targetSize, expectedSha256, expectedDownloadSha256, archiveEntry, nodeMap = {} } = options;
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id ?? '')) throw new Error('Use a lowercase, hyphenated asset id.');
  if (!ALLOWED_LICENSES.has(license)) throw new Error('Only verified CC0-1.0 and CC-BY-4.0 assets are accepted.');
  if (!author || !source || !licenseUrl) throw new Error('Author, source and an asset-specific licence evidence URL are required.');
  if (!['car', 'character', 'prop'].includes(kind)) throw new Error('Kind must be car, character or prop.');
  const size = Number(targetSize);
  const licenseBytes = await download(licenseUrl, 2 * 1024 * 1024);
  const licenseText = licenseBytes.toString('utf8');
  const evidence = license === 'CC0-1.0' ? /CC0(?:[\s-]+1\.0)?|Creative Commons Zero|publicdomain\/zero/i : /CC[\s-]*BY[\s-]*4\.0|Creative Commons Attribution 4\.0/i;
  if (!evidence.test(licenseText)) throw new Error('The evidence page does not confirm the declared licence. Review the source; do not guess.');
  const downloaded = await download(url);
  const downloadSha256 = sha256(downloaded);
  if (expectedDownloadSha256 && downloadSha256 !== expectedDownloadSha256) throw new Error(`${id}: archive/download checksum has changed. Rejecting unreviewed source.`);
  let bytes = downloaded;
  if (archiveEntry) {
    // Read exactly one entry into memory; never extract untrusted archive paths onto the filesystem.
    const entries = unzipSync(downloaded, { filter: entry => entry.name === archiveEntry && entry.originalSize <= 64 * 1024 * 1024 });
    if (!entries[archiveEntry]) throw new Error(`Missing, oversized or invalid ZIP entry: ${archiveEntry}`);
    bytes = Buffer.from(entries[archiveEntry]);
  }
  if (bytes.subarray(0, 4).toString() !== 'glTF') throw new Error('Expected a self-contained binary glTF 2.0 (.glb), not HTML or an external-resource glTF.');
  const sourceSha256 = sha256(bytes);
  if (expectedSha256 && sourceSha256 !== expectedSha256) throw new Error(`${id}: source SHA-256 does not match the reviewed fixture. Rejecting changed download.`);
  const sourceDirectory = resolve(ROOT, 'assets/sources', id);
  const sourcePath = resolve(sourceDirectory, 'model.glb');
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(sourcePath, bytes);
  const io = await createIO();
  const { document, resourceReports } = await readSource(io, bytes, downloaded, archiveEntry, url, sourceDirectory);
  const sourceBytes = bytes.length + resourceReports.reduce((total, resource) => total + resource.bytes, 0);
  const normalization = normalizeDocument(document, { kind, size, forward });
  const nodeReport = nameKeyNodes(document, kind, nodeMap);
  const before = normalization.before;
  await document.transform(dedup(), prune({ keepExtras: true, keepLeaves: true }));
  if (kind === 'car' && measure(document).triangles > 60000) {
    await document.transform(weld());
    const ratio = Math.min(0.9, 55000 / measure(document).triangles);
    await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.012 }));
    if (measure(document).triangles > 60000) await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 0.7, error: 0.035 }));
    if (measure(document).triangles > 60000) throw new Error(`${id}: unable to meet the car triangle budget without excessive degradation; choose a lighter source.`);
  }
  await document.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86, effort: 70 }),
    reorder({ encoder: MeshoptEncoder, target: 'performance', cleanup: false }),
  );
  // FILTER compresses attributes/animations without quantization transforms that can break mixed rigid/skinned bounds.
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const outputPath = resolve(ROOT, 'public/models', `${id}.glb`);
  await mkdir(dirname(outputPath), { recursive: true });
  const outputBytes = await io.writeBinary(document);
  const report = {
    id, title, kind, author, license, licenseUrl, source, url, archiveEntry, sourceSha256, downloadSha256,
    sourceBytes, sourceGlbBytes: bytes.length, sourceResources: resourceReports, targetSize: size, targetDimension: kind === 'car' ? 'length' : 'height',
    units: 'metres', forward: '+Z', up: '+Y', pivot: 'ground-centre', sourceForward: forward,
    scale: normalization.factor, before, ...nodeReport,
    modifications: ['Y-up / +Z-forward normalization', `uniform scale to ${size} m ${kind === 'car' ? 'length' : 'height'}`, 'ground-centred root wrapper preserving skins and animations', 'key-node names normalized where source geometry permits', ...(kind === 'car' && before.triangles > 60000 ? ['mesh simplified to fit 60k triangle budget'] : []), 'textures resized to at most 1024 px and WebP-compressed where present', 'Meshopt FILTER geometry / animation compression'],
    compression: { geometry: 'EXT_meshopt_compression (FILTER)', textures: before.textures ? 'EXT_texture_webp' : 'none in source', maxTextureSize: 1024 },
  };
  const outputDocument = await io.readBinary(outputBytes);
  report.after = verifyNormalized(outputDocument, report);
  report.outputBytes = outputBytes.length;
  report.outputSha256 = sha256(outputBytes);
  report.savedBytesPercent = Math.round((1 - outputBytes.length / sourceBytes) * 100);
  await writeFile(outputPath, outputBytes);
  const reportPath = resolve(ROOT, 'docs/assets', `${id}.json`);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(ROOT, 'docs/assets', `${id}.license.txt`), `Licence evidence: ${licenseUrl}\nAsset source: ${source}\nDeclared licence: ${license}\nReviewed author: ${author}\n\n${licenseText}`);
  await writeCredits(ROOT);
  console.log(`${id}: ${report.after.dimensions.map(n => n.toFixed(3)).join(' × ')} m | ${report.after.triangles} tris | ${before.animations.length} → ${report.after.animations.length} clips | ${bytes.length} → ${outputBytes.length} bytes`);
  if (report.missingKeyNodes.length) console.log(`  No distinct source nodes (not fabricated): ${report.missingKeyNodes.join(', ')}`);
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) {
    console.log('Usage: npm run assets:prepare -- --id demo-car --url https://…/car.glb --kind car --size 4.5 --forward +Z --author "Artist" --license CC0-1.0 --source https://… --license-url https://…/LICENSE.md [--sha256 digest] [--archive-entry "Models/car.glb"] [--node-map mapping.json]');
    process.exit(0);
  }
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error(`Missing value for ${args[i]}`);
    values[args[i].slice(2)] = args[i + 1];
  }
  await prepareAsset({ ...values, licenseUrl: values['license-url'], expectedSha256: values.sha256, archiveEntry: values['archive-entry'], nodeMap: values['node-map'] ? JSON.parse(await readFile(values['node-map'], 'utf8')) : {} });
}
