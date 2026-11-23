// Actual display cadence, never manual/synthetic timing. Software != target GPU.
// Every setup stage is bounded/persisted. Do not overlap benchmark browsers.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const native=process.env.GRAPHICS==='native';
const base=process.env.BENCH_URL??'http://127.0.0.1:4193',label=process.env.LABEL??'candidate',backend=process.env.BACKEND??'webgl';
const tiers=(process.env.TIERS??'0,1,2,3').split(',').map(Number),folder='docs/evidence/crosstown-0.14.0',rows=[];
assert.match(label,/^[\w.-]+$/);assert.ok(['webgl','webgpu'].includes(backend));assert.ok(tiers.every(t=>Number.isInteger(t)&&t>=0&&t<=3));await mkdir(folder,{recursive:true});
const protocol='busy-v3: verified Downtown, fixed requested 60 cars/120 people before setup stepping, at least nine nearby chunks/two physical police, rain 18:15, normal rAF/simulation only';
function compact(s){const p=s.population,l=s.life;return{game:s.game,life:{police:l.police,challenges:{active:l.challenges.active,rivals:l.challenges.rivals},economy:l.economy},population:{cars:p.traffic.cars,pedestrians:p.pedestrians.count,fullPhysicsCars:p.fullPhysicsCars,pedestrianCapsules:p.pedestrianCapsules,budget:p.budget,maximumCpuMs:p.maximumCpuMs,maximumNearPhysicsMs:p.maximumNearPhysicsMs},effects:s.effects};}
async function save(running){await writeFile(`${folder}/${label}-busy-${backend}.json`,JSON.stringify({date:'2026-11-22',capturedAt:new Date().toISOString(),timezone:'Europe/Berlin',protocol,label,environment:native?'Requested native renderer; inspect captured adapter before hardware acceptance':'SwiftShader software renderer / virtual CPUs, NOT native 840M GPU or target-device acceptance',near60HardwareAcceptance:false,rows,...(running?{running}:{} )},null,2)+'\n');}
for(const tier of tiers){
 let browser,page;const errors=[],warnings=[],networkErrors=[];
 const row={tier,label,backend,viewport:[1920,1080],deviceScaleFactor:1,manualStepsDuringMeasurement:0,setupFixedSteps:100,nativeGPUAccepted:false,stages:[],drawCounterBoundary:'Most recent whole rendered frame including post/shadow/mirrors; Balanced refreshes shadows every fourth frame.'};
 async function stage(name,fn,timeoutMs=60000){
  const mark={name,startedAt:new Date().toISOString(),status:'running'};row.stages.push(mark);await save(row);console.log('STAGE',label,backend,tier,name);
  let timer;try{const result=await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>{browser?.close().catch(()=>{});reject(Error(`Stage ${name} exceeded ${timeoutMs}ms`));},timeoutMs);})]);mark.status='completed';mark.finishedAt=new Date().toISOString();return result;}catch(e){mark.status='failed';mark.error=String(e);throw e;}finally{clearTimeout(timer);await save(row);}
 }
 try{
  console.log('START',label,backend,tier);
  browser=await chromium.launch({headless:!native&&backend!=='webgpu',args:native?['--no-sandbox']:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',...(backend==='webgpu'?['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface']:[])]});
  page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)networkErrors.push({url:r.url(),status:r.status()});});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  await page.addInitScript(t=>localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:t,diagnostics:true}})),tier);
  await stage('cold-start-saved-tier',async()=>{await page.goto(`${base}/play?test&date=2026-11-20${backend==='webgl'?'&webgl':''}`,{waitUntil:'commit'});await page.waitForFunction(()=>!!window.__life,undefined,{polling:100,timeout:240000});},250000);
  row.fixture=await stage('enter-and-position-in-downtown',()=>page.evaluate(()=>{
   window.__vehicles.find('parked');if(!window.__vehicles.enter('parked'))throw Error('Could not enter actual parked car');window.__parkour.pause(true);
   const layout=window.__city.layout(),center=layout.districts.find(d=>d.id==='downtown').center;
   // Use a real road near the actual district center, not the old 512/768 point
   // whose interpolated endpoint crossed x=580 into Old Town.
   const node=layout.nodes.reduce((a,b)=>Math.hypot(b.x-center.x,b.z-center.z)<Math.hypot(a.x-center.x,a.z-center.z)?b:a),edge=layout.edges.find(e=>e.from===node.id&&e.kind!=='promenade'),next=layout.nodes[edge.to],yaw=Math.atan2(next.x-node.x,next.z-node.z);
   const p={x:node.x+(next.x-node.x)*.32+Math.cos(yaw)*3,y:node.y+.85,z:node.z+(next.z-node.z)*.32-Math.sin(yaw)*3};
   if(p.x>580||p.x< -600)throw Error('Selected point is not central Downtown');window.__vehicles.teleport(p,yaw);window.__vehicles.camera(3);
   return{position:p,yaw,districtTarget:'downtown',date:null,hour:18.25,weather:'rain',requestedPopulation:{cars:60,pedestrians:120,locked:true},wantedStars:3,debugSetupOnly:true};
  }));
  row.fixture.date=await stage('set-fixed-stress-and-weather-before-warmup',()=>page.evaluate(()=>{
   window.__population.density(60,120);let date;for(let d=1;d<=28;d++){date=`2026-11-${String(d).padStart(2,'0')}`;window.__city.date(date);if(window.__city.snapshot().environment.weather==='rain')break;}window.__city.hour(18.25);return date;
  }));
  await stage('flush-nearby-real-collision-chunks',()=>page.evaluate(p=>window.__city.flush(p),row.fixture.position));
  await stage('one-hundred-setup-physics-steps',()=>page.evaluate(()=>window.__vehicles.step(100)));
  await stage('prime-requested-density-and-start-pursuit',()=>page.evaluate(p=>{
   window.__population.prime(p);window.__police.clear();window.__police.stars(3);window.__vehicles.input({throttle:0,steering:0,brake:1});window.__parkour.pause(false);
  },row.fixture.position));
  await stage('settle-nine-chunks-and-physical-police',()=>page.waitForFunction(()=>{const p=window.__police.snapshot(),c=window.__city.snapshot();return p.stars>=3&&p.helicopter&&p.units.filter(u=>u.physicsEnabled).length>=2&&c.stream.centerLoaded&&c.stream.nearbyLoaded>=9&&c.stream.district==='downtown';},undefined,{polling:200,timeout:180000}),190000);
  const snap=()=>page.evaluate(()=>({game:window.__parkour.snapshot(),life:window.__life.snapshot(),population:window.__population.snapshot(),effects:window.__effects?.snapshot()}));
  row.build=await page.evaluate(()=>fetch('/release.json').then(r=>r.json()).then(r=>({version:r.version,build:r.build})));row.internalPixels=await page.locator('#world-canvas').evaluate(c=>[c.width,c.height]);row.before=compact(await snap());
  assert.equal(row.before.game.quality,['Low','Balanced','High','Ultra'][tier]);assert.equal(row.before.game.environment.weather,'rain');assert.equal(row.before.game.city.district,'downtown');assert.ok(row.before.population.cars>=50&&row.before.population.pedestrians>=40,'Actual stress actors missing');
  const cdp=await page.context().newCDPSession(page);row.gpu=await(await browser.newBrowserCDPSession()).send('SystemInfo.getInfo').then(r=>r.gpu.devices).catch(()=>[]);await page.evaluate(()=>window.__effects?.profileReset());
  if(tier===1){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  row.cadence=await stage('actual-display-intervals-no-manual-steps',()=>page.evaluate(()=>new Promise(resolve=>{
   let start,prev;const intervals=[];function frame(t){if(start===undefined){start=prev=t;requestAnimationFrame(frame);return;}intervals.push(t-prev);prev=t;if(t-start>=12000&&intervals.length>=8||t-start>=45000){const sorted=[...intervals].sort((a,b)=>a-b);resolve({frames:intervals.length,wallMs:t-start,fps:intervals.length*1000/(t-start),p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maximumMs:sorted.at(-1),intervals});}else requestAnimationFrame(frame);}requestAnimationFrame(frame);
  })),120000);
  if(tier===1){const{profile}=await cdp.send('Profiler.stop');await writeFile(`${folder}/${label}-${backend}-busy.cpuprofile.gz`,gzipSync(JSON.stringify(profile)));const nodes=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map();for(let i=0;i<(profile.samples?.length??0);i++){const f=nodes.get(profile.samples[i]).callFrame,key=`${f.functionName||'(anonymous)'} @ ${f.url.split('/').at(-1)}:${f.lineNumber}`;totals.set(key,(totals.get(key)??0)+(profile.timeDeltas[i]??0));}row.topCPU=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([name,us])=>({name,ms:us/1000}));}
  row.after=compact(await snap());row.cpuPhases=await page.evaluate(()=>window.__effects?.profile());row.resources=await page.evaluate(()=>window.__effects?.resources?.());
  await stage('capture-real-scene',async()=>sharp(await page.screenshot({type:'png',timeout:90000})).webp({quality:84}).toFile(`${folder}/${label}-${backend}-${tier}.webp`),100000);
  assert.deepEqual(errors,[]);assert.deepEqual(networkErrors,[]);assert.equal(row.after.game.city.district,'downtown');assert.ok(row.after.life.police.units.filter(u=>u.physicsEnabled).length>=2);row.completed=true;row.observedSoftwareNear60=row.cadence.fps>=55;
  console.log('RESULT',label,backend,tier,JSON.stringify({cadence:row.cadence,police:row.after.life.police.units.filter(u=>u.physicsEnabled).length,draws:row.after.game.draws,triangles:row.after.game.triangles,district:row.after.game.city.district,errors}));
 }catch(e){row.error=String(e.stack??e);console.error(row.error);process.exitCode=1;}
 finally{row.errors=errors;row.warnings=warnings;row.networkErrors=networkErrors;rows.push(row);if(browser)await browser.close();await save();}
}
