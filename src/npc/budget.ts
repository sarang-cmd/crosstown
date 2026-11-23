import type { QualityTier } from '../config/quality';
// Density is a soft budget even when the user pins the render tier. Rendering
// quality itself only changes under the existing Auto selector.
export class PopulationBudget {
 factor=1;frameMs=16.67;changes=0;locked=false;
 private slow=0;private fast=0;private elapsed=0;private changed=-10;
 constructor(public tier:QualityTier){}
 get cars():number{return Math.max(8,Math.round(Math.min(120,100*this.tier.trafficDensity)*this.factor));}
 get pedestrians():number{return Math.max(16,Math.round(Math.min(240,240*this.tier.pedestrianDensity)*this.factor));}
 sample(seconds:number):void{if(!Number.isFinite(seconds)||seconds<=0||seconds>30||this.locked)return;const dt=Math.min(3,seconds);this.elapsed+=dt;this.frameMs+=(seconds*1000-this.frameMs)*.15;this.slow=this.frameMs>24?this.slow+dt:0;this.fast=this.frameMs<17?this.fast+dt:0;if(this.elapsed-this.changed<3)return;if(this.slow>2&&this.factor>.26){this.factor=Math.max(.25,this.factor*.78);this.changed=this.elapsed;this.slow=0;this.changes++;}else if(this.fast>15&&this.factor<1){this.factor=Math.min(1,this.factor+.10);this.changed=this.elapsed;this.fast=0;this.changes++;}}
 snapshot(){return {factor:this.factor,cars:this.cars,pedestrians:this.pedestrians,frameMs:this.frameMs,changes:this.changes,locked:this.locked,tier:this.tier.name};}
}
