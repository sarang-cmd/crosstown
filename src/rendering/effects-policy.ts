import type {EffectFlags,QualityTier} from '../config/quality';
import type {Weather} from '../world/city/environment';
export type EffectName=keyof EffectFlags;
export const EFFECT_LABELS:Record<EffectName,string>={volumetricFog:'Volumetric fog',motionBlur:'Camera motion blur',wetReflections:'Wet surface reflections',bloom:'Bloom',mirrors:'Cockpit mirrors',sunShafts:'Sun shafts',heatHaze:'Asphalt heat haze',lightCones:'Head / brake light cones',tireSmoke:'Tire smoke',skidMarks:'Skid marks',sparks:'Collision sparks',rainSplashes:'Rain splashes',lensFlare:'Lens flare',neonSigns:'Neon shop ribbons',streetLamps:'Dusk street lamps',litWindows:'Lit dusk windows'};
export function effectPolicy(tier:QualityTier,disabled:readonly EffectName[],weather:Weather,reducedMotion:boolean,night=0):EffectFlags {
 const f={...tier.effects};for(const name of disabled)f[name]=false;
 if(night>.8){f.heatHaze=false;f.lensFlare=false;f.sunShafts=false;}
 if(reducedMotion){f.motionBlur=false;f.heatHaze=false;f.lensFlare=false;}
 if(weather==='rain')f.tireSmoke=false;
 if(weather!=='rain'){f.wetReflections=false;f.rainSplashes=false;}
 if(weather==='rain'||weather==='fog'||weather==='overcast'){f.heatHaze=false;f.lensFlare=false;f.sunShafts=false;}
 return f;
}
export const POST_EFFECTS:readonly EffectName[]=['volumetricFog','motionBlur','wetReflections','bloom','sunShafts','heatHaze','lensFlare'];
