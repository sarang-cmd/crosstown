// Deterministic bounded visual particles. No physics bodies or hidden world steps.
import type {V3} from '../parkour/types';
export interface Particle {p:V3;v:V3;age:number;life:number;size:number;yaw:number;kind:number}
export class ParticlePool {
 readonly items:Particle[]=[];private free:Particle[]=[];spawned=0;dropped=0;updated=0;
 constructor(readonly capacity:number){if(!Number.isInteger(capacity)||capacity<1)throw new RangeError("Particle capacity must be a positive integer");for(let i=0;i<capacity;i++)this.free.push({p:{x:0,y:0,z:0},v:{x:0,y:0,z:0},age:0,life:1,size:1,kind:0,yaw:0});}
 emit(p:V3,v:V3,life:number,size:number,kind=0,yaw=0):boolean {
  if(!Number.isFinite(life)||life<=0||!Number.isFinite(size)||size<=0||![p.x,p.y,p.z,v.x,v.y,v.z].every(Number.isFinite))return false;
  if(this.items.length>=this.capacity){this.dropped++;return false;}const item=this.free.pop()!;Object.assign(item.p,p);Object.assign(item.v,v);item.age=0;item.life=life;item.size=size;item.kind=kind;item.yaw=yaw;this.items.push(item);this.spawned++;return true;
 }
 update(dt:number,gravity=0):void {if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.1,dt);this.updated++;
  for(let i=this.items.length-1;i>=0;i--){const p=this.items[i]!;p.age+=dt;if(p.age>=p.life){this.items[i]=this.items[this.items.length-1]!;this.items.pop();this.free.push(p);continue;}p.v.y-=gravity*dt;p.p.x+=p.v.x*dt;p.p.y+=p.v.y*dt;p.p.z+=p.v.z*dt;}}
 clear():void{this.free.push(...this.items);this.items.length=0;}
}
