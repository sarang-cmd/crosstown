// Actual display cadence in populated Step 10/12 loads. No FPS stubs/manual stepping while measured.
// Software observations cannot accept the native-hardware 60 FPS requirement.
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='docs/evidence/crosstown-0.13.0',rows=[],backend='webgl';
let browser;
try {
 for(const scene of ['three-star-pursuit','five-rival-race']){
   console.log('START',scene);
   browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
   const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],warnings=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
   await page.addInitScript(()=>localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:1,diagnostics:false}})));
   await page.goto('http://127.0.0.1:4193/play?test&webgl&date=2026-11-20',{waitUntil:'commit'});
   await page.waitForFunction(()=>!!window.__life,undefined,{polling:100,timeout:180000});
   await page.evaluate(async scene=>{
     window.__vehicles.find('parked');window.__vehicles.enter('parked');window.__vehicles.step(340);
     if(scene==='five-rival-race'){
       const a=window.__challenges.snapshot().activities.find(a=>a.type==='race'),n=a.route[1],yaw=Math.atan2(n.x-a.start.x,n.z-a.start.z);
       window.__vehicles.teleport({...a.start,y:a.start.y+.75},yaw);await window.__city.flush(a.start);window.__vehicles.step(60);
     }
     const pos=window.__parkour.snapshot().vehicle.position;
     window.__population.density(60,120);window.__population.prime(pos);window.__parkour.pause(false);
     if(scene==='three-star-pursuit')window.__police.stars(3);else window.__challenges.start('activity-race');
     window.__vehicles.input({throttle:0,steering:0,brake:1});window.__city.hour(15);
   },scene);
   await page.waitForFunction(scene=>{const life=window.__life.snapshot();return scene==='three-star-pursuit'?life.police.stars===3&&life.police.helicopter===true:life.challenges.rivals.filter(r=>r.active).length===5;},scene,{polling:100,timeout:45000});
   const snap=()=>page.evaluate(()=>({game:window.__parkour.snapshot(),life:window.__life.snapshot(),population:window.__population.snapshot()}));
   const before=await snap();
   assert.equal(before.game.backend,'WebGL 2');assert.equal(before.game.paused,false);
   if(scene==='three-star-pursuit'){assert.equal(before.life.police.stars,3);assert.equal(before.life.police.helicopter,true);}else assert.equal(before.life.challenges.rivals.filter(r=>r.active).length,5);
   const cadence=await page.evaluate(()=>new Promise(resolve=>{
     let start,previous;const intervals=[];
     function tick(t){if(start===undefined){start=previous=t;requestAnimationFrame(tick);return;}intervals.push(t-previous);previous=t;
       if(t-start>=12000&&intervals.length>=12||t-start>=60000){const sorted=[...intervals].sort((a,b)=>a-b);resolve({frames:intervals.length,wallMs:t-start,fps:intervals.length*1000/(t-start),p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maximumMs:sorted.at(-1),intervals});}else requestAnimationFrame(tick);
     }requestAnimationFrame(tick);
   }));
   const after=await snap();assert.deepEqual(errors,[]);
   const row={scene,quality:'fixed Balanced',requestedPopulation:{cars:60,pedestrians:120,lockedForStressFixture:true},debugSetupOnly:true,manualStepsDuringMeasurement:0,before,cadence,after,errors,warnings,observedSoftwareNear60:cadence.fps>=55,nativeHardwareAccepted:false};rows.push(row);
   console.log('RESULT',scene,JSON.stringify({cadence,errors,observedSoftwareNear60:row.observedSoftwareNear60}));
   await page.close();await browser.close();browser=undefined;
 }
} catch(e){console.error(e.stack??e);process.exitCode=1;rows.push({failed:true,error:String(e.stack??e)});}
finally {if(browser)await browser.close();await writeFile(`${folder}/populated-performance-${backend}.json`,JSON.stringify({date:'2026-11-22',backend,environment:'SwiftShader software rendering; NOT native GPU or target-device acceptance',viewport:[1280,800],nativeHardwareAvailable:false,near60Acceptance:'OPEN; software result is not a native pass',rows},null,2)+'\n');}
