// Real shared-physics population checks. WATCH=1 observes two WALL minutes in a
// parked, occupied car; the manual soak is explicitly accelerated simulation.
// ADAPT=1 leaves density/Auto unlocked. No mode claims native GPU performance.
import {chromium, expect} from '@playwright/test';
import {writeFile, mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const compactPopulation=s=>s?{...s,traffic:{...s.traffic,agents:undefined,parkedAgents:undefined},pedestrians:{...s.pedestrians,agents:undefined}}:s;
const url=process.env.GAME_URL??'http://127.0.0.1:5173';
const label=process.env.POP_LABEL??'loaded-final-120s';
const watch=process.env.WATCH==='1', adapt=process.env.ADAPT==='1';
const seconds=Number(process.env.POP_SECONDS??120);
if(!/^[\w.-]+$/.test(label)||!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid evidence settings');
const directory='docs/evidence/crosstown-0.9.0';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let result;const errors=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.stack);});
 await page.addInitScript(adapt=>localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:adapt?'auto':1}})),adapt);
 await page.goto(`${url}/?test&length=quick&webgl&autostart&date=2026-11-20`,{timeout:90000});
 await page.waitForFunction(()=>!!window.__population,undefined,{timeout:180000});
 let anchor={x:520,y:.1,z:785};
 await page.evaluate(({p,adapt})=>{window.__parkour.pause(true);window.__city.hour(15);if(!adapt)window.__population.density(60,120);window.__city.street(p);window.__population.prime(p);},{p:anchor,adapt});
 await page.evaluate(p=>window.__city.flush(p),anchor);
 if(watch){
  const target=await page.evaluate(p=>window.__population.snapshot().traffic.parkedAgents.filter(c=>!c.taken&&window.__vehicles.services().zones.every(z=>Math.hypot(c.position.x-z.position.x,c.position.z-z.position.z)>16)).sort((a,b)=>Math.hypot(a.position.x-p.x,a.position.z-p.z)-Math.hypot(b.position.x-p.x,b.position.z-p.z))[0],anchor);
  await page.evaluate(async c=>{window.__population.find(c.id);await window.__city.flush(c.position);window.__parkour.pause(false);},target);
  await expect(page.locator('.vehicle-prompt')).toBeVisible({timeout:60000});await page.keyboard.press('KeyE');
  await page.waitForFunction(id=>window.__vehicles.snapshot().active===id,target.id);
  await page.evaluate(()=>{window.__vehicles.step(340);window.__vehicles.camera(2);});
  anchor=await page.evaluate(()=>window.__city.snapshot().position);
 }
 console.log('City ready',JSON.stringify({anchor,parkedCar:watch,densityLocked:!adapt}));
 await page.evaluate(()=>{
  const defs=Object.fromEntries(window.__vehicles.roster().map(c=>[c.id,c]));
  const a={ticks:0,overlapSamples:0,overlapExamples:[],redEntries:0,illegalCrossingSamples:0,maximumWaitSeconds:0,waiter:null,maximumGreenStationarySeconds:0,entries:0,maxFullPhysicsCars:0,nonfiniteStates:0,initial:new Map(),lastSeen:new Map(),moved:new Map(),wait:new Map(),green:new Map(),turns:new Map(),entered:new Set()};
  // Independent SAT using explicit world-space corners, not the game helper.
  function corners(c){const d=defs[c.definition],w=d.halfWidth-.025,l=d.halfLength-.025,s=Math.sin(c.yaw),v=Math.cos(c.yaw);return [[-w,-l],[w,-l],[w,l],[-w,l]].map(([x,z])=>[c.position.x+x*v+z*s,c.position.z-x*s+z*v]);}
  function hits(c,d){if(Math.abs(c.position.y-d.position.y)>1.5||Math.hypot(c.position.x-d.position.x,c.position.z-d.position.z)>8)return false;const A=corners(c),B=corners(d);for(const pts of[A,B])for(let i=0;i<4;i++){const p=pts[i],q=pts[(i+1)%4],axis=[q[1]-p[1],p[0]-q[0]],aa=A.map(v=>v[0]*axis[0]+v[1]*axis[1]),bb=B.map(v=>v[0]*axis[0]+v[1]*axis[1]);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;}
  window.populationAuditTick=state=>{const t=state.traffic,p=state.pedestrians;a.ticks++;a.time=t.time;a.maxFullPhysicsCars=Math.max(a.maxFullPhysicsCars,state.fullCars.size);
   for(const c of t.cars){if(!Object.values(c.position).every(Number.isFinite))a.nonfiniteStates++;if(!a.initial.has(c.id))a.initial.set(c.id,{position:{...c.position},time:t.time});a.lastSeen.set(c.id,t.time);a.moved.set(c.id,Math.max(a.moved.get(c.id)??0,Math.hypot(c.position.x-a.initial.get(c.id).position.x,c.position.z-a.initial.get(c.id).position.z)));
    const wait=c.speed<.05?(a.wait.get(c.id)??0)+1/60:0;a.wait.set(c.id,wait);if(wait>a.maximumWaitSeconds){a.maximumWaitSeconds=wait;a.waiter={id:c.id,state:c.state,position:{...c.position},progress:c.progress,stopAt:c.stopAt,time:t.time,desired:c.desiredSpeed};}
    const path=t.paths.get(c.lane),phase=((t.time+path.to%4*4)%80+80)%80,green=path.axis==='x'?phase<18:phase>=22&&phase<40;const g=c.speed<.05&&green?(a.green.get(c.id)??0)+1/60:0;a.green.set(c.id,g);a.maximumGreenStationarySeconds=Math.max(a.maximumGreenStationarySeconds,g);
    if(c.transition&&!a.turns.has(c.id)&&a.ticks>1){a.entries++;a.entered.add(c.id);if(!green)a.redEntries++;}if(c.transition)a.turns.set(c.id,c.transition.node);else a.turns.delete(c.id);
   }
   if(a.ticks%6===0){const all=[...t.cars,...t.parked.filter(c=>!c.taken)];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)if(hits(all[i],all[j])){a.overlapSamples++;if(a.overlapExamples.length<8)a.overlapExamples.push({time:t.time,a:all[i].id,b:all[j].id});}for(const person of p.agents)if(person.crossing){const phase=((t.time+person.crossingNode%4*4)%80+80)%80;if(phase<44)a.illegalCrossingSamples++;}}
  };
  window.populationAuditResult=()=>{const eligible=[...a.initial].filter(([id,v])=>a.lastSeen.get(id)-v.time>=30);return {...a,minimumObservedAgentAgeSeconds:30,eligibleAgents:eligible.length,initial:undefined,lastSeen:undefined,moved:undefined,wait:undefined,green:undefined,turns:undefined,entered:undefined,starved:eligible.filter(([id])=>(a.moved.get(id)??0)<1).map(([id,v])=>({id,observedSeconds:a.lastSeen.get(id)-v.time,distance:a.moved.get(id)})),neverEnteredInitialCohort:[...a.initial].filter(([,v])=>v.time<1).filter(([id])=>!a.entered.has(id)).map(([id])=>id)};};
 });
 const initial=await page.evaluate(()=>({city:window.__city.snapshot(),population:window.__population.snapshot(),vehicles:window.__vehicles.snapshot()}));
 const begin=performance.now(),snapshots=[];
 if(watch){
  await page.evaluate(()=>{window.__population.observe(window.populationAuditTick);window.__parkour.pause(false);window.displayFrames=[];let last;const f=t=>{if(last!==undefined)window.displayFrames.push(t-last);last=t;window.displayRequest=requestAnimationFrame(f);};window.displayRequest=requestAnimationFrame(f);});
  await page.waitForTimeout(seconds*1000);
  result=await page.evaluate(()=>{window.__parkour.pause(true);window.__population.observe(undefined);cancelAnimationFrame(window.displayRequest);const a=window.displayFrames,s=[...a].sort((a,b)=>a-b),wall=a.reduce((a,b)=>a+b,0);return {audit:window.populationAuditResult(),snapshot:window.__population.snapshot(),vehicle:window.__vehicles.snapshot(),quality:window.__parkour.snapshot(),cadence:{frames:a.length,wallMs:wall,fps:a.length*1000/wall,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)}};});
 }else{
  await page.evaluate(()=>window.__population.rendering(false));
  for(let i=0;i<Math.ceil(seconds/5);i++){
   await page.evaluate(({p,ticks})=>window.__population.step(ticks,p,window.populationAuditTick),{p:anchor,ticks:Math.min(300,Math.round((seconds-i*5)*60))});
   const s=await page.evaluate(()=>window.__population.snapshot());
   if(i===0||i%6===5||i===Math.ceil(seconds/5)-1)snapshots.push(s);
   console.log('t',s.traffic.time.toFixed(2),'full',s.fullPhysicsCars,'entered',s.traffic.stats.enteredIntersections,'overlap',s.traffic.stats.overlapFrames);
  }
  result={audit:await page.evaluate(()=>window.populationAuditResult()),snapshots};await page.evaluate(()=>window.__population.rendering(true));
 }
 const measuredWallMs=performance.now()-begin;
 const frame=await page.evaluate(()=>window.__vehicles.snapshot().renderFrames);await page.waitForFunction(f=>window.__vehicles.snapshot().renderFrames>f+2,frame);
 await page.evaluate(()=>{document.querySelector('#pause-overlay').hidden=true;document.body.classList.remove('run-paused');document.querySelector('#hud').classList.remove('is-paused');});
 await page.screenshot({path:`docs/screenshots/09-${label}.png`});
 result={date:'2026-11-22',label,mode:watch?'Actual unpaused wall-time observation in a parked, occupied street car':'Manually stepped loaded city / real shared Rapier world / NOT real-time FPS',renderer:'SwiftShader / forced WebGL2; NOT target hardware',forcedBudget:!adapt,adaptiveAuto:adapt,anchor,requestedSeconds:seconds,measuredWallMs,errors,initial,...result};
 const rawName=`population-${label}-raw.json.gz`;
 await writeFile(`${directory}/${rawName}`,gzipSync(JSON.stringify(result),{level:9}));
 const summary={...result,rawEvidence:rawName,initial:{...result.initial,city:{...result.initial.city,stream:Object.fromEntries(Object.entries(result.initial.city.stream).filter(([,v])=>v===null||typeof v!=='object'))},population:compactPopulation(result.initial.population)},snapshot:compactPopulation(result.snapshot),snapshots:result.snapshots?.map(compactPopulation),strictNoStuckAccepted:false,nativeNear60FpsAccepted:false};
 await writeFile(`${directory}/population-${label}.json`,JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({errors,audit:result.audit,cadence:result.cadence,wallMs:result.measuredWallMs,quality:result.quality?.quality,budget:result.snapshot?.budget},null,2));
 if(errors.length||result.audit.overlapSamples||result.audit.redEntries||result.audit.illegalCrossingSamples||result.audit.nonfiniteStates||result.audit.starved.length)process.exitCode=1;
}finally{await browser.close();}
