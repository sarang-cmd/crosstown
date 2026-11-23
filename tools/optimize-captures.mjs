// Lossless PNG encoding only: no crop, resize, palette quantization or pixel edits.
// This reduces portable/snapshot size; it is not image retouching or a game FPS fix.
// Verify every decoded channel byte before replacing a capture. Keep a hash audit.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const directory = 'docs/screenshots', auditPath = 'docs/SCREENSHOT-LOSSLESS.json';
const sha = b => createHash('sha256').update(b).digest('hex');
let prior = { date: '2026-11-22', purpose: 'Lossless PNG compression, exact decoded pixels/telemetry retained; not retouching or performance evidence', runs: [] };
try { prior = JSON.parse(await readFile(auditPath,'utf8')); } catch (e) { if(e.code !== 'ENOENT') throw e; }
const files = [];
for (const name of (await readdir(directory)).filter(n=>n.endsWith('.png')).sort()) {
  const path = `${directory}/${name}`, input = await readFile(path);
  const before = await sharp(input).raw().toBuffer({resolveWithObject:true});
  const encoded = await sharp(input).png({compressionLevel:9,adaptiveFiltering:true,palette:false}).toBuffer();
  const after = await sharp(encoded).raw().toBuffer({resolveWithObject:true});
  if (before.info.width!==after.info.width || before.info.height!==after.info.height || before.info.channels!==after.info.channels || !before.data.equals(after.data)) throw Error(`Refusing pixel change: ${path}`);
  const output = encoded.length < input.length ? encoded : input;
  if (output !== input) await writeFile(path,output);
  files.push({path,beforeBytes:input.length,afterBytes:output.length,beforeSha256:sha(input),afterSha256:sha(output),width:before.info.width,height:before.info.height,channels:before.info.channels,pixelsSha256:sha(before.data),decodedPixelsIdentical:true});
}
const run = { files, bytesBefore:files.reduce((n,f)=>n+f.beforeBytes,0),bytesAfter:files.reduce((n,f)=>n+f.afterBytes,0),allDecodedPixelsIdentical:true };
prior.runs.push(run); await writeFile(auditPath,JSON.stringify(prior,null,2)+'\n');
console.log(`PASS ${files.length} screenshots: identical decoded pixels. ${run.bytesBefore} -> ${run.bytesAfter} bytes; saved ${run.bytesBefore-run.bytesAfter}. Telemetry unchanged.`);
