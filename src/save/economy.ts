import type { ParkourStore } from './parkour';
// One bank: upgrades spend the same guarded, migrated cash earned by older runs.
export class Economy {
 health=100;hospitalVisits=0;
 constructor(readonly progress:ParkourStore){}
 get cash():number{return this.progress.data.cash;}
 earn(amount:number):void{if(!Number.isFinite(amount)||amount<=0)return;this.progress.data.cash=Math.min(1e9,this.cash+Math.floor(amount));this.save();}
 spend(amount:number):boolean{if(!Number.isFinite(amount)||amount<0||this.cash<amount)return false;this.progress.data.cash-=Math.ceil(amount);this.save();return true;}
 fee(amount:number):number{const paid=Math.min(this.cash,Math.max(0,Math.floor(amount)));this.spend(paid);return paid;}
 damage(amount:number):boolean{if(!Number.isFinite(amount)||amount<0)return false;this.health=Math.max(0,this.health-amount);return this.health===0;}
 recover():void{this.health=100;this.hospitalVisits++;}
 private save():void{this.progress.storage.write(this.progress.data);}
 snapshot(){return{cash:this.cash,health:this.health,hospitalVisits:this.hospitalVisits,saveAvailable:this.progress.storage.available};}
}
