// Prepare a one-time checksum-pinned transfer of ALREADY TESTED public dist only.
// Does not deploy, start a server, expose source, or change account access controls.
// 1. node tools/prepare-public-release.mjs
// 2. Serve the printed archive using tools/serve-release.mjs through a temporary HTTPS tunnel.
// 3. TRANSFER_BASE=https://the-actual-tunnel-host node tools/prepare-public-release.mjs
//    supplies small connector descriptor files under .arena, not in the source ZIP.
// Stop transfer/tunnel after deployment + anonymous hashes; never redeploy a retired descriptor.
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const json = async p => JSON.parse(await readFile(resolve(root,p),'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const pkg = await json('package.json'), release = await json('public/release.json'), built = await json('dist/release.json');
if (!/^\d+\.\d+\.\d+$/.test(pkg.version) || built.version !== pkg.version || built.build !== release.build || built.name !== 'Crosstown') throw Error('Build is stale or not this release');
const directory = resolve(root,`.arena/releases/crosstown-${pkg.version}`), name = `crosstown-${pkg.version}.tar.gz`, archive = resolve(directory,name);
await mkdir(directory,{recursive:true});
const files = [];
async function walk(dir='') {
  for (const entry of (await readdir(resolve(root,'dist',dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const path = dir?`${dir}/${entry.name}`:entry.name;
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) { const b = await readFile(resolve(root,'dist',path)); files.push({path,bytes:b.length,sha256:sha(b)}); }
    else throw Error(`Refusing non-regular public path: ${path}`);
  }
}
await walk();
if (!files.some(f=>f.path==='index.html') || files.some(f=>f.path.endsWith('.map'))) throw Error('Missing public index or unexpected source maps');
execFileSync('tar',['--sort=name',`--mtime=${release.date}T00:00:00Z`,'--owner=0','--group=0','--numeric-owner','-I','gzip -n -9','-cf',archive,'dist'],{cwd:root});
const bytes = await readFile(archive), hash = sha(bytes), listing = execFileSync('tar',['-tf',archive],{encoding:'utf8'}).trim().split('\n');
if (listing.some(p=>!p.startsWith('dist/')||p.split('/').includes('..'))) throw Error('Unsafe public archive paths');
const check = resolve(directory,'local-roundtrip'); await rm(check,{recursive:true,force:true}); await mkdir(check);
execFileSync('tar',['-xf',archive,'-C',check]);
for (const f of files) if (sha(await readFile(resolve(check,'dist',f.path))) !== f.sha256) throw Error(`Roundtrip failed: ${f.path}`);
const publicBuild = {version:pkg.version,build:release.build,date:release.date,publicFiles:files.length,source:'Locally typechecked/built public Vite output. Deployment verification is separate; no private source, credentials or source maps in transfer.',archiveBytes:bytes.length,archiveSha256:hash,independentLocalRoundtrip:true,files};
await writeFile(resolve(root,'docs/PUBLIC-BUILD.json'),JSON.stringify(publicBuild,null,2)+'\n');
const transfer = {archive,bytes:bytes.length,sha256:hash,publicFiles:files.length,version:pkg.version,build:release.build};
await writeFile(resolve(directory,'transfer.json'),JSON.stringify(transfer,null,2)+'\n');
if (process.env.TRANSFER_BASE) {
  const base = new URL(process.env.TRANSFER_BASE); if (base.protocol!=='https:'||base.username||base.password) throw Error('Transfer must use the actual credential-free HTTPS tunnel');
  const url = new URL(name,`${base.origin}/`).href;
  const importer = `// ONE-TIME verified public-output import. Retire after this deployment.\nimport {createHash} from 'node:crypto';\nimport {writeFileSync,readFileSync,rmSync} from 'node:fs';\nimport {execFileSync} from 'node:child_process';\nconst r=await fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(120000)});\nif(!r.ok)throw Error('Public transfer HTTP '+r.status);\nconst b=Buffer.from(await r.arrayBuffer()),h=createHash('sha256').update(b).digest('hex');\nif(b.length!==${bytes.length}||h!==${JSON.stringify(hash)})throw Error('Public transfer checksum mismatch');\nwriteFileSync('release.tar.gz',b);\nconst entries=execFileSync('tar',['-tf','release.tar.gz'],{encoding:'utf8'}).trim().split('\\n');\nif(entries.some(p=>!p.startsWith('dist/')||p.split('/').includes('..')))throw Error('Unsafe archive');\nexecFileSync('tar',['-xf','release.tar.gz']);rmSync('release.tar.gz');\nconst v=JSON.parse(readFileSync('dist/release.json','utf8'));\nif(v.version!==${JSON.stringify(pkg.version)}||v.build!==${JSON.stringify(release.build)}||v.name!=='Crosstown')throw Error('Wrong release');\nconsole.log('VERIFIED CROSSTOWN '+v.version+' / '+v.build+' SHA256 '+h+' '+b.length+' bytes');\n`;
  const manifest = {name:'crosstown-release-transfer',private:true,version:pkg.version,type:'module',scripts:{build:'node import-release.mjs'},devDependencies:{vite:'7.1.7'}};
  const config = await json('vercel.json');
  const descriptorFiles = [
    {file:'package.json',data:JSON.stringify(manifest)},
    {file:'import-release.mjs',data:importer},
    {file:'vercel.json',data:JSON.stringify({$schema:config.$schema,headers:config.headers,rewrites:config.rewrites})},
  ];
  for (const f of descriptorFiles) await writeFile(resolve(directory,f.file),f.data);
  await writeFile(resolve(directory,'connector-files.json'),JSON.stringify(descriptorFiles.map(f=>({...f,data:Buffer.from(f.data).toString('base64'),encoding:'base64'})),null,2)+'\n');
  console.log(`One-time connector descriptors: ${directory}/connector-files.json\nRetire them and stop tunnel/server after hashes. Do not package/redeploy descriptors.`);
}
console.log(JSON.stringify(transfer,null,2));
