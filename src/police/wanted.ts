import { v3, type V3 } from '../parkour/types';
export type WantedMode='unseen'|'seen'|'searching'|'lost';
export function inVision(origin:V3,yaw:number,target:V3,range=60,width=70):boolean{const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz);return d<=range&&d>.01&&(dx*Math.sin(yaw)+dz*Math.cos(yaw))/d>=Math.cos(width*Math.PI/360);}
export class Wanted {
 stars=0;state:WantedMode='lost';unseenSeconds=0;lastSeen=v3();lastCrime=v3();crimes=0;private decayClock=0;
 report(position:V3,witnessed:boolean,severity=1):void{this.lastCrime={...position};this.crimes++;if(witnessed){this.stars=Math.min(5,this.stars+Math.max(1,Math.round(severity)));this.lastSeen={...position};this.unseenSeconds=this.decayClock=0;this.state='seen';}else if(this.stars>0){/* A noise is not a magical sighting: keep the real last-seen position and timer. */}}
 setStars(value:number,position:V3):void{this.stars=Math.max(0,Math.min(5,Math.floor(value)));this.lastSeen={...position};this.unseenSeconds=this.decayClock=0;this.state=this.stars?'unseen':'lost';}
 update(dt:number,visible:boolean,position:V3):void{if(this.stars===0){this.state='lost';return;}if(visible){this.state='seen';this.lastSeen={...position};this.unseenSeconds=this.decayClock=0;return;}this.unseenSeconds+=Math.max(0,dt);this.decayClock+=Math.max(0,dt);this.state=this.unseenSeconds<3?'unseen':'searching';if(this.decayClock+1e-8>=20){this.stars--;this.decayClock-=20;this.state=this.stars?'searching':'lost';}}
 snapshot(){return{stars:this.stars,state:this.state,unseenSeconds:this.unseenSeconds,lastSeen:{...this.lastSeen},lastCrime:{...this.lastCrime},crimes:this.crimes,decayThreshold:20};}
}
