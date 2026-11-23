import { SaveStore } from '../save';
import { CARS, HARBOR, clamp } from './cars';
export interface GarageCar { vin:string; definition:string; paint:string; damage:number; reward?:boolean }
export interface GarageData { slots:GarageCar[]; lastOwned:GarageCar|null; rewardPending:boolean; rewardGranted:boolean; nextVin:number }
function valid(value:unknown):GarageCar|undefined { if(!value||typeof value!=='object')return;const v=value as GarageCar;if(!Object.hasOwn(CARS,v.definition)||typeof v.vin!=='string'||!(/^[a-zA-Z0-9_-]{1,100}$/).test(v.vin))return;return {vin:v.vin,definition:v.definition,paint:/^#[0-9a-f]{6}$/i.test(v.paint)?v.paint:CARS[v.definition]!.paints[0]!,damage:Number.isFinite(v.damage)?clamp(v.damage):0,reward:!!v.reward}; }
export class Garage {
  readonly storage=new SaveStore('crosstown:garage:v1'); readonly capacity=6;
  data:GarageData={slots:[],lastOwned:null,rewardPending:false,rewardGranted:false,nextVin:1};
  constructor(){const raw=this.storage.read<Partial<GarageData>>({});if(raw&&typeof raw==='object'){const ids=new Set<string>();for(const v of Array.isArray(raw.slots)?raw.slots:[]){const c=valid(v);if(c&&!ids.has(c.vin)&&this.data.slots.length<6){ids.add(c.vin);this.data.slots.push(c);}}this.data.lastOwned=valid(raw.lastOwned)??null;this.data.rewardPending=!!raw.rewardPending;this.data.rewardGranted=!!raw.rewardGranted||this.data.rewardPending||this.data.slots.some(c=>c.reward)||!!this.data.lastOwned?.reward;this.data.nextVin=Number.isSafeInteger(raw.nextVin)?Math.max(1,raw.nextVin!):1;}}
  make(definition:string,paint?:string):GarageCar {const c=CARS[definition]??HARBOR;let vin:string;do{vin=`owned-${this.data.nextVin++}`;}while(this.data.slots.some(s=>s.vin===vin)||this.data.lastOwned?.vin===vin);return {vin,definition:c.id,paint:paint??c.paints[0]!,damage:0};}
  own(car:GarageCar):void {this.data.lastOwned={...car};this.save();}
  store(car:GarageCar):boolean {const index=this.data.slots.findIndex(c=>c.vin===car.vin);if(index>=0)this.data.slots[index]={...car};else if(this.data.slots.length>=this.capacity)return false;else this.data.slots.push({...car});this.own(car);return true;}
  grantReward():GarageCar {const reward:GarageCar={vin:'parkour-reward',definition:'harbor',paint:HARBOR.paints[0]!,damage:0,reward:true};if(this.data.rewardGranted)return this.data.slots.find(c=>c.vin===reward.vin)??reward;this.data.rewardGranted=true;if(!this.data.slots.some(c=>c.vin===reward.vin)){if(this.data.slots.length<6)this.data.slots.push(reward);else this.data.rewardPending=true;}this.data.lastOwned={...reward};this.save();return reward;}
  retrieve(vin:string):GarageCar|undefined {const stored=this.data.slots.find(c=>c.vin===vin);if(!stored)return;this.data.lastOwned={...stored};this.save();return {...stored};}
  remove(vin:string):boolean {const i=this.data.slots.findIndex(c=>c.vin===vin);if(i<0)return false;this.data.slots.splice(i,1);if(this.data.rewardPending&&!this.data.slots.some(c=>c.reward)){this.data.rewardPending=false;this.data.slots.push({vin:'parkour-reward',definition:'harbor',paint:HARBOR.paints[0]!,damage:0,reward:true});}this.save();return true;}
  update(car:GarageCar):void {const i=this.data.slots.findIndex(c=>c.vin===car.vin);if(i>=0)this.data.slots[i]={...car};if(this.data.lastOwned?.vin===car.vin)this.data.lastOwned={...car};this.save();}
  recover():GarageCar|undefined {const c=this.data.lastOwned;if(!c)return;const repaired={...c,damage:0};this.data.lastOwned=repaired;const i=this.data.slots.findIndex(v=>v.vin===c.vin);if(i>=0)this.data.slots[i]=repaired;this.save();return {...repaired};}
  save():boolean{return this.storage.write(this.data);}
  clear():void{this.data={slots:[],lastOwned:null,rewardPending:false,rewardGranted:false,nextVin:1};this.storage.clear();}
  snapshot(){return {...this.data,slots:this.data.slots.map(c=>({...c})),lastOwned:this.data.lastOwned?{...this.data.lastOwned}:null,capacity:this.capacity,available:this.storage.available};}
}
