import { SaveStore } from '../save';import type { V3 } from '../parkour/types';
export type ActivityType='race'|'trial'|'drift'|'stunt'|'delivery'|'speed';
export interface Activity {id:string;type:ActivityType;name:string;start:V3;route:V3[];limit:number;reward:number;target:number}
export interface ActivityResult {id:string;type:ActivityType;value:number;seconds:number;score:number;reward:number;date:string}
export interface ChallengeSample {position:V3;speed:number;slip:number;damage:number;airborne:number;grounded:boolean}
export class ActivityRun {
 elapsed=0;score=0;gate=1;state:'running'|'finished'|'failed'='running';reason='';airDistance=0;jumps=0;private airborne=false;private was=0;private previous:V3;private paid=false;
 constructor(readonly activity:Activity,readonly initialDamage:number,readonly finish:(r:ActivityResult)=>void){this.previous={...activity.start};}
 update(dt:number,s:ChallengeSample):void{if(this.state!=='running')return;dt=Math.max(0,Math.min(.1,dt));this.elapsed+=dt;const distance=Math.hypot(s.position.x-this.previous.x,s.position.z-this.previous.z);this.previous={...s.position};const a=this.activity;
  if(a.type==='delivery'&&s.damage-this.initialDamage>.18){this.fail('DELIVERY FAILED · cargo damage limit exceeded');return;}
  if(a.type==='drift'&&Math.abs(s.speed)>5&&Math.abs(s.slip)>.14&&s.grounded)this.score+=Math.min(60,Math.abs(s.speed)*Math.abs(s.slip)*4)*dt;
  if(a.type==='stunt'){if(!s.grounded){this.airborne=true;this.airDistance+=Math.min(distance,Math.abs(s.speed)*dt*1.5);this.was+=dt;}else if(s.grounded&&this.airborne){if(this.airDistance>=5&&this.was>=.2){this.jumps++;this.score+=Math.round(this.airDistance*25+this.was*150);}this.airDistance=this.was=0;this.airborne=false;}if(this.jumps>=a.target)this.complete();}
  const target=a.route[this.gate];if(target&&Math.hypot(target.x-s.position.x,target.z-s.position.z)<12&&Math.abs(target.y-s.position.y)<8){if(a.type==='speed'){this.score=Math.abs(s.speed)*3.6;if(this.score>=a.target)this.complete();else this.fail(`SPEED TRAP · ${Math.round(this.score)} / ${a.target} km/h · try again`);}else if(['race','trial','delivery'].includes(a.type)){this.gate++;if(this.gate>=a.route.length)this.complete();}}
  if(this.elapsed>=a.limit){if(a.type==='drift'&&this.score>=a.target)this.complete();else this.fail(a.type==='drift'?`DRIFT ZONE · ${Math.floor(this.score)} / ${a.target} points`:'TIME IS UP · drive out and try again');}
 }
 fail(reason:string):void{if(this.state!=='running')return;this.state='failed';this.reason=reason;}
 private complete():void{if(this.state!=='running'||this.paid)return;this.state='finished';this.paid=true;const a=this.activity;this.reason=`${a.name.toUpperCase()} · COMPLETE +$${a.reward}`;this.finish({id:a.id,type:a.type,value:['race','trial','delivery'].includes(a.type)?this.elapsed:this.score,seconds:this.elapsed,score:this.score,reward:a.reward,date:new Date().toISOString()});}
 snapshot(){return{activity:this.activity.id,type:this.activity.type,name:this.activity.name,state:this.state,elapsed:this.elapsed,remaining:Math.max(0,this.activity.limit-this.elapsed),score:this.score,gate:this.gate,total:this.activity.route.length,jumps:this.jumps,reason:this.reason};}
}
export class ActivityRecords {
 readonly storage:SaveStore;readonly best:Record<string,ActivityResult[]>={};
 constructor(storage=new SaveStore('crosstown:challenges:v1')){this.storage=storage;const raw=storage.read<unknown>({});if(raw&&typeof raw==='object')for(const[id,values]of Object.entries(raw)){if(!/^[a-z0-9-]{1,60}$/.test(id)||!Array.isArray(values))continue;const valid=values.filter(r=>r&&r.id===id&&['race','trial','drift','stunt','delivery','speed'].includes(r.type)&&[r.value,r.seconds,r.score,r.reward].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0));this.best[id]=valid.slice(0,3);}}
 record(r:ActivityResult):void{const scores=[...(this.best[r.id]??[]),r],timed=['race','trial','delivery'].includes(r.type);scores.sort((a,b)=>timed?a.value-b.value:b.value-a.value);this.best[r.id]=scores.slice(0,3);this.storage.write(this.best);}
}
