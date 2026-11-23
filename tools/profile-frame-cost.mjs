// Unpaused software-renderer diagnostics, NEVER target-laptop FPS acceptance.
// BENCH_URL=http://127.0.0.1:5173 BENCH_LABEL=0.9-final node tools/profile-frame-cost.mjs
// Each scene gets a fresh Chromium process: a shared-process attempt timed out
// at second-page initialization. That attempt remains evidence, not a benchmark.
// Process lifetime differs from historical profiles: do not claim a strict A/B ratio.
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const url=process.env.BENCH_URL??'http://127.0.0.1:5173',label=process.env.BENCH_LABEL??'current';
if(!/^[\w.-]+$/.test(label))throw Error('Unsafe benchmark label');
const folder='docs/evidence/crosstown-0.9.0';await mkdir(folder,{recursive:true});
const args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const results=[],isolation='Fresh Chromium process for each scene, with an awaited explicit lab opening. Historical shared-process profiles are not a strict matched A/B comparison.';
let browser,currentScene,currentStage;
async function stage(scene,label,work,milliseconds=180000){
 currentScene=scene;currentStage=label;const begin=performance.now();console.log(scene,label,'START');let timer;
 try{const value=await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${scene}: ${label} exceeded ${milliseconds} ms`)),milliseconds);})]);console.log(scene,label,'DONE',Math.round(performance.now()-begin));return value;}
 catch(error){console.error(scene,label,'FAILED',String(error));throw error;}
 finally{clearTimeout(timer);}
}
async function frames(page,durationMs,minimum){
 return page.evaluate(({durationMs,minimum})=>new Promise(resolve=>{
  let start,previous;const times=[];
  function tick(t){if(start===undefined){start=previous=t;requestAnimationFrame(tick);return;}times.push(t-previous);previous=t;
   if((t-start>=durationMs&&times.length>=minimum)||t-start>60000){const s=[...times].sort((a,b)=>a-b);resolve({frames:times.length,wallMs:t-start,fps:times.length*1000/(t-start),p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],maximum:s.at(-1)});}else requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
 }),{durationMs,minimum});
}
async function closeBrowser(){if(!browser)return;const closing=browser;browser=undefined;let timer;try{await Promise.race([closing.close(),new Promise(resolve=>{timer=setTimeout(resolve,10000);})]);}finally{clearTimeout(timer);}}
try{
 for(const scene of['quick-rooftop','downtown-street','cockpit-lab']){
  browser=await stage(scene,'fresh browser',()=>chromium.launch({headless:true,args}),30000);
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:1,diagnostics:false}}));localStorage.setItem('crosstown:driving:v1',JSON.stringify({version:1,data:{cabin:'sedan',manual:false,assist:true}}));});
  const begin=performance.now();
  await stage(scene,'navigation',()=>page.goto(`${url}/?test&webgl&autostart&length=quick&seed=84173&date=2026-11-20&population=off`));
  await stage(scene,'game hooks',()=>page.waitForFunction(()=>!!window.__parkour&&!!window.__city&&!!window.__vehicles,undefined,{timeout:180000}));
  if(scene==='cockpit-lab'){
   await stage(scene,'await actual lab compile',()=>page.evaluate(()=>window.__vehicles.lab()));
   await page.keyboard.press('KeyO');await stage(scene,'engine start',()=>page.evaluate(()=>{window.__vehicles.step(340);window.__parkour.pause(false);}));
  }else if(scene==='downtown-street')await stage(scene,'street-view camera',()=>page.evaluate(()=>window.__city.fly({x:512,y:8,z:768},{x:512,y:4,z:1000})));
  else await stage(scene,'stationary runner input',()=>page.evaluate(()=>window.__parkour.input({x:0,z:0,jump:false,sprint:false,slide:false,interact:false,traverse:false})));
  await stage(scene,'hour',()=>page.evaluate(()=>window.__city.hour(15)));
  const readyWallMs=performance.now()-begin,warmup=await stage(scene,'20 actual warmup frames',()=>frames(page,1000,20),90000);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');
  const before=(await cdp.send('Performance.getMetrics')).metrics;await stage(scene,'CPU profiler start',()=>cdp.send('Profiler.start'),30000);
  const cadence=await stage(scene,'measured cadence',()=>frames(page,12000,12),90000),profile=(await stage(scene,'CPU profiler stop',()=>cdp.send('Profiler.stop'),30000)).profile,after=(await cdp.send('Performance.getMetrics')).metrics;
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),sampled=new Map();
  for(let i=0;i<(profile.samples?.length??0);i++){const f=nodes.get(profile.samples[i]).callFrame,name=`${f.functionName||'(anonymous)'} @ ${f.url.split('/').at(-1)}`;sampled.set(name,(sampled.get(name)??0)+(profile.timeDeltas[i]??0));}
  const topSamples=[...sampled].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([name,us])=>({name,ms:us/1000})),metrics={};
  for(const key of['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','JSHeapUsedSize']){const a=after.find(m=>m.name===key)?.value??0,b=before.find(m=>m.name===key)?.value??0;metrics[key]=key==='JSHeapUsedSize'?a:a-b;}
  const snapshot=await stage(scene,'final snapshot',()=>page.evaluate(()=>({parkour:window.__parkour.snapshot(),city:window.__city.snapshot(),vehicles:window.__vehicles.snapshot(),population:window.__population?.snapshot?.()})),30000);
  await writeFile(`${folder}/profile-${label}-${scene}.cpuprofile.gz`,gzipSync(JSON.stringify(profile)));
  const result={scene,readyWallMs,warmup,cadence,metrics,topSamples,snapshot,errors};results.push(result);
  console.log(label,scene,JSON.stringify({readyWallMs,warmup,cadence,metrics,draws:snapshot.parkour.draws,triangles:snapshot.parkour.triangles,top:topSamples.slice(0,8),errors},null,2));
  if(errors.length)throw Error(`${scene}: runtime/console errors recorded`);
  await cdp.detach();await page.close();await stage(scene,'browser retirement',closeBrowser,15000);
 }
}catch(error){console.error('PROFILE FAILED',String(error?.stack??error));await writeFile(`${folder}/profile-${label}-failure.json`,JSON.stringify({date:'2026-11-22',label,isolation,currentScene,currentStage,error:String(error?.stack??error),completedScenes:results.map(r=>r.scene),partial:results,notACompletedBenchmark:true},null,2)+'\n');throw error;}
finally{await closeBrowser();}
await writeFile(`${folder}/profile-${label}.json`,JSON.stringify({date:'2026-11-22',label,url,viewport:[1280,800],quality:'Balanced, fixed',population:'off; separate populated stress checks required',environment:'Forced WebGL 2 / software SwiftShader, unpaused actual display frames; not native GPU timing or target 60 FPS acceptance',isolation,historicalMatchedComparison:false,results},null,2)+'\n');
