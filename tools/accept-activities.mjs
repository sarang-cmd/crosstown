// Actual loaded-city chassis, gates, records and bank. Positioning is setup only.
// Pilots use only steering/pedals, never impulses, teleports, edits or injected rewards during a run.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const folder=process.env.EVIDENCE_DIR??'docs/evidence/crosstown-0.14.0',rows=[],errors=[];
let damageFailure,reload;
const b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let p;
try {
 p=await b.newPage({viewport:{width:1280,height:800}});
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{if(!localStorage.getItem('crosstown:settings:v1'))localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:0}}));});
 await p.goto('http://127.0.0.1:4193/play?test&webgl&population=off&date=2026-11-20',{waitUntil:'commit'});
 await p.waitForFunction(()=>!!window.__life,undefined,{polling:100,timeout:180000});
 await p.evaluate(()=>{window.__population.rendering(false);window.__vehicles.find('parked');window.__vehicles.enter('parked');window.__vehicles.step(340);});
 const list=await p.evaluate(()=>window.__challenges.snapshot().activities);
 async function capture(type,before,trace){
   const a=list.find(a=>a.type===type);
   const after=await p.evaluate(()=>({challenge:window.__challenges.snapshot(),cash:window.__life.snapshot().economy.cash,car:window.__parkour.snapshot().vehicle}));
   const best=after.challenge.best[a.id]??[];
   const row={type,before,after,trace,pass:after.challenge.active?.state==='finished'&&after.cash===before+a.reward&&best.length>0&&best.length<=3&&best.some(r=>r.reward===a.reward)};
   rows.push(row);console.log('RESULT',type,row.pass,after.challenge.active?.reason);
 }
 for(const type of ['trial','delivery','speed','race']){
   const a=list.find(a=>a.type===type);
   await p.evaluate(async a=>{window.__challenges.cancel();const n=a.route[1],yaw=Math.atan2(n.x-a.start.x,n.z-a.start.z);window.__vehicles.teleport({...a.start,y:a.start.y+.75},yaw);await window.__city.flush(a.start);window.__vehicles.step(60);window.__police.clear();window.__parkour.pause(false);},a);
   const before=await p.evaluate(()=>window.__life.snapshot().economy.cash);
   assert.equal(await p.evaluate(id=>window.__challenges.start(id),a.id),true);
   const trace=[];
   for(let n=0;n<Math.ceil(a.limit/10)+1;n++){
     const s=await p.evaluate(()=>({result:window.__challenges.pilot(600,22),car:window.__parkour.snapshot().vehicle,police:window.__police.snapshot().stars}));trace.push(s);
     console.log(type,n,JSON.stringify(s));if(s.result?.state!=='running')break;
   }
   await capture(type,before,trace);
 }
 for(const type of ['drift','stunt']){
   const a=list.find(a=>a.type===type),pos={x:a.start.x+18,y:a.start.y+.75,z:a.start.z-(type==='stunt'?40:25)};
   await p.evaluate(async({pos})=>{window.__challenges.cancel();window.__vehicles.teleport(pos,0);await window.__city.flush(pos);window.__vehicles.step(60);window.__vehicles.assist(false);window.__police.clear();window.__parkour.pause(false);},{pos});
   const before=await p.evaluate(()=>window.__life.snapshot().economy.cash);
   assert.equal(await p.evaluate(id=>window.__challenges.start(id),a.id),true);
   const trace=await p.evaluate(type=>{
     const trace=[],limit=type==='drift'?2220:1080;
     for(let tick=0;tick<limit;tick++){
       const car=window.__parkour.snapshot().vehicle;
       const high=car.slip>.2;
       // Feedback countersteering prevents a handbrake spin from becoming a stationary donut.
       // This is an explicit debug pilot, not human-controller or frame-rate acceptance.
       const input=type==='drift'?{throttle:1,steering:tick<180?0:high?-.7:.8,handbrake:tick>=180&&!high&&car.speed>10&&tick%120<30}:{throttle:.9,steering:0};
       window.__vehicles.input(input);window.__life.stepCity(1);
       const result=window.__challenges.snapshot().active;
       if(tick%60===0||result?.state!=='running')trace.push({tick,input,result,car:window.__parkour.snapshot().vehicle});
       if(result?.state!=='running')break;
     }
     return trace;
   },type);
   console.log(type,JSON.stringify(trace));await capture(type,before,trace);
 }
 // Collision, not the test damage()/velocity() hooks. Normal throttle into the solid rear wall.
 const garage=await p.evaluate(()=>window.__city.layout().markers.find(m=>m.type==='garage'));
 await p.evaluate(async m=>{window.__challenges.cancel();const pos={x:m.position.x,y:m.position.y+.9,z:m.position.z+74};window.__vehicles.teleport(pos,Math.PI);await window.__city.flush(pos);window.__vehicles.step(60);window.__police.clear();window.__parkour.pause(false);},garage);
 const beforeDamage=await p.evaluate(()=>({car:window.__parkour.snapshot().vehicle,cash:window.__life.snapshot().economy.cash,bests:window.__challenges.snapshot().best}));
 assert.equal(await p.evaluate(()=>window.__challenges.start('activity-delivery')),true);
 const crash=await p.evaluate(()=>{const trace=[];for(let tick=0;tick<1800;tick++){window.__vehicles.input({throttle:1,steering:0});window.__life.stepCity(1);const run=window.__challenges.snapshot().active;if(tick%60===0||run?.state!=='running')trace.push({tick,run,car:window.__parkour.snapshot().vehicle});if(run?.state!=='running')break;}return{trace,run:window.__challenges.snapshot().active,car:window.__parkour.snapshot().vehicle,cash:window.__life.snapshot().economy.cash,bests:window.__challenges.snapshot().best};});
 assert.equal(crash.run?.state,'failed','an ordinary-input collision must exceed the damage limit');
 assert.match(crash.run.reason,/cargo damage limit exceeded/);
 assert.ok(crash.car.damage-beforeDamage.car.damage>.18);
 assert.equal(crash.cash,beforeDamage.cash);assert.deepEqual(crash.bests,beforeDamage.bests);
 damageFailure={passed:true,debugPositioning:true,ordinaryPedalsAndCollision:true,before:beforeDamage,after:crash,hudCheckPending:true};
 await p.evaluate(()=>window.__population.rendering(true));
 await p.waitForFunction(()=>document.querySelector('#activity-detail')?.textContent.includes('cargo damage limit exceeded'),undefined,{polling:100,timeout:30000});
 const detail=await p.locator('#activity-detail').textContent();
 await p.screenshot({path:folder+'/delivery-collision-failure.png'});
 damageFailure={passed:true,debugPositioning:true,ordinaryPedalsAndCollision:true,before:beforeDamage,after:crash,hudDetail:detail};
 console.log('PASS delivery collision failure; unchanged bank and bests');
 const expected=await p.evaluate(()=>({cash:window.__life.snapshot().economy.cash,bests:window.__challenges.snapshot().best}));
 await p.reload({waitUntil:'commit'});
 await p.waitForFunction(()=>!!window.__life,undefined,{polling:100,timeout:180000});
 const loaded=await p.evaluate(()=>({cash:window.__life.snapshot().economy.cash,bests:window.__challenges.snapshot().best}));
 assert.deepEqual(loaded,expected);reload={passed:true,loaded};
 assert.equal(rows.length,6);assert.ok(rows.every(r=>r.pass),'Inspect failed activity rows');assert.deepEqual(errors,[]);
 console.log('PASS all six actual-physics finishes/rewards/bests, collision failure, reload');
} catch(e){errors.push(String(e.stack??e));console.error(e.stack??e);process.exitCode=1;}
finally {await writeFile(folder+'/activity-route-acceptance.json',JSON.stringify({date:'2026-11-22',realPhysics:true,debugSetup:true,ordinaryHumanAcceptance:false,rows,damageFailure,reload,errors},null,2)+'\n');await b.close();}
