import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import RAPIER from '@dimforge/rapier3d-compat';
import { loopWeights, nearestEmitters, firingHz, ENGINE_TIMBRES } from '../../src/audio/engine-mix';
import { RaycastCar } from '../../src/vehicles/physics';
import { neutralDrive } from '../../src/vehicles/engine';
import { instrumentReadings } from '../../src/vehicles/cockpit';
import { generateCircuit } from '../../src/vehicles/circuit-data';
import { installCircuit } from '../../src/vehicles/circuit-physics';
import { CircuitPilot } from '../../src/vehicles/test-pilot';
import { findParking, installForecourt } from '../../src/vehicles/parking';
import { generateRoute } from '../../src/parkour/generator';
import { generateLayout } from '../../src/world/city/layout';
import { generateChunk } from '../../src/world/city/generator';
import { StreetSession, CityPhysics } from '../../src/world/city/physics';
await RAPIER.init();
function flat(gravity=-9.81){const w=new RAPIER.World({x:0,y:gravity,z:0});w.timestep=1/60;const b=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.2,0));w.createCollider(RAPIER.ColliderDesc.cuboid(1500,.2,1500),b);return w;}
function step(c:RaycastCar,n:number){for(let i=0;i<n;i++){c.preStep(1/60);c.world.step();c.postStep(1/60);}}
test('equal-power four-band/on-off mixer has continuous normalized energy throughout the RPM/load range',()=>{for(let rpm=0;rpm<9000;rpm+=17)for(const load of[0,.1,.5,.9,1]){const weights=loopWeights(rpm,load,[820,2000,3800,5800]);assert.ok(weights.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(Math.abs(weights.reduce((s,v)=>s+v*v,0)-1)<1e-9);assert.ok(weights.filter(v=>v>0).length<=4);}for(const anchor of[820,2000,3800,5800]){const a=loopWeights(anchor-.001,.5,[820,2000,3800,5800]),b=loopWeights(anchor+.001,.5,[820,2000,3800,5800]);assert.ok(a.every((v,i)=>Math.abs(v-b[i]!)<.002));}});
test('firing models differ with cylinder count and timbre; nearest-priority spatial budget never exceeds 16',()=>{assert.equal(firingHz(3000,'i4'),100);assert.equal(firingHz(3000,'v8'),200);assert.equal(firingHz(3000,'single'),25);assert.equal(Object.keys(ENGINE_TIMBRES).length,8);assert.equal(new Set(Object.values(ENGINE_TIMBRES).map(x=>x.brightness)).size,8);assert.equal(firingHz(3000,'v10'),250);assert.equal(firingHz(3000,'twin'),50);const emitters=Array.from({length:40},(_,i)=>({id:String(i),position:{x:i,y:0,z:0},priority:i===39?1:0}));const chosen=nearestEmitters(emitters,{x:0,y:0,z:0});assert.equal(chosen.length,16);assert.equal(chosen[0]!.id,'39');assert.equal(chosen[1]!.id,'0');assert.equal(chosen.at(-1)!.id,'14');});
test('all six reviewed recording sets have eight actual PCM16 loops, correct hashes, no clipped values and equal boundary samples',()=>{
 const report=JSON.parse(fs.readFileSync('docs/CAR-AUDIO-ASSETS.json','utf8'));assert.equal(report.profiles.length,6);assert.equal(report.loops,48);
 for(const profile of report.profiles){assert.ok(['CC0-1.0','CC-BY-3.0','CC-BY-4.0'].includes(profile.license));assert.equal(profile.loops.length,8);for(const loop of profile.loops){const b=fs.readFileSync(`public/audio/cars/${profile.id}/${loop.file}`);assert.equal(createHash('sha256').update(b).digest('hex'),loop.sha256);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');let offset=12,data=0,size=0,rate=0,bits=0,channels=0;while(offset<b.length-8){const type=b.toString('ascii',offset,offset+4),length=b.readUInt32LE(offset+4);if(type==='fmt '){channels=b.readUInt16LE(offset+10);rate=b.readUInt32LE(offset+12);bits=b.readUInt16LE(offset+22);}if(type==='data'){data=offset+8;size=length;}offset+=8+length+(length%2);}assert.equal(rate,32000);assert.equal(bits,16);assert.equal(channels,1);assert.equal(size/2,40000);assert.ok(Math.abs(b.readInt16LE(data)-b.readInt16LE(data+size-2))<=1);assert.ok(loop.rms>.02&&loop.rms<.3);assert.ok(loop.peak<.95);}}
});
test('car uses Earth gravity without changing the -24 character world; automatic shifts no longer cascade through all gears',()=>{
 const states=[];for(const gravity of[-9.81,-24]){const w=flat(gravity),c=new RaycastCar(w,{x:0,y:.8,z:0});c.engine.enter();step(c,340);c.setInput({...neutralDrive(),throttle:1});step(c,600);states.push(c.snapshot());assert.equal(c.engine.gear,3);assert.ok(c.speed>25&&c.speed<40);c.dispose();w.free();}assert.ok(Math.abs(states[0]!.speed-states[1]!.speed)<1e-6);assert.ok(Math.abs(states[0]!.position.y-states[1]!.position.y)<1e-6);
});
test('wheel full lock is physically 900 degrees; gauges use physical speed/RPM/temp/gear and ignition bulb check',()=>{const w=flat(),c=new RaycastCar(w,{x:0,y:.8,z:0});c.engine.enter();step(c,340);c.setInput({...neutralDrive(),steering:1,directSteer:true});step(c,120);assert.ok(Math.abs(Math.abs(c.wheelAngle)*180/Math.PI-450)<.01);c.speed=12.5;c.engine.rpm=3450;c.engine.temperature=87;c.engine.gear=3;const r=instrumentReadings(c,1,true,-1,2);assert.equal(r.speed,45);assert.equal(r.rpm,3450);assert.equal(r.temperature,87);assert.equal(r.gear,'3');assert.equal(r.wheelRadians,c.wheelAngle);c.engine.phase='ignition';c.engine.sweep=.75;const check=instrumentReadings(c,1,true,0,0);assert.equal(check.speed,180);assert.equal(check.rpm,c.definition.redline*.75);assert.ok(check.lamps.engine&&check.lamps.oil&&check.lamps.damage&&check.lamps.handbrake);c.dispose();w.free();});
test('exit probes reject all three blocked capsule positions and choose a clear door when available',()=>{const w=flat(),c=new RaycastCar(w,{x:0,y:.8,z:0});step(c,180);assert.ok(c.exitPosition());const blocks=[];for(const p of[{x:2.1,z:.15},{x:-2.1,z:.15},{x:0,z:-3.2}]){const b=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x,1,p.z));w.createCollider(RAPIER.ColliderDesc.cuboid(.6,1,.6),b);blocks.push(b);}w.step();assert.equal(c.exitPosition(),undefined);w.removeRigidBody(blocks[1]!);w.step();const exit=c.exitPosition();assert.ok(exit&&exit.x<0);c.dispose();w.free();});
test('street character and vehicle hooks share exactly one city-world step per 60 Hz tick',()=>{const city=new CityPhysics(),walker=new StreetSession(city,{x:680,y:10,z:0},{goal:{x:0,y:0,z:0},carPosition:{x:0,y:0,z:0}});let count=0,pre=0,post=0;const original=city.world.step.bind(city.world);city.world.step=(...args:Parameters<typeof city.world.step>)=>{count++;original(...args);};for(let i=0;i<120;i++)walker.update(1/60,undefined,{preStep(){pre++;},postStep(){post++;}});assert.equal(count,120);assert.equal(pre,120);assert.equal(post,120);walker.dispose();city.dispose();});
for(const digital of[true,false])test(`ordinary ${digital?'digital-keyboard':'analog-gamepad'}-style controls complete the real 0.8 km handling loop without helper impulses or respawns`,()=>{const data=generateCircuit(),w=new RAPIER.World({x:0,y:-24,z:0});w.timestep=1/60;installCircuit(w,data);const c=new RaycastCar(w,data.spawn,'pilot',undefined,data.yaw),pilot=new CircuitPilot(data.path,digital);c.engine.enter();step(c,340);for(let i=0;i<5000;i++){c.setInput(pilot.input(c));step(c,1);}console.log('Handling loop acceptance',{digital,metres:c.odometer,maxCenterError:pilot.maximumError,visited:pilot.visited.size,damage:c.damage,contacts:c.contacts});assert.ok(c.odometer>850);assert.ok(pilot.visited.size>=40);assert.ok(pilot.maximumError<4.5);assert.equal(c.damage,0);assert.ok(c.contacts>=3);c.dispose();w.free();});
test('the optional ramp produces a real jump and landing, and wall impact changes physical velocity',()=>{const d=generateCircuit(),w=new RAPIER.World({x:0,y:-24,z:0});w.timestep=1/60;installCircuit(w,d);const origin={x:5200,y:.8,z:5170},c=new RaycastCar(w,origin);c.engine.enter();step(c,340);c.setInput({...neutralDrive(),throttle:1});let maximum=0,flight=0,landed=false,wasAirborne=false;for(let i=0;i<360;i++){step(c,1);maximum=Math.max(maximum,c.position.y);if(c.contacts===0&&c.position.y>2){flight++;wasAirborne=true;}if(wasAirborne&&c.contacts>1)landed=true;}assert.ok(maximum>3);assert.ok(flight>8);assert.ok(landed);c.teleport({x:5173,y:.9,z:5225});c.body.setLinvel({x:0,y:0,z:18},true);let impact=0;for(let i=0;i<150;i++){step(c,1);impact=Math.max(impact,c.lastImpact);}assert.ok(impact>5);assert.ok(Math.abs(c.speed)<3);c.dispose();w.free();});

test('waiting cars never spawn inside a folded-back course building; physical street entry and both doors survive streamed city collisions', () => {
  const layout = generateLayout();
  const origins = [undefined, ...layout.markers.filter(m => m.type === 'parkour').map(m => m.position)];
  for (const [index, origin] of origins.entries()) {
    const route = generateRoute(84173 + index, false, 'quick', origin), city = new CityPhysics(); city.setOpening(route);
    const roof = route.roofs[0]!, preferred = { x: roof.center.x + roof.width / 2 + 9.2, y: 0, z: route.spawn.z + 10 };
    const parked = findParking(route, layout, preferred), reward = findParking(route, layout, route.carPosition, parked.position);
    if (!origin) { assert.ok(Math.hypot(reward.position.x-route.carPosition.x,reward.position.z-route.carPosition.z)<15); assert.ok(Math.hypot(parked.position.x-preferred.x,parked.position.z-preferred.z)<100); }
    for (const spot of [parked, reward]) {
      assert.ok(route.roofs.every(r => Math.abs(spot.position.x-r.center.x) >= r.width/2+5.49 || Math.abs(spot.position.z-r.center.z) >= r.depth/2+5.49));
      const cx=Math.floor((spot.position.x+2000)/128),cz=Math.floor((spot.position.z+2000)/128);
      for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)if(x>=0&&x<32&&z>=0&&z<32)city.provide(generateChunk(x,z,0,layout));
      city.stream(spot.position,true); if(spot.road===null)installForecourt(city.world,spot);
      const car=new RaycastCar(city.world,spot.position,'parking-fixture',undefined,spot.yaw); step(car,240);
      assert.ok(car.contacts>=3, `marker ${index}: car remains on its real street surface`); assert.ok(car.position.y>spot.position.y-.6);
      const exit=car.exitPosition();assert.ok(exit,`marker ${index}: a door has a clear ground-level capsule`);
      const walker=new StreetSession(city,exit,{goal:route.goal,carPosition:route.carPosition});
      for(let i=0;i<120;i++)walker.update(1/60,undefined,{preStep(dt){car.preStep(dt);},postStep(dt){car.postStep(dt);}});
      assert.ok(Math.hypot(walker.player.position.x-exit.x,walker.player.position.z-exit.z)<.5); assert.ok(Math.abs(walker.player.position.y-exit.y)<.25);
      walker.dispose();car.dispose();
    }
    city.dispose();
  }
});
test('recovery/teleport immediately clears stale speed, rack and exit-lock state before the next physics tick',()=>{
 const w=flat(),c=new RaycastCar(w,{x:0,y:.8,z:0});c.engine.enter();step(c,340);c.setInput({...neutralDrive(),throttle:1,steering:.2});step(c,150);assert.ok(c.speed>1.4);c.teleport({x:0,y:.8,z:0});assert.equal(c.speed,0);assert.equal(c.wheelAngle,0);assert.equal(c.contacts,0);assert.ok(c.exitPosition());c.dispose();w.free();
});

test('automatic hold-brake selects real reverse and forward throttle first stops then returns to drive',()=>{
 const w=flat(),c=new RaycastCar(w,{x:0,y:.8,z:0});c.engine.enter();step(c,340);c.setInput({...neutralDrive(),brake:.8});step(c,180);assert.equal(c.engine.gear,-1);assert.ok(c.speed<-3);const reversed=c.position.z;c.setInput({...neutralDrive(),throttle:.8});step(c,300);assert.ok(c.engine.gear>0);assert.ok(c.speed>3);assert.ok(c.position.z>reversed);c.dispose();w.free();
});
