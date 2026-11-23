// Sidewalk navigation graph: corner-to-corner walking links, controlled crossings,
// real destinations and timed social/bench/parked-car states. No weapons system.
import { seededRandom, v3, type V3 } from '../parkour/types';
import { roadHeightAt } from '../world/city/layout';
import type { CityLayout } from '../world/city/types';
import { pedestrianMayStart, pedestrianPhase, type ParkedAgent, type TrafficPlayer } from './traffic';
export interface WalkNode extends V3 {id:number;intersection:number;corner:number;links:WalkLink[];bench:V3}
export interface WalkLink {to:number;length:number;crossing:boolean;intersection:number}
export type PedState='walk'|'idle'|'chat'|'sit'|'wait-crossing'|'cross'|'run'|'flee'|'enter-car'|'in-car'|'exit-car'|'down';
export interface PedAgent {id:string;position:V3;previous:V3;yaw:number;state:PedState;from:number;to:number;progress:number;destination:number;speed:number;clock:number;fearUntil:number;variant:number;crossing:boolean;crossingNode:number;crossStarted:number;car?:string;entered?:V3;health?:number;downUntil?:number}
export function buildSidewalks(layout:CityLayout):WalkNode[]{const out:WalkNode[]=[];const signs=[[1,-1],[1,1],[-1,1],[-1,-1]];
 for(const node of layout.nodes){const width=Math.max(10,...node.outgoing.map(l=>layout.edges[Number(l.split(':')[0])]!.width)),r=width/2+3.2;
  for(let i=0;i<4;i++){const [sx,sz]=signs[i]!,x=node.x+sx!*r,z=node.z+sz!*r;out.push({id:node.id*4+i,intersection:node.id,corner:i,x,y:roadHeightAt(x,z)+.02,z,links:[],bench:v3(x+sx!*1.4,roadHeightAt(x,z),z+sz!*1.4)});}
 }
 const add=(a:number,b:number,crossing:boolean,intersection:number)=>{const n=out[a]!,m=out[b]!;if(!n||!m)return;const length=Math.hypot(n.x-m.x,n.z-m.z);n.links.push({to:b,length,crossing,intersection});m.links.push({to:a,length,crossing,intersection});};
 for(const n of layout.nodes)for(let i=0;i<4;i++)add(n.id*4+i,n.id*4+(i+1)%4,true,n.id);
 for(const e of layout.edges){if(!['local','arterial','bridge'].includes(e.kind)||Math.abs(layout.nodes[e.from]!.x-layout.nodes[e.to]!.x)>1&&Math.abs(layout.nodes[e.from]!.z-layout.nodes[e.to]!.z)>1)continue;const a=layout.nodes[e.from]!,b=layout.nodes[e.to]!;if(Math.abs(a.x-b.x)>Math.abs(a.z-b.z)){const left=a.x<b.x?a:b,right=a.x<b.x?b:a;add(left.id*4,right.id*4+3,false,-1);add(left.id*4+1,right.id*4+2,false,-1);}else{const top=a.z<b.z?a:b,bottom=a.z<b.z?b:a;add(top.id*4+1,bottom.id*4,false,-1);add(top.id*4+2,bottom.id*4+3,false,-1);}}
 return out;
}
export class PedestrianSimulation {
 readonly graph:WalkNode[];readonly agents:PedAgent[]=[];target=120;time=0;night=0;anchor=v3();
 readonly stats={spawned:0,crossingsStarted:0,illegalCrossings:0,walkDestinations:0,chats:0,sits:0,enteredCars:0,leftCars:0,fled:0};
 private random=seededRandom(98122);private serial=0;private nearby:WalkNode[]=[];private previousAnchor=v3(Infinity,0,Infinity);private clock=0;private routes=new Map<string,{goal:number;nodes:number[]}>();
 constructor(readonly layout:CityLayout){this.graph=buildSidewalks(layout);}
 setAnchor(p:V3):void{this.anchor={...p};if(Math.hypot(p.x-this.previousAnchor.x,p.z-this.previousAnchor.z)<50)return;this.previousAnchor={...p};this.nearby=this.graph.filter(n=>n.links.some(l=>!l.crossing)&&Math.hypot(n.x-p.x,n.z-p.z)<570).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,120);}
 private destination(from:number):number {const source=this.graph[from]!;const list=this.nearby.filter(n=>n.id!==from&&Math.hypot(n.x-source.x,n.z-source.z)>40&&Math.hypot(n.x-source.x,n.z-source.z)<600);return list.length?list[Math.floor(this.random()*list.length)]!.id:from;}
 private next(agent:PedAgent):WalkLink|undefined {
  let route=this.routes.get(agent.id),at=route?.nodes.indexOf(agent.from)??-1;
  if(!route||route.goal!==agent.destination||at<0||at===route.nodes.length-1){
   // Small A* on the real footway graph, once per destination. Greedy Euclidean
   // turning can oscillate forever around the roadless rooftop reservation.
   const goal=this.graph[agent.destination]!,open=new Set([agent.from]),g=new Map([[agent.from,0]]),parent=new Map<number,number>();let found=false;
   while(open.size){let best=-1,score=Infinity;for(const id of open){const p=this.graph[id]!,s=g.get(id)!+Math.hypot(p.x-goal.x,p.z-goal.z);if(s<score){score=s;best=id;}}if(best===goal.id){found=true;break;}open.delete(best);
    for(const link of this.graph[best]!.links){const cost=g.get(best)!+link.length+(link.crossing?7:0);if(cost<(g.get(link.to)??Infinity)){g.set(link.to,cost);parent.set(link.to,best);open.add(link.to);}}
   }
   const nodes=[found?goal.id:agent.from];while(nodes[0]!==agent.from&&parent.has(nodes[0]!))nodes.unshift(parent.get(nodes[0]!)!);route={goal:agent.destination,nodes};this.routes.set(agent.id,route);at=0;
  }
  const next=route.nodes[at+1];return this.graph[agent.from]!.links.find(l=>l.to===next)??this.graph[agent.from]!.links.find(l=>!l.crossing);
 }
 private spawn():boolean {if(!this.nearby.length)return false;for(let attempt=0;attempt<100;attempt++){const node=this.nearby[Math.min(this.nearby.length-1,Math.floor(this.random()**1.6*this.nearby.length))]!,link=node.links.find(l=>!l.crossing);if(!link)continue;const to=this.graph[link.to]!,progress=this.random()*.92,position=v3(node.x+(to.x-node.x)*progress,node.y+(to.y-node.y)*progress,node.z+(to.z-node.z)*progress);if(Math.hypot(position.x-this.anchor.x,position.z-this.anchor.z)>600)continue;if(this.agents.some(p=>Math.hypot(p.position.x-position.x,p.position.z-position.z)<1.1))continue;const ped:PedAgent={id:`ped-${this.serial++}`,position,previous:{...position},yaw:Math.atan2(to.x-node.x,to.z-node.z),state:'walk',from:node.id,to:to.id,progress:progress*link.length,destination:this.destination(to.id),speed:1.12+this.random()*.45,clock:0,fearUntil:0,variant:this.serial%6,crossing:false,crossingNode:-1,crossStarted:0};this.agents.push(ped);this.stats.spawned++;return true;}return false;}
 prime(p:V3):void{const first=this.agents.length===0;this.setAnchor(p);while(this.agents.length<this.target&&this.spawn()){}if(first&&this.agents.length>4){const bench=this.nearby.find(n=>n.corner===0&&n.intersection%3===0),corner=this.nearby.find(n=>n.id!==bench?.id);if(bench){const a=this.agents[0]!;a.from=bench.id;a.to=bench.links.find(l=>!l.crossing)?.to??bench.links[0]!.to;a.progress=0;a.position={...bench.bench};a.previous={...a.position};a.state='sit';this.stats.sits++;}if(corner){for(const[i,offset]of [[1,-.52],[2,.52]]){const a=this.agents[i!]!;a.from=corner.id;a.to=corner.links.find(l=>!l.crossing)?.to??corner.links[0]!.to;a.progress=0;a.position=v3(corner.x+offset!,corner.y,corner.z+.38);a.previous={...a.position};a.state='chat';a.yaw=offset!<0?Math.PI/2:-Math.PI/2;}this.stats.chats++;}} }
 flee(position:V3,radius=70):void{for(const ped of this.agents)if(Math.hypot(ped.position.x-position.x,ped.position.z-position.z)<radius){if(ped.fearUntil<=this.time)this.stats.fled++;ped.fearUntil=this.time+8;}}
 update(dt:number,time:number,parked:ParkedAgent[],player?:TrafficPlayer,busyNodes?:ReadonlySet<number>):void {
  dt=Math.max(0,Math.min(.05,dt));this.time=time;this.clock+=dt;const target=Math.round(this.target*(this.night>.4?.48:1));
  if(this.agents.length>target){const far=[...this.agents].sort((a,b)=>Math.hypot(b.position.x-this.anchor.x,b.position.z-this.anchor.z)-Math.hypot(a.position.x-this.anchor.x,a.position.z-this.anchor.z));for(const ped of far.slice(0,this.agents.length-target)){if(Math.hypot(ped.position.x-this.anchor.x,ped.position.z-this.anchor.z)<45)continue;const car=parked.find(c=>c.id===ped.car);if(car)car.occupied=false;this.agents.splice(this.agents.indexOf(ped),1);this.routes.delete(ped.id);}}
  if(this.clock>.12){this.clock=0;for(let i=0;i<2&&this.agents.length<target;i++)this.spawn();for(let i=this.agents.length-1;i>=0;i--){const ped=this.agents[i]!;if(Math.hypot(ped.position.x-this.anchor.x,ped.position.z-this.anchor.z)>690){this.routes.delete(ped.id);this.agents.splice(i,1);};}}
  for(const ped of this.agents){ped.previous={...ped.position};ped.clock+=dt;if(ped.state==='down'){if(time<(ped.downUntil??Infinity))continue;ped.health=65;ped.state='idle';ped.clock=0;ped.fearUntil=time+6;}
   if(player&&Math.abs(player.speed)>8&&Math.hypot(player.position.x-ped.position.x,player.position.z-ped.position.z)<14&&Math.abs(player.position.y-ped.position.y)<3){if(ped.fearUntil<=this.time)this.stats.fled++;ped.fearUntil=this.time+5;}
   const fearful=ped.fearUntil>this.time;
   if(['enter-car','in-car','exit-car'].includes(ped.state)){const car=parked.find(c=>c.id===ped.car&&!c.taken);if(!car){ped.state='flee';ped.fearUntil=this.time+8;ped.car=undefined;ped.clock=0;continue;}
    if(ped.state==='enter-car'&&ped.clock>1.3){ped.state='in-car';ped.clock=0;car.occupied=true;this.stats.enteredCars++;}
    else if(ped.state==='in-car'&&(ped.clock>6+ped.variant||fearful)){ped.state='exit-car';ped.clock=0;car.occupied=false;}
    else if(ped.state==='exit-car'&&ped.clock>1.4){ped.state=fearful?'flee':'walk';ped.clock=0;ped.car=undefined;ped.position=ped.entered??ped.position;this.stats.leftCars++;}continue;
   }
   if(['idle','chat','sit'].includes(ped.state)){if(ped.clock<4+ped.variant*1.7&&!fearful)continue;ped.state=fearful?'flee':'walk';ped.clock=0;if(ped.state==='walk'){ped.destination=this.destination(ped.from);const node=this.graph[ped.from]!;ped.position=v3(node.x,node.y,node.z);if(ped.from===ped.to)ped.to=this.next(ped)?.to??node.links[0]!.to;}}
   const a=this.graph[ped.from]!,b=this.graph[ped.to]!,length=Math.hypot(b.x-a.x,b.z-a.z),link=a.links.find(l=>l.to===ped.to);
   if(!link){ped.to=a.links[0]?.to??ped.from;continue;}
   if(link.crossing&&ped.progress===0&&(!pedestrianMayStart(link.intersection,time,length/ped.speed)||!!busyNodes?.has(link.intersection))) {ped.state='wait-crossing';ped.crossing=false;continue;}
   if(link.crossing&&ped.progress===0){ped.crossing=true;ped.crossingNode=link.intersection;ped.crossStarted=time;this.stats.crossingsStarted++;if(!pedestrianMayStart(link.intersection,time,length/ped.speed))this.stats.illegalCrossings++;}
   ped.state=link.crossing?'cross':fearful?'flee':ped.variant===5?'run':'walk';const speed=link.crossing?ped.speed:fearful?3.8:ped.state==='run'?2.2:ped.speed;
   const next=Math.min(length,ped.progress+speed*dt),u=length?next/length:1,offset=link.crossing?0:.32,x=a.x+(b.x-a.x)*u-(b.z-a.z)/Math.max(1,length)*offset,z=a.z+(b.z-a.z)*u+(b.x-a.x)/Math.max(1,length)*offset;
   // Personal-space braking along a shared footway. Crossers keep walking so the
   // all-red clearance interval cannot strand them in the middle of a road.
   const blocked=!link.crossing&&this.agents.some(other=>other!==ped&&other.state!=='in-car'&&Math.hypot(other.position.x-x,other.position.z-z)<.48&&((other.position.x-ped.position.x)*(b.x-a.x)+(other.position.z-ped.position.z)*(b.z-a.z)>0));
   if(!blocked){ped.progress=next;ped.position=v3(x,a.y+(b.y-a.y)*u,z);ped.yaw=Math.atan2(b.x-a.x,b.z-a.z);}
   if(!link.crossing&&!fearful&&ped.clock>12){const car=parked.find(c=>!c.taken&&!c.occupied&&Math.hypot(c.position.x-ped.position.x,c.position.z-ped.position.z)<3.5);if(car){ped.entered={...ped.position};ped.car=car.id;ped.state='enter-car';ped.clock=0;car.occupied=true;continue;}}
   if(ped.progress>=length-.001){ped.from=ped.to;ped.progress=0;ped.crossing=false;
    if(ped.from===ped.destination||this.random()<.18){this.stats.walkDestinations++;const choice=Math.floor(this.random()*4);ped.state=fearful?'flee':choice===0&&b.corner===0&&b.intersection%3===0?'sit':choice===1?'chat':'idle';ped.clock=0;if(ped.state==='sit'){ped.position={...b.bench};this.stats.sits++;}if(ped.state==='chat'){const partner=this.agents.find(p=>p!==ped&&!p.crossing&&!['in-car','enter-car','exit-car','sit','flee'].includes(p.state)&&Math.hypot(p.position.x-b.x,p.position.z-b.z)<6);if(partner){partner.from=partner.to=b.id;partner.progress=0;partner.state='chat';partner.clock=0;partner.position=v3(b.x+.52,b.y,b.z+.38);partner.yaw=-Math.PI/2;ped.position=v3(b.x-.52,b.y,b.z+.38);ped.yaw=Math.PI/2;this.stats.chats++;}else ped.state='idle';}ped.destination=this.destination(ped.from);}
    const nextLink=this.next(ped);if(nextLink)ped.to=nextLink.to;
   }
  }
 }
 snapshot(){return {time:this.time,target:this.target,effectiveTarget:Math.round(this.target*(this.night>.4?.48:1)),count:this.agents.length,graphNodes:this.graph.length,graphLinks:this.graph.reduce((n,p)=>n+p.links.length,0),stats:{...this.stats},states:Object.fromEntries(['walk','idle','chat','sit','wait-crossing','cross','run','flee','enter-car','in-car','exit-car'].map(state=>[state,this.agents.filter(p=>p.state===state).length])),agents:this.agents.map(p=>({...p,position:{...p.position},crossingPhase:pedestrianPhase(p.crossingNode,this.time)}))};}
}
