// Opt-in test diagnostics. CPU submission is NOT GPU time, and these samples
// never replace native requestAnimationFrame cadence or tune the quality scaler.
export class FrameProfile {
 private start=0;private rows:Record<string,{totalMs:number;maximumMs:number;samples:number[]} >={};frames=0;
 constructor(readonly enabled:boolean){}
 begin():void{if(this.enabled)this.start=performance.now();}
 mark(name:string):void{if(!this.enabled)return;const now=performance.now(),ms=now-this.start;this.start=now;const r=this.rows[name]??={totalMs:0,maximumMs:0,samples:[]};r.totalMs+=ms;r.maximumMs=Math.max(r.maximumMs,ms);r.samples.push(ms);if(r.samples.length>180)r.samples.shift();}
 end():void{if(this.enabled)this.frames++;}
 reset():void{this.rows={};this.frames=0;this.start=performance.now();}
 snapshot(){return{enabled:this.enabled,frames:this.frames,boundary:'Instrumented main-thread CPU/submission only, not GPU timing or target-hardware performance',phases:Object.fromEntries(Object.entries(this.rows).map(([name,r])=>{const s=[...r.samples].sort((a,b)=>a-b);return[name,{meanMs:r.totalMs/Math.max(1,this.frames),maximumMs:r.maximumMs,recentP95:s[Math.floor(s.length*.95)]??0,recentSamples:s.length}];}))};}
}
