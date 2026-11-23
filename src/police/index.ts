// Bounded sight-based pursuit. No distance-to-player wanted bubble, no hidden
// physics step. Eight pooled raycast units and one helicopter are the hard cap.
import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, BufferGeometry, Float32BufferAttribute, DoubleSide, BoxGeometry, SphereGeometry, CylinderGeometry, SpotLight } from 'three/webgpu';
import { Wanted, inVision } from './wanted';
import { RaycastCar } from '../vehicles/physics';
import { CARS } from '../vehicles/cars';
import { AICarVisual, driveRoute } from '../vehicles/ai-driver';
import { neutralDrive } from '../vehicles/engine';
import type { Vehicles } from '../vehicles';
import { routeToWaypoint, roadHeightAt } from '../world/city/layout';
import type { CityLayout } from '../world/city/types';
import { v3, type V3 } from '../parkour/types';
interface Unit {kind:'patrol'|'roadblock'|'armored'|'heavy';car:RaycastCar;visual:AICarVisual;active:boolean;path:V3[];index:number;sees:boolean;cone:Mesh}
export interface PoliceTarget {position:V3;body?:RAPIER.RigidBody;collider?:RAPIER.Collider;night:number;inWater?:boolean}
export class Police {
 readonly root=new Group();readonly wanted=new Wanted();readonly units:Unit[]=[];readonly helicopter=new Group();readonly spotlight=new SpotLight('#e5f3d4',0,90,.42,.6,1);
 debugCones=false;elapsed=0;seen=false;raycasts=0;heliActive=false;private sensorClock=0;private planClock=0;private fireClock=0;private previousStars=0;private spawnSerial=0;private resources:{dispose():void}[]=[];private rotor=new Group();private coneMat=new MeshBasicNodeMaterial({color:'#82bee6',transparent:true,opacity:.09,depthWrite:false,side:DoubleSide});
 constructor(readonly vehicles:Vehicles,readonly layout:CityLayout,readonly target:()=>PoliceTarget,readonly hurt:(amount:number)=>void){this.root.name='Sight-based police · pooled patrol / block / armored / heavy / helicopter';
  for(const kind of ['patrol','patrol','roadblock','roadblock','armored','armored','heavy','heavy']as const){const car=new RaycastCar(vehicles.world,v3(0,-200,0),`police-${this.units.length}`,CARS[kind==='armored'?'mesa':kind==='heavy'?'summit':'harbor']!),visual=new AICarVisual(car,vehicles.library,true);car.body.setEnabled(false);visual.root.visible=false;this.root.add(visual.root);const points=[0,.04,0,-Math.sin(35*Math.PI/180)*60,.04,Math.cos(35*Math.PI/180)*60,Math.sin(35*Math.PI/180)*60,.04,Math.cos(35*Math.PI/180)*60],g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(points,3)),cone=new Mesh(g,this.coneMat);g.computeVertexNormals();cone.visible=false;cone.frustumCulled=false;this.root.add(cone);this.resources.push(g);this.units.push({kind,car,visual,active:false,path:[],index:0,sees:false,cone});}
  const mat=new MeshStandardNodeMaterial({color:'#536e7b',roughness:.7}),glass=new MeshStandardNodeMaterial({color:'#96bdc5',metalness:.3,roughness:.3});this.resources.push(mat,glass,this.coneMat);
  const part=(g:SphereGeometry|BoxGeometry|CylinderGeometry,m:MeshStandardNodeMaterial,x:number,y:number,z:number,sx=1,sy=1,sz=1,parent:Group=this.helicopter)=>{const mesh=new Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);this.resources.push(g);return mesh;};
  part(new SphereGeometry(1,12,8),mat,0,0,0,1.5,1.3,2.8);part(new SphereGeometry(1,10,7),glass,0,.1,1.6,1.35,.95,1.3);part(new BoxGeometry(.38,.38,5),mat,0,.2,-4);part(new BoxGeometry(.12,1.5,1),mat,0,1,-6);part(new BoxGeometry(3,.1,.6),mat,0,.4,-6);
  for(const x of[-1,1]){part(new BoxGeometry(.10,.8,.10),mat,x,-1.3,0);part(new BoxGeometry(.10,.10,4),mat,x,-1.7,0);}this.rotor.position.y=1.8;this.helicopter.add(this.rotor);part(new BoxGeometry(11,.055,.23),mat,0,0,0,1,1,1,this.rotor);part(new BoxGeometry(.23,.055,11),mat,0,0,0,1,1,1,this.rotor);this.helicopter.add(this.spotlight,this.spotlight.target);this.spotlight.position.set(0,-1,1);this.spotlight.target.position.set(0,-30,0);this.helicopter.visible=false;this.root.add(this.helicopter);
 }
 private visible(origin:V3,target:PoliceTarget,exclude?:RAPIER.RigidBody):boolean{const end=v3(target.position.x,target.position.y+.95,target.position.z),dx=end.x-origin.x,dy=end.y-origin.y,dz=end.z-origin.z,d=Math.hypot(dx,dy,dz);if(d<.1)return true;this.raycasts++;const hit=this.vehicles.world.castRay(new RAPIER.Ray(origin,v3(dx/d,dy/d,dz/d)),d,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,exclude);return !hit||hit.collider.parent()===target.body||hit.timeOfImpact>=d-.55;}
 private spawn(unit:Unit,target:V3):void{const candidates=this.layout.nodes.filter(n=>Math.hypot(n.x-target.x,n.z-target.z)>35&&Math.hypot(n.x-target.x,n.z-target.z)<150).sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z));const node=candidates[this.spawnSerial++%Math.max(1,candidates.length)]??this.layout.nodes[0]!;const lane=this.layout.edges.find(e=>e.from===node.id||e.to===node.id),other=lane?this.layout.nodes[lane.from===node.id?lane.to:lane.from]!:node,yaw=Math.atan2(other.x-node.x,other.z-node.z),p=v3(node.x+Math.cos(yaw)*3,roadHeightAt(node.x,node.z)+.9,node.z-Math.sin(yaw)*3);unit.car.body.setEnabled(true);unit.car.damage=0;unit.car.teleport(p,yaw);unit.car.engine.phase='running';unit.car.engine.occupied=true;unit.car.engine.cold=false;unit.car.engine.rpm=unit.car.definition.idleRpm;unit.active=unit.visual.root.visible=true;unit.path=[];unit.index=0;}
 probeSight(origin:V3,feet:V3):boolean{return this.visible(origin,{position:feet,night:0});}
 report(position:V3,severity=1):void{const t=this.target(),witness=this.units.some(u=>u.active&&inVision(u.car.position,this.yaw(u.car),position,t.night>.5?75:60)&&this.visible(v3(u.car.position.x,u.car.position.y+1.4,u.car.position.z),{...t,position},u.car.body));this.wanted.report(position,witness,severity);if(!witness&&this.wanted.stars===0){ // One responding patrol investigates SOUND, not a star or a sighting.
   const unit=this.units[0]!;if(!unit.active)this.spawn(unit,position);unit.path=routeToWaypoint(this.layout,unit.car.position,position);unit.index=1;this.wanted.lastCrime={...position};
  }}
 private yaw(car:RaycastCar):number{const q=car.rotation;return Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));}
 preStep(dt:number,anchor:V3):void{
  this.elapsed+=dt;this.sensorClock+=dt;this.planClock+=dt;this.fireClock+=dt;const t=this.target(),stars=this.wanted.stars;
  if(this.vehicles.inLab){this.seen=false;for(const u of this.units)u.car.body.setEnabled(false);return;}
  if(stars!==this.previousStars){for(const u of this.units){const needed=stars>=1&&u.kind==='patrol'||stars>=2&&u.kind==='roadblock'||stars>=4&&u.kind==='armored'||stars>=5&&u.kind==='heavy';if(needed&&!u.active)this.spawn(u,this.wanted.lastSeen);if(!needed&&u.active&&(stars===0||u.kind!=='patrol')){u.active=u.visual.root.visible=false;u.car.body.setEnabled(false);}}this.previousStars=stars;}
  if(this.sensorClock>=.125){this.sensorClock=0;this.seen=false;for(const u of this.units){u.sees=u.active&&u.car.damage<1&&inVision(u.car.position,this.yaw(u.car),t.position,t.night>.5?75:60)&&this.visible(v3(u.car.position.x,u.car.position.y+1.4,u.car.position.z),t,u.car.body);this.seen||=u.sees;}
   this.heliActive=stars>=3;this.helicopter.visible=this.heliActive;if(this.heliActive){const h=this.helicopter.position;if(Math.hypot(h.x-t.position.x,h.z-t.position.z)<60&&this.visible(v3(h.x,h.y-1,h.z),t))this.seen=true;}
  }
  this.wanted.update(dt,this.seen,t.position);
  if(this.fireClock>=1.15){this.fireClock=0;if(stars>=2&&this.seen&&!t.inWater)this.hurt(5+stars*1.5);}
  const plan=this.planClock>=1.1;if(plan)this.planClock=0;
  for(const u of this.units){if(!u.active)continue;const distance=Math.hypot(u.car.position.x-anchor.x,u.car.position.z-anchor.z);if(distance>230){u.car.body.setEnabled(false);continue;}u.car.body.setEnabled(true);
   if(plan){let goal=stars?this.wanted.lastSeen:this.wanted.lastCrime;if(this.wanted.state==='searching'){const n=this.layout.nodes.filter(n=>Math.hypot(n.x-goal.x,n.z-goal.z)<160);goal=n[(Math.floor(this.elapsed/4)+this.units.indexOf(u))%Math.max(1,n.length)]??goal;}u.path=routeToWaypoint(this.layout,u.car.position,goal);u.index=1;}
   while(u.index<u.path.length-1&&Math.hypot(u.path[u.index]!.x-u.car.position.x,u.path[u.index]!.z-u.car.position.z)<9)u.index++;
   const goal=u.path[u.index]??(stars?this.wanted.lastSeen:this.wanted.lastCrime),close=Math.hypot(goal.x-u.car.position.x,goal.z-u.car.position.z)<9;
   if(u.car.damage>=1||u.kind==='roadblock'||close){u.car.setInput({...neutralDrive(),handbrake:true});}else driveRoute(u.car,u.path.length?u.path:[u.car.position,goal],u.path.length?u.index:1,stars?Math.min(27,14+stars*2):11);u.car.preStep(dt);
  }
  if(this.heliActive){const p=this.helicopter.position,goal=this.wanted.lastSeen;if(p.y<1)p.set(goal.x+35,goal.y+32,goal.z-20);const blend=1-Math.exp(-dt*.65);p.x+=(goal.x+Math.sin(this.elapsed*.15)*23-p.x)*blend;p.z+=(goal.z+Math.cos(this.elapsed*.15)*23-p.z)*blend;p.y+=(Math.max(goal.y+30,roadHeightAt(p.x,p.z)+32)-p.y)*blend;this.helicopter.rotation.y=Math.atan2(goal.x-p.x,goal.z-p.z);this.spotlight.intensity=t.night>.4?170:0;}
 }
 postStep(dt:number):void{for(const u of this.units)if(u.active&&u.car.body.isEnabled()){u.car.postStep(dt);for(const event of u.car.events)this.vehicles.onSurfaceEvent?.(u.car,event);u.car.events.length=0;}}
 render(alpha:number):void{for(const u of this.units){if(u.active)u.visual.render(alpha,this.elapsed);u.cone.visible=this.debugCones&&u.active;u.cone.position.set(u.car.position.x,u.car.position.y-.65,u.car.position.z);u.cone.rotation.y=this.yaw(u.car);}this.coneMat.color.set(this.wanted.state==='seen'?'#ff9b77':'#a9ccdf');this.rotor.rotation.y=this.elapsed*22;}
 hit(id:string,damage:number):boolean{const u=this.units.find(u=>u.car.id===id&&u.active);if(!u)return false;u.car.damage=Math.min(1,u.car.damage+damage/(u.kind==='heavy'?500:u.kind==='armored'?350:180));this.wanted.report(u.car.position,true,1);return true;}
 clear():void{this.wanted.setStars(0,this.target().position);this.seen=false;for(const u of this.units){u.active=u.visual.root.visible=u.cone.visible=false;u.car.body.setEnabled(false);}this.helicopter.visible=this.heliActive=false;this.spotlight.intensity=0;this.previousStars=0;}
 snapshot(){return{...this.wanted.snapshot(),seen:this.seen,raycasts:this.raycasts,coneDegrees:70,dayRange:60,nightHeadlightRange:75,helicopter:this.heliActive,spotlight:this.spotlight.intensity,units:this.units.filter(u=>u.active).map(u=>({id:u.car.id,kind:u.kind,position:{...u.car.position},yaw:this.yaw(u.car),sees:u.sees,damage:u.car.damage,path:u.path.length,physicsEnabled:u.car.body.isEnabled()}))};}
 dispose():void{for(const u of this.units){u.car.dispose();u.visual.dispose();}for(const r of this.resources)r.dispose();this.spotlight.dispose();this.root.clear();}
}
