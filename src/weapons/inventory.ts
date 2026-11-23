import { SaveStore } from '../save';
import { WEAPONS, weapon, type WeaponId } from './catalog';
export interface Ammo {owned:boolean;loaded:number;reserve:number}
export class Arsenal {
 readonly storage:SaveStore; readonly ammo={} as Record<WeaponId,Ammo>;selected:WeaponId|'unarmed'='unarmed';reloadLeft=0;cooldown=0;dirty=false;
 constructor(storage=new SaveStore('crosstown:arsenal:v1')){this.storage=storage;const raw=storage.read<unknown>(null),data=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};for(const w of WEAPONS){const a=data[w.id] as Partial<Ammo>|undefined;this.ammo[w.id]={owned:w.id==='bat'||a?.owned===true,loaded:a&&Number.isFinite(a.loaded)?Math.max(0,Math.min(w.magazine,Math.floor(a.loaded!))):w.id==='bat'?1:0,reserve:a&&Number.isFinite(a.reserve)?Math.max(0,Math.min(999,Math.floor(a.reserve!))):0};}}
 select(id:WeaponId|'unarmed',practice=false):boolean{if(id!=='unarmed'&&!practice&&!this.ammo[id].owned)return false;this.selected=id;this.reloadLeft=0;return true;}
 buy(id:WeaponId,pay:(cost:number)=>boolean,ammoOnly=false):boolean{const w=weapon(id),a=this.ammo[id];if(ammoOnly&&!a.owned)return false;if(!ammoOnly&&a.owned)return false;if(!pay(ammoOnly?w.ammoPrice:w.price))return false;if(ammoOnly)a.reserve=Math.min(999,a.reserve+w.magazine*3);else{a.owned=true;a.loaded=w.magazine;a.reserve=w.reserve;}this.dirty=true;this.save();return true;}
 update(dt:number):void{this.cooldown=Math.max(0,this.cooldown-dt);if(this.reloadLeft>0){this.reloadLeft=Math.max(0,this.reloadLeft-dt);if(this.reloadLeft===0&&this.selected!=='unarmed'){const w=weapon(this.selected),a=this.ammo[w.id],n=Math.min(w.magazine-a.loaded,a.reserve);a.loaded+=n;a.reserve-=n;this.dirty=true;}}}
 reload():boolean{if(this.selected==='unarmed'||this.selected==='bat'||this.reloadLeft>0)return false;const w=weapon(this.selected),a=this.ammo[w.id];if(a.loaded>=w.magazine||a.reserve<=0)return false;this.reloadLeft=w.reload;return true;}
 consume(practice=false):boolean{if(this.selected==='unarmed'||this.cooldown>0||this.reloadLeft>0)return false;const w=weapon(this.selected),a=this.ammo[w.id];if(!practice&&!a.owned)return false;if(!practice&&w.id!=='bat'){if(a.loaded<=0){this.reload();return false;}a.loaded--;this.dirty=true;}this.cooldown=w.interval;return true;}
 loseAmmo():void{for(const w of WEAPONS){if(w.id==='bat')continue;const a=this.ammo[w.id];a.loaded=Math.floor(a.loaded/2);a.reserve=Math.floor(a.reserve/2);}this.selected='unarmed';this.reloadLeft=0;this.save();}
 save():void{this.storage.write(this.ammo);this.dirty=false;}
 snapshot(){return{selected:this.selected,reloadLeft:this.reloadLeft,cooldown:this.cooldown,ammo:structuredClone(this.ammo),saveAvailable:this.storage.available};}
}
