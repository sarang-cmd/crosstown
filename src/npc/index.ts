// Living-street composition. Pure planning is shared with acceptance tests. All
// near full vehicle controllers / pedestrian capsules join the existing city
// world: this module NEVER calls world.step(). Physics is bounded to 80 metres.
import RAPIER from '@dimforge/rapier3d-compat';
import type { Vehicles, ExternalCar } from '../vehicles';
import { RaycastCar } from '../vehicles/physics';
import { CARS, clamp, steeringLock } from '../vehicles/cars';
import { neutralDrive } from '../vehicles/engine';
import type { SoundEmitter } from '../audio/vehicle-audio';
import type { CityLayout } from '../world/city/types';
import type { QualityTier } from '../config/quality';
import { v3, type V3 } from '../parkour/types';
import { TrafficSimulation, lanePoint, type CarAgent, type TrafficPlayer } from './traffic';
import { PedestrianSimulation } from './pedestrians';
import { PopulationVisuals } from './visuals';
import { PopulationBudget } from './budget';
interface Proxy {car:RaycastCar;moving:boolean}
function curvePoint(t:NonNullable<CarAgent['transition']>,u:number):V3{const k=1-u;return v3(k*k*t.from.x+2*k*u*t.control.x+u*u*t.to.x,k*k*t.from.y+2*k*u*t.control.y+u*u*t.to.y,k*k*t.from.z+2*k*u*t.control.z+u*u*t.to.z);}
export class Population {
 readonly traffic:TrafficSimulation;readonly pedestrians:PedestrianSimulation;readonly visuals:PopulationVisuals;readonly budget:PopulationBudget;
 readonly fullCars=new Map<string,Proxy>();readonly capsules=new Map<string,RAPIER.RigidBody>();
 afterStep?:(population:Population)=>void;
 readonly physicsRadius=80;enabled=true;frozen=false;elapsed=0;maximumCpuMs=0;maximumPhysicsMs=0;private previousRender?:number;private anchor=v3();private proxyClock=0;private sirenFlag=false;private forcedDensity?:[number,number];private hiddenLab=false;
 constructor(readonly vehicles:Vehicles,layout:CityLayout,tier:QualityTier){this.traffic=new TrafficSimulation(layout);this.pedestrians=new PedestrianSimulation(layout);this.visuals=new PopulationVisuals(vehicles.library,layout,tier);this.budget=new PopulationBudget(tier);
  this.traffic.onHonk=p=>{if(Math.hypot(p.x-this.anchor.x,p.z-this.anchor.z)<70)vehicles.sound.effect('horn',.25);};
  vehicles.externalNearest=(p,r)=>this.nearest(p,r);
 }
 async initialize(anchor:V3):Promise<void>{this.anchor={...anchor};this.traffic.target=this.budget.cars;this.pedestrians.target=this.budget.pedestrians;if(this.enabled){this.traffic.prime(anchor);this.pedestrians.prime(anchor);}await this.visuals.load();}
 applyQuality(tier:QualityTier):void{this.budget.tier=tier;this.visuals.applyQuality(tier);}
 private player(anchor:V3):TrafficPlayer {const c=this.vehicles.active?.car,q=c?.rotation,yaw=q?Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x)):0;return {position:{...anchor},speed:c?.speed??0,velocity:c?{...c.body.linvel()}:undefined,crashed:(c?.lastImpact??0)>2||!!c&&c.damage>.68,halfWidth:c?.definition.halfWidth,halfLength:c?.definition.halfLength,yaw};}
 preStep(dt:number,anchor:V3):void {
  if(!this.enabled||this.frozen||this.vehicles.inLab){if(this.fullCars.size||this.capsules.size)this.clearPhysics();return;}const begin=performance.now();this.anchor={...anchor};this.elapsed+=dt;this.proxyClock+=dt;
  this.traffic.setAnchor(anchor);this.pedestrians.setAnchor(anchor);const player=this.player(anchor);this.traffic.target=this.forcedDensity?.[0]??this.budget.cars;this.pedestrians.target=this.forcedDensity?.[1]??this.budget.pedestrians;
  this.traffic.siren(this.sirenFlag,anchor);this.traffic.update(dt,player);this.pedestrians.update(dt,this.traffic.time,this.traffic.parked,player,new Set(this.traffic.reservations.keys()));
  if(this.proxyClock>.15){this.proxyClock=0;this.streamPhysics(anchor);}
  const physicsBegin=performance.now();
  for(const[id,proxy]of this.fullCars){const car=proxy.car;if(!proxy.moving){car.preStep(dt);continue;}const agent=this.traffic.cars.find(c=>c.id===id);if(!agent)continue;
    const path=this.traffic.paths.get(agent.lane)!,ahead=Math.max(4.0,Math.abs(car.speed)*.75),start=lanePoint(path,0),actualProgress=(car.position.x-start.x)*path.dx+(car.position.z-start.z)*path.dz;
    let target:V3;
    if(agent.transition){const t=agent.transition,u=(t.progress+ahead)/t.length;if(u<=1)target=curvePoint(t,clamp(u));else target=lanePoint(this.traffic.paths.get(t.next)!,Math.max(0,(u-1)*t.length));}
    else{const distance=actualProgress+ahead;target=lanePoint(path,distance,agent.lateral);if(distance>path.length){target.x+=path.dx*(distance-path.length);target.z+=path.dz*(distance-path.length);}}
    const q=car.rotation,yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x)),bearing=Math.atan2(target.x-car.position.x,target.z-car.position.z),error=Math.atan2(Math.sin(bearing-yaw),Math.cos(bearing-yaw));
    // Keep the physical braking envelope more conservative than the pure planner;
    // never aim backwards at a clamped stop-line endpoint (which caused U-turns).
    let desired=Math.min(agent.desiredSpeed,agent.transition?5.2:18);
    if(agent.stopAt!==undefined)desired=Math.min(desired,Math.sqrt(Math.max(0,2*3.0*(agent.stopAt-actualProgress-1.0))));
    const brake=clamp((car.speed-desired)*.65,0,1),steering=clamp(-error*1.6/steeringLock(car.definition,car.speed),-1,1);
    car.engine.gear=Math.max(1,car.engine.gear);car.setInput({...neutralDrive(),throttle:clamp((desired-car.speed)*.40,0,.8),brake,steering,handbrake:desired<.15&&Math.abs(car.speed)<.7});car.preStep(dt);
  }
  for(const[id,body]of this.capsules){const p=this.pedestrians.agents.find(p=>p.id===id);if(p)body.setNextKinematicTranslation(v3(p.position.x,p.position.y+.86,p.position.z));}
  this.maximumPhysicsMs=Math.max(this.maximumPhysicsMs,performance.now()-physicsBegin);this.maximumCpuMs=Math.max(this.maximumCpuMs,performance.now()-begin);
 }
 simulateOnly(dt:number,anchor:V3):void {if(!this.enabled||this.frozen)return;this.clearPhysics();this.anchor={...anchor};this.traffic.setAnchor(anchor);this.pedestrians.setAnchor(anchor);this.traffic.target=this.forcedDensity?.[0]??this.budget.cars;this.pedestrians.target=this.forcedDensity?.[1]??this.budget.pedestrians;this.traffic.update(dt);this.pedestrians.update(dt,this.traffic.time,this.traffic.parked,undefined,new Set(this.traffic.reservations.keys()));}
 private clearPhysics():void {for(const proxy of this.fullCars.values())proxy.car.dispose();this.fullCars.clear();for(const body of this.capsules.values())this.vehicles.world.removeRigidBody(body);this.capsules.clear();}
 postStep(dt:number):void{
  for(const[id,proxy]of this.fullCars){const car=proxy.car;car.postStep(dt);for(const event of car.events)this.vehicles.onSurfaceEvent?.(car,event);car.events.length=0;const agent=this.traffic.cars.find(c=>c.id===id),any=agent??this.traffic.parked.find(c=>c.id===id);if(any){any.damage=car.damage;any.burnSeconds=car.damageState.burnSeconds;}if(!agent)continue;
   if(car.lastImpact>2){agent.state='crash-brake';agent.reactions++;this.pedestrians.flee(agent.position,18);}
   // The dynamic body is authoritative inside 80 m. Project its actual position
   // back onto the same lane/turn for leader spacing, never teleport through cars.
   agent.position={...car.position};agent.speed=Math.max(0,car.speed);const q=car.rotation;agent.yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));
   if(agent.transition){const t=agent.transition;let best=Infinity,u=0;for(let i=0;i<=40;i++){const p=curvePoint(t,i/40),d=Math.hypot(p.x-car.position.x,p.z-car.position.z);if(d<best){best=d;u=i/40;}}t.progress=Math.max(0,u*t.length);}
   else{const path=this.traffic.paths.get(agent.lane)!,start=lanePoint(path,0);agent.progress=clamp((car.position.x-start.x)*path.dx+(car.position.z-start.z)*path.dz,0,path.length);}
  }
  this.afterStep?.(this);
 }
 private streamPhysics(anchor:V3):void{
  const all=[...this.traffic.cars,...this.traffic.parked.filter(p=>!p.taken)],wanted=new Set(all.filter(c=>Math.hypot(c.position.x-anchor.x,c.position.z-anchor.z)<this.physicsRadius&&Math.abs(c.position.y-anchor.y)<12).map(c=>c.id));
  for(const[id,p]of this.fullCars)if(!wanted.has(id)){p.car.dispose();this.fullCars.delete(id);}
  for(const agent of all)if(wanted.has(agent.id)&&!this.fullCars.has(agent.id)){
    if('transition'in agent&&agent.transition)continue;const def=CARS[agent.definition]!,car=new RaycastCar(this.vehicles.world,agent.position,agent.id,def,agent.yaw),moving='speed'in agent;car.damage=agent.damage;car.damageState.update(agent.burnSeconds);
    if(moving){car.engine.allowReverse=false;car.engine.occupied=true;car.engine.phase='running';car.engine.cold=false;car.engine.rpm=def.idleRpm;car.engine.temperature=80;car.body.setLinvel(v3(Math.sin(agent.yaw)*agent.speed,0,Math.cos(agent.yaw)*agent.speed),true);}this.fullCars.set(agent.id,{car,moving});
  }
  const near=new Set(this.pedestrians.agents.filter(p=>p.state!=='in-car'&&p.state!=='down'&&Math.hypot(p.position.x-anchor.x,p.position.z-anchor.z)<80&&Math.abs(p.position.y-anchor.y)<12).map(p=>p.id));
  for(const[id,body]of this.capsules)if(!near.has(id)){this.vehicles.world.removeRigidBody(body);this.capsules.delete(id);}
  for(const ped of this.pedestrians.agents)if(near.has(ped.id)&&!this.capsules.has(ped.id)){const body=this.vehicles.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(ped.position.x,ped.position.y+.86,ped.position.z));body.userData={pedestrian:ped.id,surface:'fabric'};this.vehicles.world.createCollider(RAPIER.ColliderDesc.capsule(.57,.25).setFriction(.2).setRestitution(0),body);this.capsules.set(ped.id,body);}
 }
 private nearest(p:V3,radius:number):ExternalCar|undefined {
  if(!this.enabled)return;const all=[...this.traffic.cars.filter(c=>c.speed<1.4),...this.traffic.parked.filter(c=>!c.taken)].filter(c=>Math.hypot(c.position.x-p.x,c.position.z-p.z)<radius&&Math.abs(c.position.y-p.y)<2.7).sort((a,b)=>Math.hypot(a.position.x-p.x,a.position.z-p.z)-Math.hypot(b.position.x-p.x,b.position.z-p.z)),agent=all[0];if(!agent)return;
  const proxy=this.fullCars.get(agent.id),position=proxy?{...proxy.car.position}:{...agent.position},yaw=agent.yaw;return {id:agent.id,definition:agent.definition,position,yaw,npc:'personality'in agent||agent.occupied,damage:proxy?.car.damage??agent.damage,paint:CARS[agent.definition]!.paints[Number(agent.id.match(/\d+/)?.[0]??0)%CARS[agent.definition]!.paints.length],retire:()=>{this.traffic.remove(agent.id);const current=this.fullCars.get(agent.id);if(current){current.car.dispose();this.fullCars.delete(agent.id);}this.pedestrians.flee(position,10);}};
 }
 render(anchor:V3,alpha:number,dt:number,night:number,now:number):void{
  this.visuals.root.visible=this.enabled&&!this.vehicles.inLab;this.hiddenLab=this.vehicles.inLab;
  if(this.previousRender!==undefined&&dt>0)this.budget.sample((now-this.previousRender)/1000);this.previousRender=now;
  this.traffic.night=this.pedestrians.night=night;if(!this.visuals.root.visible)return;
  this.visuals.render(this.traffic.cars,this.traffic.parked,this.pedestrians.agents,this.pedestrians.graph,anchor,this.traffic.time,alpha,dt,this.fullCars);
 }
 emitters():SoundEmitter[]{return [...this.fullCars.values()].filter(p=>p.moving).map(p=>({id:p.car.id,car:p.car,engine:p.car.definition.engine,profile:p.car.definition.soundProfile,position:p.car.position,priority:0}));}
 siren(value:boolean):void{this.sirenFlag=value;}
 gunfire(position:V3):void{this.traffic.gunfire(position);this.pedestrians.flee(position);}
 density(cars?:number,pedestrians?:number):void{this.forcedDensity=cars===undefined?undefined:[Math.round(clamp(cars,0,120)),Math.round(clamp(pedestrians??cars*2,0,240))];this.budget.locked=!!this.forcedDensity;this.traffic.target=this.forcedDensity?.[0]??this.budget.cars;this.pedestrians.target=this.forcedDensity?.[1]??this.budget.pedestrians;}
 snapshot(){return {enabled:this.enabled,hiddenForLab:this.hiddenLab,physicsRadius:this.physicsRadius,fullPhysicsCars:this.fullCars.size,fullVehicleControllers:[...this.fullCars].map(([id,p])=>({id,moving:p.moving,definition:p.car.definition.id,position:{...p.car.position},rotation:p.car.rotation.toArray(),contacts:p.car.contacts,speed:p.car.speed,damage:p.car.damage,damageStage:p.car.damageState.stage,input:{...p.car.input}})),pedestrianCapsules:this.capsules.size,maximumCpuMs:this.maximumCpuMs,maximumNearPhysicsMs:this.maximumPhysicsMs,budget:this.budget.snapshot(),traffic:this.traffic.snapshot(),pedestrians:this.pedestrians.snapshot(),visuals:this.visuals.snapshot()};}
 dispose():void{this.afterStep=undefined;this.vehicles.externalNearest=undefined;this.clearPhysics();this.visuals.dispose();}
}
