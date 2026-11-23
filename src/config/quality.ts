// Four laptop budgets. Heavy effects are real graph branches, not metadata.
export type QualityId = 0 | 1 | 2 | 3;
export type QualityMode = 'auto' | QualityId;
export const HEAVY_EFFECT_ORDER = ['volumetricFog', 'motionBlur', 'wetReflections', 'bloom'] as const;
export type HeavyEffect = typeof HEAVY_EFFECT_ORDER[number];
export interface EffectFlags {
  volumetricFog: boolean; motionBlur: boolean; wetReflections: boolean; bloom: boolean; mirrors: boolean;
  sunShafts: boolean; heatHaze: boolean; lightCones: boolean; tireSmoke: boolean; skidMarks: boolean;
  sparks: boolean; rainSplashes: boolean; lensFlare: boolean; neonSigns:boolean;streetLamps:boolean;litWindows:boolean;
}
export interface QualityTier {
  name: string; resolutionScale: number; maxDpr: number; shadows: boolean; shadowMapSize: number;
  viewDistance: number; trafficDensity: number; pedestrianDensity: number; effects: EffectFlags;
}
const basic: EffectFlags = {volumetricFog:false,motionBlur:false,wetReflections:false,bloom:false,mirrors:false,sunShafts:false,heatHaze:false,lightCones:true,tireSmoke:false,skidMarks:true,sparks:true,rainSplashes:true,lensFlare:false,neonSigns:true,streetLamps:true,litWindows:true};
export const QUALITY_TIERS: readonly QualityTier[] = [
  {name:'Low',resolutionScale:.7,maxDpr:1,shadows:false,shadowMapSize:512,viewDistance:140,trafficDensity:.3,pedestrianDensity:.25,effects:{...basic}},
  {name:'Balanced',resolutionScale:.85,maxDpr:1,shadows:true,shadowMapSize:512,viewDistance:220,trafficDensity:.6,pedestrianDensity:.5,effects:{...basic,bloom:true,tireSmoke:true,lensFlare:true}},
  {name:'High',resolutionScale:1,maxDpr:1,shadows:true,shadowMapSize:1024,viewDistance:350,trafficDensity:1,pedestrianDensity:1,effects:{...basic,bloom:true,wetReflections:true,mirrors:true,sunShafts:true,heatHaze:true,tireSmoke:true,lensFlare:true}},
  {name:'Ultra',resolutionScale:1,maxDpr:1,shadows:true,shadowMapSize:1536,viewDistance:500,trafficDensity:1.3,pedestrianDensity:1.25,effects:{...basic,bloom:true,wetReflections:true,motionBlur:true,volumetricFog:true,mirrors:true,sunShafts:true,heatHaze:true,tireSmoke:true,lensFlare:true}},
];
export function isQualityMode(value: unknown): value is QualityMode {return value === 'auto'||value===0||value===1||value===2||value===3;}
