// Renderer-independent physical acceptance, same installed proving-ground loop
// and ordinary-input pilot for all twelve cars. This is NOT wall-clock GPU FPS or
// a human judgment of sound/handling. JSON includes every observed metric.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import RAPIER from '@dimforge/rapier3d-compat';
import { ROSTER } from '../src/vehicles/cars';
import { RaycastCar } from '../src/vehicles/physics';
import { neutralDrive } from '../src/vehicles/engine';
import { generateCircuit, CIRCUIT_ORIGIN } from '../src/vehicles/circuit-data';
import { installCircuit } from '../src/vehicles/circuit-physics';
import { CircuitPilot } from '../src/vehicles/test-pilot';
await RAPIER.init();
const circuit=generateCircuit(),results=[];
for(const definition of ROSTER){
 const world=new RAPIER.World({x:0,y:-24,z:0});world.timestep=1/60;installCircuit(world,circuit);world.propagateModifiedBodyPositionsToColliders();
 const car=new RaycastCar(world,circuit.spawn,definition.id,definition,circuit.yaw),pilot=new CircuitPilot(circuit.path),step=()=>{car.preStep(1/60);world.step();car.postStep(1/60);};car.engine.enter();for(let i=0;i<340;i++)step();
 const begin=performance.now();let maxSpeed=0,maxLean=0,minimumUpright=1,ticks=0;
 for(;ticks<9000;ticks++){car.setInput(pilot.input(car));step();maxSpeed=Math.max(maxSpeed,car.speed);maxLean=Math.max(maxLean,Math.abs(car.lean));minimumUpright=Math.min(minimumUpright,1-2*(car.rotation.x**2+car.rotation.z**2));if(pilot.visited.size===circuit.path.length&&car.odometer>850)break;}
 const loop={ticks,simulatedSeconds:ticks/60,wallMs:performance.now()-begin,distance:car.odometer,maxSpeed,maxLean,minimumUpright,segments:pilot.visited.size,total:circuit.path.length,maximumError:pilot.maximumError,damage:car.damage,contacts:car.contacts};
 // Independent straight acceleration and brake-distance readings on the same
 // circuit's long straight. Disable only automatic reverse for this brake probe.
 car.teleport({x:circuit.spawn.x,y:.9,z:CIRCUIT_ORIGIN.z+90},Math.PI/2);car.engine.allowReverse=false;car.engine.phase='running';car.engine.gear=1;car.engine.occupied=true;car.damage=0;for(let i=0;i<90;i++)step();car.setInput({...neutralDrive(),throttle:1});for(let i=0;i<180;i++)step();const speed3s=car.speed;
 const q=car.rotation,forward={x:2*(q.x*q.z+q.w*q.y),z:1-2*(q.x*q.x+q.y*q.y)};car.body.setLinvel({x:forward.x*13,y:0,z:forward.z*13},true);const start={...car.position};car.setInput({...neutralDrive(),brake:1});let brakeTicks=0;for(;brakeTicks<240;brakeTicks++){step();if(Math.abs(car.speed)<.25)break;}const brakeDistance=Math.hypot(car.position.x-start.x,car.position.z-start.z);
 const result={id:definition.id,name:definition.name,class:definition.class,engine:definition.engine,mass:definition.mass,loop,straight:{speed3s,brakeTicks,brakeDistance},passed:loop.segments===loop.total&&loop.maximumError<4&&loop.damage<.1&&loop.contacts>0&&brakeTicks<180&&brakeDistance<18};results.push(result);console.log(JSON.stringify(result));car.dispose();world.free();
}
await fs.mkdir('docs/evidence/crosstown-0.9.0',{recursive:true});await fs.writeFile('docs/evidence/crosstown-0.9.0/roster-loop.json',JSON.stringify({date:'2026-11-22',test:'Real Rapier, ordinary throttle/brake/steering, one shared step per tick, same physical circuit',humanHandlingAndSoundReview:false,targetGpuAcceptance:false,results},null,2)+'\n');
assert.ok(results.every(r=>r.passed),'Every model must finish the same physical loop and brake safely. Read roster-loop.json for failures.');
