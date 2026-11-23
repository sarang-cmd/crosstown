// Deterministic, renderer-independent lane traffic. Metres / seconds, fixed 60 Hz.
// Turns hold an exclusive reservation; non-conflicting parallel straight lanes
// can share green. No queue teleporting; the receiving lane must have space.
import { CARS, ROSTER, clamp } from '../vehicles/cars';
import { seededRandom, v3, type V3 } from '../parkour/types';
import type { CityLayout, Lane, RoadEdge } from '../world/city/types';
export type DriverPersonality='cautious'|'normal'|'aggressive';
export const DRIVERS={cautious:{speed:.78,headway:2.1,gap:4,accel:1.6,brake:5,patience:12},normal:{speed:.95,headway:1.55,gap:3,accel:2.2,brake:6,patience:8},aggressive:{speed:1.10,headway:1.05,gap:2.3,accel:2.9,brake:7,patience:4}} as const;
export type TrafficState='cruise'|'following'|'red-light'|'yielding'|'turning'|'overtaking'|'crash-brake'|'pulling-over'|'fleeing';
export interface LanePath {id:string;lane:Lane;edge:RoadEdge;from:number;to:number;length:number;trim:number;total:number;axis:'x'|'z';reverse:boolean;dx:number;dz:number;nx:number;nz:number;rawLengths:number[]}
export interface CarAgent {
 id:string;definition:string;damage:number;burnSeconds:number;lane:string;progress:number;speed:number;desiredSpeed:number;position:V3;previous:V3;yaw:number;previousYaw:number;personality:DriverPersonality;state:TrafficState;indicator:number;braking:boolean;headlights:boolean;wait:number;odometer:number;lateral:number;reactions:number;honkCooldown:number;fleeUntil:number;
 stopAt?:number;queuedAt?:number;
 transition?:{from:V3;control:V3;to:V3;next:string;progress:number;length:number;node:number};
 laneChange?:{from:string;remaining:number};
}
export interface ParkedAgent {id:string;definition:string;position:V3;yaw:number;taken:boolean;occupied:boolean;damage:number;burnSeconds:number}
export interface TrafficPlayer {position:V3;speed:number;velocity?:V3;crashed?:boolean;halfWidth?:number;halfLength?:number;yaw?:number}
export interface TrafficHooks {siren?:{position:V3;enabled:boolean};gunfire?:{position:V3;until:number}}
const PHASE=80;
export function signalPhase(node:number,time:number):number{return ((time+node%4*4)%PHASE+PHASE)%PHASE;}
export function lightState(node:number,axis:'x'|'z',time:number):'green'|'amber'|'red'{const t=signalPhase(node,time);return axis==='x'?t<18?'green':t<20?'amber':'red':t>=22&&t<40?'green':t>=40&&t<42?'amber':'red';}
export function pedestrianMayStart(node:number,time:number,duration:number):boolean{const t=signalPhase(node,time);return t>=44&&t+duration<=78;}
export function pedestrianPhase(node:number,time:number):boolean{const t=signalPhase(node,time);return t>=44&&t<80;}
export function buildLanes(layout:CityLayout):Map<string,LanePath>{
 const paths=new Map<string,LanePath>();const widths=layout.nodes.map(n=>Math.max(10,...n.outgoing.map(id=>layout.edges[Number(id.split(':')[0])]!.width)));
 for(const lane of layout.lanes){const edge=layout.edges[lane.edge]!;if(edge.kind==='promenade')continue;const a=edge.points[0]!,b=edge.points.at(-1)!,lengths=[0];for(let i=1;i<edge.points.length;i++)lengths.push(lengths.at(-1)!+Math.hypot(edge.points[i]!.x-edge.points[i-1]!.x,edge.points[i]!.z-edge.points[i-1]!.z));const total=lengths.at(-1)!,len=Math.hypot(b.x-a.x,b.z-a.z),reverse=lane.from!==edge.from,sign=reverse?-1:1,trim=Math.min(total*.22,Math.max(14,widths[lane.from]!*.5+8,widths[lane.to]!*.5+8));
  paths.set(lane.id,{id:lane.id,lane,edge,from:lane.from,to:lane.to,length:total-2*trim,total,trim,axis:Math.abs(b.x-a.x)>Math.abs(b.z-a.z)?'x':'z',reverse,dx:(b.x-a.x)/len*sign,dz:(b.z-a.z)/len*sign,nx:(b.z-a.z)/len,nz:-(b.x-a.x)/len,rawLengths:lengths});
 }return paths;
}
export function lanePoint(path:LanePath,distance:number,lateral=0):V3{
 const d=path.reverse?path.total-path.trim-clamp(distance,0,path.length):path.trim+clamp(distance,0,path.length);let i=0;while(i<path.rawLengths.length-2&&path.rawLengths[i+1]!<d)i++;
 const a=path.edge.points[i]!,b=path.edge.points[i+1]!,u=clamp((d-path.rawLengths[i]!)/Math.max(.01,path.rawLengths[i+1]!-path.rawLengths[i]!));
 return v3(a.x+(b.x-a.x)*u+path.nx*path.lane.offset-path.dz*lateral,a.y+(b.y-a.y)*u+.64,a.z+(b.z-a.z)*u+path.nz*path.lane.offset+path.dx*lateral);
}
function bezier(a:V3,b:V3,c:V3,t:number):V3{const k=1-t;return v3(k*k*a.x+2*k*t*b.x+t*t*c.x,k*k*a.y+2*k*t*b.y+t*t*c.y,k*k*a.z+2*k*t*b.z+t*t*c.z);}
export function carsOverlap(a:Pick<CarAgent,'position'|'yaw'|'definition'>,b:Pick<CarAgent,'position'|'yaw'|'definition'>,padding=0):boolean{
 const ca=CARS[a.definition]!,cb=CARS[b.definition]!,dx=b.position.x-a.position.x,dz=b.position.z-a.position.z;if(Math.abs(a.position.y-b.position.y)>2.6)return false;
 const axes=[[Math.cos(a.yaw),-Math.sin(a.yaw)],[Math.sin(a.yaw),Math.cos(a.yaw)],[Math.cos(b.yaw),-Math.sin(b.yaw)],[Math.sin(b.yaw),Math.cos(b.yaw)]];
 for(const [x,z]of axes){const ra=(ca.halfWidth+padding)*Math.abs(x!*Math.cos(a.yaw)-z!*Math.sin(a.yaw))+(ca.halfLength+padding)*Math.abs(x!*Math.sin(a.yaw)+z!*Math.cos(a.yaw));const rb=(cb.halfWidth+padding)*Math.abs(x!*Math.cos(b.yaw)-z!*Math.sin(b.yaw))+(cb.halfLength+padding)*Math.abs(x!*Math.sin(b.yaw)+z!*Math.cos(b.yaw));if(Math.abs(dx*x!+dz*z!)>=ra+rb)return false;}return true;
}
export class TrafficSimulation {
 readonly paths:Map<string,LanePath>;readonly cars:CarAgent[]=[];readonly parked:ParkedAgent[]=[];readonly reservations=new Map<number,string>();
 readonly stats={spawned:0,retired:0,enteredIntersections:0,redViolations:0,overlapFrames:0,maxOverlaps:0,brakesForPlayer:0,swerves:0,pullOvers:0,honks:0,overtakes:0,gunfireReactions:0,maxUnexplainedStop:0};
 time=0;target=60;night=0;anchor=v3();player?:TrafficPlayer;hooks:TrafficHooks={};onHonk?:(position:V3)=>void;
 private serial=0;private random=seededRandom(90912219);private spawnClock=0;private auditClock=0;private candidates:LanePath[]=[];private previousAnchor=v3(Infinity,0,Infinity);private preferredNext=new Map<string,string>();private freeWait=new Map<string,number>();
 constructor(readonly layout:CityLayout){this.paths=buildLanes(layout);}
 setAnchor(p:V3):void{this.anchor={...p};if(Math.hypot(p.x-this.previousAnchor.x,p.z-this.previousAnchor.z)<50)return;this.previousAnchor={...p};this.candidates=[...this.paths.values()].filter(path=>path.edge.kind!=='mountain'&&path.edge.kind!=='tunnel'&&path.length>30).sort((a,b)=>{const p1=lanePoint(a,a.length*.5),p2=lanePoint(b,b.length*.5);return Math.hypot(p1.x-p.x,p1.z-p.z)-Math.hypot(p2.x-p.x,p2.z-p.z);}).filter(path=>{const m=lanePoint(path,path.length*.5);return Math.hypot(m.x-p.x,m.z-p.z)<570;}).slice(0,64);this.seedParking();
  // Refill only outside the immediate view after long trips/teleports. Do not keep
  // an old suburb's entire population while the new street stays empty.
  for(const c of [...this.cars])if(Math.hypot(c.position.x-p.x,c.position.z-p.z)>690)this.remove(c.id);
 }
 seedParking():void {if(this.parked.filter(p=>!p.taken&&Math.hypot(p.position.x-this.anchor.x,p.position.z-this.anchor.z)<650).length>=12)return;for(let i=this.parked.length-1;i>=0;i--)if(Math.hypot(this.parked[i]!.position.x-this.anchor.x,this.parked[i]!.position.z-this.anchor.z)>690)this.parked.splice(i,1);
  for(const path of this.candidates){if(this.parked.filter(p=>!p.taken).length>=16)break;if(path.edge.kind!=='local'&&path.edge.kind!=='arterial')continue;if(this.parked.some(p=>p.id===`parked-edge-${path.edge.id}`))continue;const i=this.parked.length,car=ROSTER[i%12]!,position=lanePoint(path,path.length*(.25+(i%3)*.23));const side=path.reverse?1:-1,off=path.edge.width/2+1.12;position.x+=path.nx*(side*off-path.lane.offset);position.z+=path.nz*(side*off-path.lane.offset);this.parked.push({id:`parked-edge-${path.edge.id}`,definition:car.id,position,yaw:Math.atan2(path.dx,path.dz),taken:false,occupied:i%3===0,damage:0,burnSeconds:0});}
 }
 private spawn():boolean{for(let attempt=0;attempt<140;attempt++){const path=this.candidates[Math.min(this.candidates.length-1,Math.floor(this.random()**1.8*this.candidates.length))];if(!path)break;const progress=8+this.random()*Math.max(1,path.length-22),position=lanePoint(path,progress),definition=ROSTER[this.serial%12]!,yaw=Math.atan2(path.dx,path.dz);if(this.player&&Math.hypot(position.x-this.player.position.x,position.z-this.player.position.z)<35)continue;
   if(this.cars.some(c=>c.lane===path.id&&Math.abs(c.progress-progress)<24||Math.hypot(c.position.x-position.x,c.position.z-position.z)<13))continue;
   const personality=(['cautious','normal','aggressive']as const)[this.serial%3]!,agent:CarAgent={id:`traffic-${this.serial++}`,definition:definition.id,damage:0,burnSeconds:0,lane:path.id,progress,speed:0,desiredSpeed:0,position,previous:{...position},yaw,previousYaw:yaw,personality,state:'cruise',indicator:0,braking:false,headlights:false,wait:0,odometer:0,lateral:0,reactions:0,honkCooldown:0,fleeUntil:0};this.cars.push(agent);this.stats.spawned++;return true;
  }return false;}
 prime(p:V3):void{this.setAnchor(p);while(this.cars.length<this.target&&this.spawn()){} }
 remove(id:string):void{const i=this.cars.findIndex(c=>c.id===id);if(i>=0){const car=this.cars[i]!;if(car.transition)this.reservations.delete(car.transition.node);this.cars.splice(i,1);this.preferredNext.delete(id);this.freeWait.delete(id);this.stats.retired++;}const parked=this.parked.find(p=>p.id===id);if(parked)parked.taken=true;}
 gunfire(position:V3,duration=8):void{this.hooks.gunfire={position:{...position},until:this.time+duration};}
 siren(enabled:boolean,position:V3):void{this.hooks.siren={enabled,position:{...position}};}
 private chooseNext(car:CarAgent,path:LanePath):LanePath|undefined{let options=this.layout.nodes[path.to]!.outgoing.map(id=>this.paths.get(id)).filter((p):p is LanePath=>!!p&&p.edge.id!==path.edge.id);if(!options.length)options=this.layout.nodes[path.to]!.outgoing.map(id=>this.paths.get(id)).filter((p):p is LanePath=>!!p);if(!options.length)return;
  const remembered=this.preferredNext.get(car.id),found=options.find(p=>p.id===remembered);if(found)return found;
  const sorted=options.sort((a,b)=>a.id.localeCompare(b.id)),next=sorted[Math.floor(this.random()*sorted.length)]!;this.preferredNext.set(car.id,next.id);return next;
 }
 private exitClear(next:LanePath,car:CarAgent):boolean{const length=CARS[car.definition]!.halfLength*2+5;return !this.cars.some(other=>other!==car&&((other.lane===next.id&&other.progress<length+7)||(other.transition?.next===next.id)));}
 private intersectionClear(car:CarAgent,path:LanePath,next:LanePath):boolean {
  const active=this.cars.filter(c=>c!==car&&c.transition?.node===path.to);if(!active.length)return true;
  if(path.dx*next.dx+path.dz*next.dz<.95)return false;
  const a=lanePoint(path,path.length),b=lanePoint(next,0),coordinate=(p:V3)=>path.axis==='x'?p.z:p.x,alo=Math.min(coordinate(a),coordinate(b)),ahi=Math.max(coordinate(a),coordinate(b));
  return active.every(c=>{const p=this.paths.get(c.lane)!,n=this.paths.get(c.transition!.next)!;if(p.axis!==path.axis||p.dx*n.dx+p.dz*n.dz<.95)return false;const lo=Math.min(coordinate(c.transition!.from),coordinate(c.transition!.to)),hi=Math.max(coordinate(c.transition!.from),coordinate(c.transition!.to)),gap=Math.max(alo-hi,lo-ahi);return gap>CARS[car.definition]!.halfWidth+CARS[c.definition]!.halfWidth+.9;});
 }
 private transitionStart(car:CarAgent,path:LanePath,next:LanePath):void{const from=lanePoint(path,path.length,car.lateral),to=lanePoint(next,0),n=this.layout.nodes[path.to]!,control=path.dx*next.dx+path.dz*next.dz>.95?v3((from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2):v3(n.x,(from.y+to.y)*.5,n.z);let length=0,previous=from;for(let j=1;j<=12;j++){const p=bezier(from,control,to,j/12);length+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}car.transition={from,control,to,next:next.id,length:Math.max(4,length),progress:0,node:path.to};car.queuedAt=undefined;this.reservations.set(path.to,car.id);this.stats.enteredIntersections++;if(lightState(path.to,path.axis,this.time)!=='green')this.stats.redViolations++;this.preferredNext.delete(car.id);}
 private tryOvertake(car:CarAgent,path:LanePath):boolean{if(path.edge.lanes<4||car.transition||car.laneChange||path.length-car.progress<65)return false;for(const next of this.paths.values()){if(next.edge.id!==path.edge.id||next.from!==path.from||next.id===path.id)continue;if(this.cars.some(c=>c!==car&&(c.lane===next.id||c.laneChange?.from===next.id)&&Math.abs(c.progress-car.progress)<20+car.speed*1.5))continue;car.laneChange={from:path.id,remaining:1.2};car.indicator=next.lane.offset>path.lane.offset?1:-1;car.lane=next.id;car.state='overtaking';this.stats.overtakes++;return true;}return false;}
 update(dt:number,p?:TrafficPlayer):void{
  dt=Math.min(.05,Math.max(0,dt));this.time+=dt;this.player=p;this.spawnClock+=dt;this.auditClock+=dt;
  if(this.cars.length>this.target){const far=[...this.cars].filter(c=>!c.transition).sort((a,b)=>Math.hypot(b.position.x-this.anchor.x,b.position.z-this.anchor.z)-Math.hypot(a.position.x-this.anchor.x,a.position.z-this.anchor.z));for(const c of far.slice(0,this.cars.length-this.target))if(Math.hypot(c.position.x-this.anchor.x,c.position.z-this.anchor.z)>90)this.remove(c.id);}
  if(this.spawnClock>.15){this.spawnClock=0;for(const car of [...this.cars])if(Math.hypot(car.position.x-this.anchor.x,car.position.z-this.anchor.z)>690)this.remove(car.id);for(let n=0;n<4&&this.cars.length<this.target;n++)if(!this.spawn())break;}
  const groups=new Map<string,CarAgent[]>();for(const car of this.cars){const group=groups.get(car.lane)??[];group.push(car);groups.set(car.lane,group);}for(const list of groups.values())list.sort((a,b)=>b.progress-a.progress);
  // Front-to-back within a lane, transitioning cars first, then stable IDs.
  const ordered=[...this.cars].sort((a,b)=>Number(!!b.transition)-Number(!!a.transition)||a.lane.localeCompare(b.lane)||b.progress-a.progress);
  for(const car of ordered){const path=this.paths.get(car.lane)!,def=CARS[car.definition]!,driver=DRIVERS[car.personality];car.previous={...car.position};car.previousYaw=car.yaw;car.honkCooldown=Math.max(0,car.honkCooldown-dt);car.headlights=this.night>.4||Number(car.id.split('-')[1])%9===0;
   const siren=this.hooks.siren,gunfire=this.hooks.gunfire,nearSiren=!!siren?.enabled&&Math.hypot(car.position.x-siren.position.x,car.position.z-siren.position.z)<100;
   if(gunfire&&gunfire.until>this.time&&Math.hypot(car.position.x-gunfire.position.x,car.position.z-gunfire.position.z)<110){if(car.fleeUntil<this.time)this.stats.gunfireReactions++;car.fleeUntil=this.time+8;}
   let target=Math.min(def.topSpeed*.58,path.lane.speedLimit/3.6*driver.speed)*(car.fleeUntil>this.time?1.2:1),limit=path.length;car.state=car.fleeUntil>this.time?'fleeing':'cruise';car.braking=false;
   if(car.transition){target=nearSiren?3:6;car.state='turning';}
   else {
    const list=groups.get(car.lane)!,leader=list.filter(other=>other!==car&&!other.transition&&other.progress>car.progress).sort((a,b)=>a.progress-b.progress)[0],gap=leader?leader.progress-car.progress-def.halfLength-CARS[leader.definition]!.halfLength:Infinity;
    if(leader){const safe=driver.gap+car.speed*driver.headway;limit=Math.min(limit,leader.progress-def.halfLength-CARS[leader.definition]!.halfLength-driver.gap);if(gap<safe+8){target=Math.min(target,Math.max(0,leader.speed+(gap-safe)*.55));car.state='following';if(car.wait>driver.patience&&gap>5&&leader.speed<path.lane.speedLimit/3.6*.65&&this.tryOvertake(car,path)) { car.wait=0;continue; }}}
    if(path.length-car.progress<40&&car.speed<.6)car.queuedAt??=this.time;
    const next=this.chooseNext(car,path),green=lightState(path.to,path.axis,this.time)==='green';
    const waiting=ordered.filter(c=>!c.transition&&c.queuedAt!==undefined&&!groups.get(c.lane)!.some(o=>o!==c&&!o.transition&&o.progress>c.progress)&&this.paths.get(c.lane)!.to===path.to&&this.paths.get(c.lane)!.length-c.progress<8&&lightState(path.to,this.paths.get(c.lane)!.axis,this.time)==='green'&&(()=>{const next=this.chooseNext(c,this.paths.get(c.lane)!);return !!next&&this.exitClear(next,c)&&this.intersectionClear(c,this.paths.get(c.lane)!,next);})()).sort((a,b)=>a.queuedAt!-b.queuedAt!||a.id.localeCompare(b.id));
    const priority=!waiting.length||waiting[0]===car;
    const canGo=!!next&&green&&priority&&this.intersectionClear(car,path,next)&&this.exitClear(next,car);
    if(!canGo){limit=Math.min(limit,path.length-1);const remain=limit-car.progress;target=Math.min(target,Math.sqrt(Math.max(0,2*driver.brake*(remain-.4))));if(remain<65)car.state=!green?'red-light':'yielding';}
    if(next&&path.length-car.progress<45){const cross=path.dx*next.dz-path.dz*next.dx;car.indicator=Math.abs(cross)>.15?Math.sign(cross):0;}
    if(nearSiren){car.state='pulling-over';target=Math.min(target,1.3);if(car.lateral<.05){this.stats.pullOvers++;car.reactions++;}car.lateral+=(Math.min(1.2,path.lane.width*.32)-car.lateral)*(1-Math.exp(-dt*2));car.indicator=1;}
    else car.lateral+=(0-car.lateral)*(1-Math.exp(-dt*1.5));
    if(p){const dx=p.position.x-car.position.x,dz=p.position.z-car.position.z,ahead=dx*path.dx+dz*path.dz,side=dx*(-path.dz)+dz*path.dx,playerWidth=(p.halfWidth??.45)+def.halfWidth+.75;
      if(ahead> -def.halfLength&&ahead<Math.max(14,car.speed*2.3)&&Math.abs(side)<playerWidth&&Math.abs(p.position.y-car.position.y)<3){const stop=Math.max(car.progress,car.progress+ahead-def.halfLength-(p.halfLength??.5)-2);limit=Math.min(limit,stop);target=Math.min(target,Math.sqrt(Math.max(0,2*driver.brake*(stop-car.progress-.4))));car.state='crash-brake';if(!car.braking){car.reactions++;this.stats.brakesForPlayer++;}car.braking=true;
       if(p.crashed&&path.edge.lanes>=4&&this.tryOvertake(car,path))this.stats.swerves++;
      }
    }
    if(car.progress>=path.length-.99&&canGo&&next){this.transitionStart(car,path,next);car.state='turning';target=Math.min(target,6);}
   }
   if(car.damage>=1){target=0;car.state='crash-brake';car.burnSeconds+=dt;}
   car.stopAt=!car.transition&&limit<path.length?limit:undefined;car.desiredSpeed=target;const previousSpeed=car.speed;car.speed=Math.max(0,car.speed+clamp(target-car.speed,-driver.brake*dt,driver.accel*dt));car.braking ||= target<previousSpeed-.25;
   let distance=car.speed*dt;
   if(car.transition){const turn=car.transition;turn.progress+=distance;const t=clamp(turn.progress/turn.length),position=bezier(turn.from,turn.control,turn.to,t),dx=(1-t)*(turn.control.x-turn.from.x)+t*(turn.to.x-turn.control.x),dz=(1-t)*(turn.control.z-turn.from.z)+t*(turn.to.z-turn.control.z);car.position=position;car.yaw=Math.atan2(dx,dz);
     if(t>=1){car.lane=turn.next;car.progress=0;car.transition=undefined;car.indicator=0;this.reservations.delete(turn.node);}
   } else {distance=Math.min(distance,Math.max(0,limit-car.progress));if(distance<car.speed*dt-.001)car.speed=distance/dt;car.progress+=distance;car.position=lanePoint(this.paths.get(car.lane)!,car.progress,car.lateral);car.yaw=Math.atan2(path.dx,path.dz);
     if(car.laneChange){const change=car.laneChange;change.remaining-=dt;const from=lanePoint(this.paths.get(change.from)!,car.progress,car.lateral),u=1-clamp(change.remaining/1.2);car.position.x=from.x+(car.position.x-from.x)*u;car.position.z=from.z+(car.position.z-from.z)*u;if(change.remaining<=0){car.laneChange=undefined;car.indicator=0;}}
   }
   car.odometer+=distance;if(car.speed<.4){car.wait+=dt;if(car.state==='cruise'){const t=(this.freeWait.get(car.id)??0)+dt;this.freeWait.set(car.id,t);this.stats.maxUnexplainedStop=Math.max(this.stats.maxUnexplainedStop,t);}else this.freeWait.set(car.id,0);if((car.state==='following'||car.state==='crash-brake')&&car.wait>driver.patience&&car.honkCooldown<=0){this.stats.honks++;car.honkCooldown=12;this.onHonk?.(car.position);}}
   else {car.wait=0;this.freeWait.set(car.id,0);}
  }
  for(const parked of this.parked)if(parked.damage>=1)parked.burnSeconds+=dt;
  this.reservations.clear();for(const car of this.cars)if(car.transition)this.reservations.set(car.transition.node,car.id);
  if(this.auditClock>.20){this.auditClock=0;let overlaps=0;for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){const a=this.cars[i]!,b=this.cars[j]!;if(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<8&&carsOverlap(a,b,-.12))overlaps++;}this.stats.maxOverlaps=Math.max(this.stats.maxOverlaps,overlaps);if(overlaps)this.stats.overlapFrames++;}
 }
 snapshot(){return {time:this.time,target:this.target,cars:this.cars.length,parked:this.parked.filter(c=>!c.taken).length,parkedAgents:this.parked.map(c=>({...c,position:{...c.position}})),personalities:{cautious:this.cars.filter(c=>c.personality==='cautious').length,normal:this.cars.filter(c=>c.personality==='normal').length,aggressive:this.cars.filter(c=>c.personality==='aggressive').length},reservations:this.reservations.size,stats:{...this.stats},siren:this.hooks.siren?.enabled??false,gunfireHookUntil:this.hooks.gunfire?.until??0,agents:this.cars.map(c=>({...c,position:{...c.position},previous:{...c.previous},transition:c.transition?{...c.transition}:undefined}))};}
}
