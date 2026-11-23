// Physical control search, not acceptance: a flat isolated Rapier plane.
// No tyre/score/speed/velocity edits. Candidates must still work in the loaded city.
import fs from 'node:fs/promises';
import RAPIER from '@dimforge/rapier3d-compat';
import { HARBOR } from '../src/vehicles/cars';
import { RaycastCar } from '../src/vehicles/physics';
import { neutralDrive } from '../src/vehicles/engine';
import { ActivityRun } from '../src/challenges/model';
await RAPIER.init();
const results=[];
for(const steer of [.8,1]) for(const release of [.15,.2,.25]) for(const threshold of [10,12]) for(const duty of [30,60]) for(const counter of [-.35,-.7]){
 const world=new RAPIER.World({x:0,y:-24,z:0});world.timestep=1/60;
 const base=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());base.userData={surface:'grass'};
 world.createCollider(RAPIER.ColliderDesc.cuboid(1000,.1,1000).setTranslation(0,-.1,0),base);
 const car=new RaycastCar(world,{x:0,y:.9,z:0},'probe',HARBOR),run=new ActivityRun({id:'drift-probe',type:'drift',name:'Isolated physical search',start:{x:0,y:0,z:0},route:[],limit:35,reward:0,target:140},0,()=>{}),step=()=>{car.preStep(1/60);world.step();car.postStep(1/60);};
 car.engine.enter();for(let i=0;i<340;i++)step();car.assist=false;
 let maximumSlip=0,qualifiedTicks=0;const trace=[];
 for(let i=0;i<2102;i++){
   const high=car.slip>release,positive=car.speed>threshold;
   const input={...neutralDrive(),throttle:1,steering:i<180?0:high?counter:steer,handbrake:i>=180&&!high&&positive&&i%120<duty};
   car.setInput(input);step();maximumSlip=Math.max(maximumSlip,car.slip);
   if(car.speed>5&&car.slip>.14&&car.contacts>=2)qualifiedTicks++;
   run.update(1/60,{position:car.position,speed:car.speed,slip:car.slip,damage:car.damage,airborne:car.airborne,grounded:car.contacts>=2});
   if(i%60===0)trace.push({t:i/60,position:{...car.position},speed:car.speed,slip:car.slip,input,score:run.score});
 }
 const row={steer,release,counter,threshold,duty,score:run.score,finished:run.state==='finished',qualifiedSeconds:qualifiedTicks/60,maximumSlip,damage:car.damage,trace};results.push(row);
 console.log(JSON.stringify({steer,release,counter,threshold,duty,score:run.score,finished:row.finished}));car.dispose();world.free();
}
await fs.writeFile('docs/evidence/crosstown-0.13.0/isolated-drift-controls-grass.json',JSON.stringify({boundary:'Isolated physical search only, not loaded-city acceptance',results},null,2)+'\n');
