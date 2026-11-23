// Police and racers use the ordinary Rapier raycast chassis / powertrain. This
// helper supplies steering and pedals only; it never moves a body or steps physics.
import { Group, Mesh, MeshStandardNodeMaterial, MeshBasicNodeMaterial, BoxGeometry } from 'three/webgpu';
import { bakeTrafficModel } from '../npc/visuals';
import { CARS, clamp, steeringLock } from './cars';
import { neutralDrive } from './engine';
import type { RaycastCar } from './physics';
import type { CarLibrary } from './library';
import type { V3 } from '../parkour/types';
export function driveToward(car:RaycastCar,target:V3,speed=18):void{
 const q=car.rotation,yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));
 const bearing=Math.atan2(target.x-car.position.x,target.z-car.position.z),error=Math.atan2(Math.sin(bearing-yaw),Math.cos(bearing-yaw));
 const desired=speed*Math.max(.18,1-Math.abs(error)*.55);
 car.engine.occupied=true;car.engine.allowReverse=false;car.engine.phase='running';car.engine.cold=false;car.engine.gear=Math.max(1,car.engine.gear);
 car.setInput({...neutralDrive(),steering:clamp(-error*1.6/steeringLock(car.definition,car.speed),-1,1),throttle:clamp((desired-car.speed)*.32,0,.85),brake:clamp((car.speed-desired)*.4,0,1),handbrake:speed===0});
}
// Brake BEFORE a road-graph corner. Waiting until the target jumps 90 degrees
// asks a real chassis to turn at cruise speed and makes rivals hit the outside wall.
export function driveRoute(car:RaycastCar,path:V3[],index:number,speed=18):void{
 const target=path[index];if(!target){driveToward(car,car.position,0);return;}
 const next=path[index+1],previous=path[Math.max(0,index-1)];let approach=speed;
 if(next&&previous){const ax=target.x-previous.x,az=target.z-previous.z,bx=next.x-target.x,bz=next.z-target.z,den=Math.hypot(ax,az)*Math.hypot(bx,bz);if(den>1){const cosine=clamp((ax*bx+az*bz)/den,-1,1),angle=Math.acos(cosine),corner=Math.max(6,speed*(1-angle/Math.PI)),distance=Math.max(0,Math.hypot(target.x-car.position.x,target.z-car.position.z)-13);approach=Math.min(speed,Math.sqrt(corner*corner+2*3.8*distance));}}
 driveToward(car,target,approach);
}
export class AICarVisual {
 readonly root=new Group();readonly flash:Mesh[]=[];private owned:{dispose():void}[]=[];
 constructor(readonly car:RaycastCar,library:CarLibrary,police=false){const geometry=bakeTrafficModel(library.get(car.definition.id),car.definition.id),material=new MeshStandardNodeMaterial({vertexColors:true,roughness:.8,color:police?'#dce9ee':'#b3ceae'});this.root.add(new Mesh(geometry,material));this.owned.push(geometry,material);
  if(police){for(const[x,color]of [[-.29,'#79bfff'],[.29,'#ff906e']]as const){const g=new BoxGeometry(.52,.12,.22),m=new MeshBasicNodeMaterial({color,toneMapped:false}),light=new Mesh(g,m);light.position.set(x,CARS[car.definition.id]!.height-.45,0);this.root.add(light);this.flash.push(light);this.owned.push(g,m);}const g=new BoxGeometry(car.definition.halfWidth*2+.014,.20,car.definition.halfLength*1.25),m=new MeshStandardNodeMaterial({color:'#344c67',roughness:.8}),stripe=new Mesh(g,m);stripe.position.y=.08;this.root.add(stripe);this.owned.push(g,m);}
 }
 render(alpha:number,time:number):void{this.root.position.set(this.car.previous.x+(this.car.position.x-this.car.previous.x)*alpha,this.car.previous.y+(this.car.position.y-this.car.previous.y)*alpha,this.car.previous.z+(this.car.position.z-this.car.previous.z)*alpha);this.root.quaternion.copy(this.car.previousRotation).slerp(this.car.rotation,alpha);for(let i=0;i<this.flash.length;i++)this.flash[i]!.visible=(Math.floor(time*6)+i)%2===0;}
 dispose():void{for(const r of this.owned)r.dispose();this.root.clear();}
}
