// Lossless raw-evidence storage only. No field, embedded capture or telemetry edits.
// Run after completed observations; readable TEST-RESULTS summaries remain separate.
// --current archives this package version; default retains the historical 0.9 mode.
// Each gzip is decoded/hash-checked before the original is unlinked. Exact bytes restore
// with: gzip -dc path/report.json.gz > path/report.json (also works for .log.gz).
import {readdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const auditPath='docs/EVIDENCE-COMPRESSION.json',audit=JSON.parse(await readFile(auditPath,'utf8'));
const pkg=JSON.parse(await readFile('package.json','utf8'));
const explicit=process.argv.find(a=>a.startsWith('--release='))?.slice(10),version=explicit??(process.argv.includes('--current')?pkg.version:'0.9.0'),threshold=Number(process.argv.find(a=>a.startsWith('--threshold='))?.slice(12)??100000);
if(!/^\d+\.\d+\.\d+$/.test(version)||!Number.isInteger(threshold)||threshold<1000)throw Error('Invalid release/threshold');
const prefix=process.argv.find(a=>a.startsWith('--prefix='))?.slice(9)??'';if(!/^[\w.-]*$/.test(prefix))throw Error('Invalid prefix');
const directory=`docs/evidence/crosstown-${version}`;
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const item of audit.files){const b=await readFile(item.compressedPath);if(b.length!==item.compressedBytes||sha(b)!==item.compressedSha256||sha(gunzipSync(b))!==item.originalSha256)throw Error(`Existing archived evidence changed: ${item.compressedPath}`);}
let saved=0,count=0;
for(const name of (await readdir(directory)).sort()){
 if(!/\.(?:json|log)$/.test(name)||!name.startsWith(prefix))continue;
 const originalPath=`${directory}/${name}`,input=await readFile(originalPath);
 if(input.length<=threshold)continue;
 if(audit.files.some(f=>f.originalPath===originalPath))throw Error(`Refusing to overwrite prior audit after rerun: ${originalPath}`);
 const compressedPath=`${originalPath}.gz`,compressed=gzipSync(input,{level:9});
 if(!gunzipSync(compressed).equals(input))throw Error(`Gzip roundtrip mismatch: ${originalPath}`);
 await writeFile(compressedPath,compressed,{flag:'wx'});
 const stored=await readFile(compressedPath);if(!gunzipSync(stored).equals(input))throw Error(`Stored gzip mismatch: ${compressedPath}`);
 audit.files.push({originalPath,compressedPath,originalBytes:input.length,originalSha256:sha(input),compressedBytes:compressed.length,compressedSha256:sha(compressed)});
 // Save the restoration audit before removing the redundant uncompressed copy.
 audit.purpose='Lossless raw JSON/log archival compression to retain original source assets, capture pixels and historical release ZIPs within workspace limits. Every gzip restores exact original bytes/hash; no telemetry or embedded capture is edited. Readable current summaries remain in TEST-RESULTS.json.';
 audit.restore='gzip -dc path/report.json.gz > path/report.json (also valid for .log.gz)';
 await writeFile(auditPath,JSON.stringify(audit,null,2)+'\n');await unlink(originalPath);
 count++;saved+=input.length-compressed.length;
}
console.log(`PASS ${audit.files.length} audited gzip restorations; newly archived ${count} raw reports/logs from ${directory}, saved ${saved} bytes, no content changes.`);
