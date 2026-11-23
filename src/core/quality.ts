// Real display cadence + hysteresis. Heavy graph branches go first, in this order:
// volume -> blur -> wet SSR -> bloom; only then resolution/shadows/LOD/population.
import {HEAVY_EFFECT_ORDER,QUALITY_TIERS,type QualityId,type QualityMode,type QualityTier,type HeavyEffect} from '../config/quality';
export class QualityScaler {
  tier: QualityId = 2; mode: QualityMode = 'auto'; fps=0; frameMs=16.67;
  history:number[]=Array(44).fill(16.67);
  readonly transitions:{at:number;action:string;frameMs:number;tier:QualityId}[]=[];
  private cuts=new Set<HeavyEffect>();private elapsed=0;private windowTime=0;private frames=0;
  private slowTime=0;private fastTime=0;private lastChange=0;private cached?:QualityTier;private cacheKey='';
  onChange?:(tier:QualityTier,id:QualityId)=>void;
  get current():QualityTier {
    const key=this.tier+':'+[...this.cuts].join(',');
    if(!this.cached||key!==this.cacheKey){const base=QUALITY_TIERS[this.tier]!;this.cached={...base,effects:{...base.effects}};for(const e of this.cuts)this.cached.effects[e]=false;
      // Sun shafts share the volumetric budget; no hidden shaft pass survives its cut.
      if(this.cuts.has('volumetricFog'))this.cached.effects.sunShafts=false;
      this.cacheKey=key;}
    return this.cached;
  }
  setMode(mode:QualityMode):void {this.mode=mode;this.cuts.clear();this.slowTime=this.fastTime=0;this.lastChange=this.elapsed;if(mode!=='auto')this.tier=mode;this.changed('selection');}
  private changed(action:string):void {this.cached=undefined;this.lastChange=this.elapsed;this.slowTime=this.fastTime=0;this.transitions.push({at:this.elapsed,action,frameMs:this.frameMs,tier:this.tier});if(this.transitions.length>48)this.transitions.shift();this.onChange?.(this.current,this.tier);}
  private lower():void {const next=HEAVY_EFFECT_ORDER.find(e=>this.current.effects[e]||(e==='volumetricFog'&&this.current.effects.sunShafts));if(next){this.cuts.add(next);this.changed('off:'+next);}else if(this.current.effects.sunShafts){this.cuts.add('volumetricFog');this.changed('off:volumetricFog');}else if(this.tier>0){this.tier=(this.tier-1)as QualityId;this.changed('tier:down');}}
  private raise():void {const next=[...HEAVY_EFFECT_ORDER].reverse().find(e=>this.cuts.has(e)&&(QUALITY_TIERS[this.tier]!.effects[e]||(e==='volumetricFog'&&QUALITY_TIERS[this.tier]!.effects.sunShafts)));if(next){this.cuts.delete(next);this.changed('on:'+next);}else if(this.tier<3){this.tier=(this.tier+1)as QualityId;this.changed('tier:up');}}
  sample(seconds:number):boolean {
    if(!Number.isFinite(seconds)||seconds<=0||seconds>30)return false;
    this.elapsed+=Math.min(3,seconds);this.windowTime+=seconds;this.frames++;
    if(this.windowTime<.5)return false;
    this.frameMs=this.windowTime*1000/this.frames;this.fps=Math.round(this.frames/this.windowTime);
    this.history.push(Math.min(80,this.frameMs));this.history.shift();const window=Math.min(3,this.windowTime);this.windowTime=this.frames=0;
    if(this.mode!=='auto'||this.elapsed<8||this.elapsed-this.lastChange<3)return true;
    this.slowTime=this.frameMs>19.5?this.slowTime+window:0;
    this.fastTime=this.frameMs<17?this.fastTime+window:0;
    if(this.slowTime>=2)this.lower();else if(this.fastTime>=12)this.raise();return true;
  }
  snapshot(){return{mode:this.mode,tier:this.tier,name:this.current.name,frameMs:this.frameMs,fps:this.fps,disabledHeavy:[...this.cuts],effects:{...this.current.effects},transitions:this.transitions.map(t=>({...t})),targetMs:1000/60};}
  resetMonitor():void{this.windowTime=this.frames=this.slowTime=this.fastTime=0;}
}
