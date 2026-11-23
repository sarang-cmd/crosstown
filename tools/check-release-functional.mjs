// One writer per current report, sequential browsers. No software timing or
// unavailable provider is promoted to native/human/provider acceptance.
import{readFile,writeFile,open}from'node:fs/promises';import{spawn,execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const pkg=JSON.parse(await readFile('package.json','utf8')),dir=`docs/evidence/crosstown-${pkg.version}`,fingerprint=()=>{execFileSync(process.execPath,['tools/fingerprint-runtime.mjs',`${dir}/runtime-now.json`]);return JSON.parse(execFileSync(process.execPath,['-e',`console.log(require('fs').readFileSync('${dir}/runtime-now.json','utf8'))`],{encoding:'utf8'})).sha256;};
const before=JSON.parse(await readFile(`${dir}/tested-runtime-before.json`,'utf8'));if(before.sha256!==fingerprint())throw Error('Fingerprint changed before the batch');
const batch={release:pkg.version,runtimeBefore:before.sha256,startedAt:new Date().toISOString(),sequentialBrowsers:true,runs:[],nativeHardwareAcceptance:false};
const save=()=>writeFile(`${dir}/final-functional-batch.json`,JSON.stringify(batch,null,2)+'\n');await save();
const tasks=[
 {id:'static-and-units',tool:'package.json',command:['bash','-lc',`set -e; npm run typecheck > ${dir}/typecheck.log 2>&1; npm test > ${dir}/unit.log 2>&1; npm run assets:check > ${dir}/assets.log 2>&1; npm run check:versions > ${dir}/versions.log 2>&1`],seconds:300,log:'static-checks.log'},
 {id:'retained-production-pixels',tool:'playwright.production.config.ts',command:['bash','-lc',`xvfb-run -a npm run test:production; s=$?; node --input-type=module -e "import fs from'node:fs';import{gzipSync}from'node:zlib';if(fs.existsSync('.arena/production-results.json'))fs.writeFileSync('${dir}/production-browser.json.gz',gzipSync(fs.readFileSync('.arena/production-results.json')));"; exit $s`],seconds:600,log:'production-browser.log'},
 {id:'lighting-webgl',tool:'tools/accept-lighting.mjs',command:['node','tools/accept-lighting.mjs'],seconds:360,log:'lighting-webgl.log'},
 {id:'lighting-webgpu',tool:'tools/accept-lighting.mjs',command:['xvfb-run','-a','env','BACKEND=webgpu','node','tools/accept-lighting.mjs'],seconds:360,log:'lighting-webgpu.log'},
 {id:'city-life-webgl',tool:'tools/accept-city-life.mjs',command:['node','tools/accept-city-life.mjs'],seconds:360,log:'life-integration-webgl.log'},
 {id:'city-life-webgpu',tool:'tools/accept-city-life.mjs',command:['xvfb-run','-a','env','BACKEND=webgpu','node','tools/accept-city-life.mjs'],seconds:360,log:'life-integration-webgpu.log'},
 {id:'activities',tool:'tools/accept-activities.mjs',command:['node','tools/accept-activities.mjs'],seconds:300,log:'activity-route-acceptance.log'},
 {id:'landing',tool:'tools/accept-landing.mjs',command:['node','tools/accept-landing.mjs'],seconds:90,log:'landing-acceptance.log'},
 {id:'real-radio-providers',tool:'tools/accept-radio-providers.mjs',command:['node','tools/accept-radio-providers.mjs'],seconds:240,log:'radio-provider-acceptance.log',unavailableIsNotAcceptance:true},
 {id:'busiest-four-tiers-webgl',tool:'tools/profile-lighting.mjs',command:['node','tools/profile-lighting.mjs'],seconds:900,log:'candidate-busy-webgl.log',softwareIsNotNativeAcceptance:true},
 {id:'busiest-four-tiers-webgpu',tool:'tools/profile-lighting.mjs',command:['xvfb-run','-a','env','BACKEND=webgpu','node','tools/profile-lighting.mjs'],seconds:900,log:'candidate-busy-webgpu.log',softwareIsNotNativeAcceptance:true},
];
for(const task of tasks){
 const row={...task,collectorSha256:createHash('sha256').update(await readFile(task.tool)).digest('hex'),startedAt:new Date().toISOString(),status:'running'};batch.runs.push(row);await save();console.log('START',task.id,row.startedAt);
 const fd=await open(`${dir}/${task.log}`,'w'),start=performance.now();
 try{row.exitCode=await new Promise((resolve,reject)=>{const c=spawn('timeout',['--kill-after=10s',`${task.seconds}s`,...task.command],{stdio:['ignore',fd.fd,fd.fd]});c.once('error',reject);c.once('close',(code,signal)=>resolve(code??`signal:${signal}`));});}catch(e){row.error=String(e);row.exitCode=-1;}finally{await fd.close();}
 row.wallMs=performance.now()-start;row.finishedAt=new Date().toISOString();row.status=row.exitCode===0?'completed':'failed-or-unavailable';console.log('RESULT',task.id,row.exitCode,Math.round(row.wallMs)+'ms');await save();
}
execFileSync(process.execPath,['tools/fingerprint-runtime.mjs',`${dir}/tested-runtime-after.json`],{stdio:'inherit'});batch.runtimeAfter=JSON.parse(await readFile(`${dir}/tested-runtime-after.json`,'utf8')).sha256;batch.finishedAt=new Date().toISOString();batch.runtimeUnchanged=batch.runtimeBefore===batch.runtimeAfter;await save();
if(!batch.runtimeUnchanged||batch.runs.some(r=>r.exitCode!==0&&!r.unavailableIsNotAcceptance))process.exitCode=1;
