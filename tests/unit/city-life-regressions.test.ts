import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion } from 'three/webgpu';
import { generateLayout, terrainHeightAt } from '../../src/world/city/layout';
import { generateChunk } from '../../src/world/city/generator';
import { CityPhysics } from '../../src/world/city/physics';
import { buildActivities } from '../../src/challenges';
import { STUNT_YARD, DRIFT_YARD } from '../../src/challenges/sites';
import { ActivityRun } from '../../src/challenges/model';
import { driveRoute } from '../../src/vehicles/ai-driver';
import { CARS } from '../../src/vehicles/cars';
import type { RaycastCar } from '../../src/vehicles/physics';
import type { DriveInput } from '../../src/vehicles/engine';
import { v3 } from '../../src/parkour/types';
await RAPIER.init();

test('all six real city activities have separate starts; the speed camera measures at the road endpoint, not its first 23 m sample', () => {
 const activities=buildActivities(generateLayout());
 assert.deepEqual(activities.map(a=>a.type),['race','trial','drift','stunt','delivery','speed']);
 assert.equal(new Set(activities.map(a=>`${a.start.x},${a.start.z}`)).size,6);
 const speed=activities.find(a=>a.type==='speed')!;
 assert.equal(speed.route.length,2);
 assert.ok(Math.hypot(speed.route[1]!.x-speed.start.x,speed.route[1]!.z-speed.start.z)>=150);
 assert.equal(speed.target,55);
 assert.equal(speed.reward,250);
 for(const a of activities)for(const p of a.route)assert.ok([p.x,p.y,p.z].every(Number.isFinite));
});

test('the generated garage has actual solid rear/side/roof sight breaks and an unobstructed open doorway', () => {
 const layout=generateLayout(),m=layout.markers.find(m=>m.type==='garage')!,p=m.position;
 const stage=new CityPhysics(),cx=Math.floor((p.x+2000)/128),cz=Math.floor((p.z+2000)/128),y=terrainHeightAt(p.x,p.z);
 try{
  for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)stage.provide(generateChunk(x,z,0,layout));
  stage.stream(p,true);stage.world.step();
  const clear=(from:ReturnType<typeof v3>,to:ReturnType<typeof v3>)=>{const d=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z),hit=stage.world.castRay(new RAPIER.Ray(from,v3((to.x-from.x)/d,(to.y-from.y)/d,(to.z-from.z)/d)),d,true);return !hit||hit.timeOfImpact>=d-.1;};
  assert.equal(clear(v3(p.x,y+1.4,p.z+15),v3(p.x,y+1.05,p.z+4)),false,'back wall');
  assert.equal(clear(v3(p.x+16,y+1.4,p.z),v3(p.x,y+1.05,p.z)),false,'side wall');
  assert.equal(clear(v3(p.x,y+22,p.z),v3(p.x,y+1.05,p.z)),false,'roof');
  assert.equal(clear(v3(p.x,y+1.4,p.z-18),v3(p.x,y+1.05,p.z+4)),true,'door');
 }finally{stage.dispose();}
});

test('the ordinary road-graph driver brakes before a ninety-degree corner, but not on the same straight road', () => {
 let input:DriveInput|undefined;
 const car={position:v3(0,0,20),rotation:new Quaternion(),speed:22,definition:CARS.harbor!,engine:{occupied:false,allowReverse:true,phase:'off',cold:true,gear:1},setInput:(v:DriveInput)=>{input=v;}} as unknown as RaycastCar;
 driveRoute(car,[v3(0,0,0),v3(0,0,40),v3(40,0,40)],1,22);
 assert.ok(input!.brake>.5);assert.equal(input!.throttle,0);assert.equal(car.engine.allowReverse,false);
 driveRoute(car,[v3(0,0,0),v3(0,0,40),v3(0,0,80)],1,22);
 assert.equal(input!.brake,0);assert.equal(Math.abs(input!.steering),0);
});

test('stunt approach and drift practice lots do not collide with the earlier fuel shop, landmark or raised underpass', () => {
 const layout=generateLayout(),stage=new CityPhysics();
 try{
  for(const site of [STUNT_YARD,DRIFT_YARD]){
   const cx=Math.floor((site.x+2000)/128),cz=Math.floor((site.z+2000)/128);
   for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)stage.provide(generateChunk(x,z,0,layout));
   stage.stream(v3(site.x,0,site.z),true);stage.world.step();
   const positions=site===STUNT_YARD?Array.from({length:20},(_,i)=>v3(site.x+18,0,site.z-40+i*10)):Array.from({length:36},(_,i)=>v3(site.x+Math.sin(i*Math.PI/18)*45,0,site.z+Math.cos(i*Math.PI/18)*45));
   for(const p of positions){const y=terrainHeightAt(p.x,p.z),hit=stage.world.castRay(new RAPIER.Ray(v3(p.x,y+25,p.z),v3(0,-1,0)),40,true);assert.ok(hit);assert.ok(y+25-hit.timeOfImpact<y+.8,`clear ground at ${p.x}, ${p.z}`);}
  }
  assert.ok(layout.markers.some(m=>m.id==='service-outskirts'));
  assert.ok(layout.markers.some(m=>m.id==='landmark-outskirts'));
  assert.ok(layout.features.some(f=>f.id==='beltway-underpass'));
 }finally{stage.dispose();}
});

test('an old car cumulative-airtime counter cannot count a short hop as a new stunt jump', () => {
 const a=buildActivities(generateLayout()).find(a=>a.type==='stunt')!,r=new ActivityRun(a,0,()=>assert.fail('must not pay'));
 for(let i=0;i<6;i++)r.update(1/60,{position:v3(a.start.x,0,a.start.z+i),speed:60,slip:0,damage:0,airborne:99,grounded:false});
 r.update(1/60,{position:v3(a.start.x,0,a.start.z+6),speed:60,slip:0,damage:0,airborne:99,grounded:true});
 assert.equal(r.jumps,0);assert.equal(r.score,0);assert.equal(r.state,'running');
});
