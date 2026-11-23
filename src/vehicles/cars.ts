// Fictional 12-vehicle roster. SI units; every selection has its own model, drivetrain, paint and recorded/synth mix.
export type CarClass = 'compact' | 'sedan' | 'muscle' | 'supercar' | 'suv' | 'motorbike';
export type EngineType = 'i4' | 'v6' | 'v8' | 'flat6' | 'diesel' | 'single' | 'twin' | 'v10';
export type Surface = 'asphalt' | 'gravel' | 'grass' | 'concrete';
export interface CarDefinition {
  id: string; name: string; class: CarClass; model: string;
  mass: number; halfWidth: number; halfLength: number; wheelbase: number; track: number; wheelRadius: number;
  engine: EngineType; idleRpm: number; redline: number; stallRpm: number; torque: readonly (readonly [number, number])[];
  ratios: readonly number[]; reverseRatio: number; finalDrive: number; efficiency: number; drive: 'fwd' | 'rwd' | 'awd';
  topSpeed: number; brakeForce: number; handbrakeForce: number; engineBrakeTorque: number; differentialBias: number;
  suspension: { rest: number; travel: number; stiffness: number; compression: number; rebound: number; maxForce: number };
  tires: { grip: number; peakAngle: number; slidingGrip: number; sideStiffness: number; handbrakeGrip: number };
  steering: { lowLock: number; highLock: number; response: number; ratio: number; assist: number; countersteer: number };
  aero: { drag: number; rolling: number; downforce: number };
  soundProfile: string;
  paints: readonly string[]; height: number;
  sound: { pitch: number; brightness: number; roughness: number };
}
export const HARBOR: CarDefinition = {
  id: 'harbor', name: 'Harbor Six', class: 'sedan', model: '/models/harbor-roster.glb',
  mass: 1320, halfWidth: 0.92, halfLength: 2.08, wheelbase: 2.67, track: 1.72, wheelRadius: 0.34,
  engine: 'v6', idleRpm: 820, redline: 6600, stallRpm: 390,
  torque: [[0, 70], [820, 125], [1600, 178], [3000, 221], [4300, 236], [5400, 210], [6600, 150]],
  ratios: [0, 3.55, 2.18, 1.49, 1.12, 0.87, 0.71], reverseRatio: 3.3, finalDrive: 3.64, efficiency: 0.88, drive: 'rwd',
  topSpeed: 54, brakeForce: 18000, handbrakeForce: 9500, engineBrakeTorque: 36, differentialBias: 0.45,
  suspension: { rest: 0.36, travel: 0.22, stiffness: 28, compression: 3.2, rebound: 4.6, maxForce: 12500 },
  tires: { grip: 3.3, peakAngle: 0.13, slidingGrip: 0.65, sideStiffness: 1.0, handbrakeGrip: 0.30 },
  steering: { lowLock: 0.53, highLock: 0.14, response: 7, ratio: (Math.PI * 2.5) / 0.53, assist: 0.8, countersteer: 0.32 },
  aero: { drag: 0.43, rolling: 0.012, downforce: 0.12 }, soundProfile: 'harbor',
  paints: ['#628a7b', '#d9d4be', '#386d83', '#9d554d'], height: 1.43, sound: { pitch: 1, brightness: 1, roughness: 1 },
};
// Deep-copy nested tuning so changes to one model never mutate a sibling's setup.
function car(id: string, name: string, kind: CarClass, overrides: Partial<CarDefinition>): CarDefinition {
  const base: CarDefinition = { ...HARBOR, id, name, class: kind, model: `/models/${id}.glb`, soundProfile: id,
    suspension: { ...HARBOR.suspension }, tires: { ...HARBOR.tires }, steering: { ...HARBOR.steering }, aero: { ...HARBOR.aero }, ...overrides };
  return base;
}
const curve = (idle: number, peak: number, red: number): CarDefinition['torque'] => [[0,peak*.20],[idle,peak*.49],[red*.28,peak*.77],[red*.57,peak],[red*.79,peak*.91],[red,peak*.63]];
const rack = (lock: number, high: number, response: number, assist = .8): CarDefinition['steering'] => ({ lowLock:lock, highLock:high, response, ratio:Math.PI*2.5/lock, assist, countersteer:.32 });
export const ROSTER: readonly CarDefinition[] = [
  car('pip','Pip 140','compact',{ mass:920,halfWidth:.79,halfLength:1.80,height:1.39,wheelbase:2.25,track:1.42,wheelRadius:.29,engine:'i4',idleRpm:900,redline:6800,torque:curve(900,142,6800),ratios:[0,3.73,2.15,1.47,1.04,.80],finalDrive:4.05,drive:'fwd',topSpeed:43,brakeForce:13900,handbrakeForce:7100,engineBrakeTorque:28,steering:rack(.61,.16,9),aero:{drag:.40,rolling:.012,downforce:.03},paints:['#e2ac58','#9fbe9b','#d9e3cf','#c76f5d'],sound:{pitch:1.10,brightness:1.2,roughness:.85} }),
  car('milo','Milo Club','compact',{ mass:1080,halfWidth:.84,halfLength:1.925,height:1.67,wheelbase:2.43,track:1.50,wheelRadius:.30,engine:'i4',idleRpm:790,redline:6100,torque:curve(790,167,6100),ratios:[0,3.40,1.98,1.31,.97,.75],finalDrive:3.86,drive:'fwd',topSpeed:40,brakeForce:14500,suspension:{rest:.39,travel:.25,stiffness:25,compression:3.2,rebound:4.4,maxForce:11000},steering:rack(.56,.14,6.5),aero:{drag:.61,rolling:.014,downforce:0},paints:['#8eacc1','#e3d8bb','#dc9a78','#94b397'],sound:{pitch:.92,brightness:.88,roughness:1.15} }),
  HARBOR,
  car('meridian','Meridian GT','sedan',{mass:1530,halfWidth:.96,halfLength:2.325,height:1.43,wheelbase:2.83,track:1.78,wheelRadius:.35,torque:curve(780,305,7100),idleRpm:780,redline:7100,ratios:[0,3.84,2.45,1.65,1.25,1,.82,.68],finalDrive:3.45,drive:'awd',topSpeed:61,brakeForce:22200,steering:rack(.50,.13,8),tires:{...HARBOR.tires,grip:3.7,slidingGrip:.72},paints:['#416f87','#c8cebf','#563e49','#b1b69b'],sound:{pitch:1.12,brightness:1.18,roughness:.8}}),
  car('brim','Brim Eight','muscle',{mass:1680,halfWidth:1.01,halfLength:2.45,height:1.37,wheelbase:2.94,track:1.86,wheelRadius:.36,engine:'v8',idleRpm:680,redline:5600,torque:curve(680,470,5600),ratios:[0,2.87,1.91,1.33,1,.72],finalDrive:3.23,drive:'rwd',topSpeed:58,brakeForce:20600,handbrakeForce:13500,engineBrakeTorque:61,tires:{grip:3.05,peakAngle:.15,slidingGrip:.60,sideStiffness:.95,handbrakeGrip:.26},steering:rack(.49,.12,5.8,.55),aero:{drag:.55,rolling:.014,downforce:.04},paints:['#b8744e','#423e45','#e6c987','#506d56'],sound:{pitch:.80,brightness:.78,roughness:1.3}}),
  car('cinder','Cinder R/T','muscle',{mass:1490,halfWidth:.98,halfLength:2.475,height:1.32,wheelbase:2.81,track:1.82,wheelRadius:.35,engine:'v8',idleRpm:800,redline:6400,torque:curve(800,435,6400),ratios:[0,3.10,2.05,1.47,1.12,.89,.70],finalDrive:3.55,topSpeed:65,brakeForce:24300,handbrakeForce:12500,suspension:{rest:.30,travel:.19,stiffness:37,compression:4,rebound:5.5,maxForce:14500},tires:{grip:3.45,peakAngle:.14,slidingGrip:.62,sideStiffness:1.1,handbrakeGrip:.24},steering:rack(.51,.12,7),paints:['#a44739','#d3b95d','#3b514c','#ded5bd'],sound:{pitch:1.12,brightness:1.35,roughness:1.1}}),
  car('aerox','Aerox S6','supercar',{mass:1210,halfWidth:.98,halfLength:2.25,height:1.13,wheelbase:2.65,track:1.82,wheelRadius:.33,engine:'flat6',idleRpm:1050,redline:8600,torque:curve(1050,385,8600),ratios:[0,3.56,2.33,1.68,1.30,1.05,.85,.70],finalDrive:3.75,drive:'rwd',topSpeed:78,brakeForce:28700,handbrakeForce:9900,suspension:{rest:.26,travel:.16,stiffness:41,compression:4.1,rebound:5.8,maxForce:15000},tires:{grip:4.05,peakAngle:.12,slidingGrip:.75,sideStiffness:1.18,handbrakeGrip:.32},steering:rack(.47,.11,10),aero:{drag:.34,rolling:.010,downforce:2.7},paints:['#bed27d','#f2d2a5','#4c91a3','#cc7353'],sound:{pitch:1.05,brightness:1.1,roughness:.75}}),
  car('zenith','Zenith V10','supercar',{mass:1420,halfWidth:1.02,halfLength:2.30,height:1.10,wheelbase:2.74,track:1.88,wheelRadius:.35,engine:'v10',idleRpm:1100,redline:9300,torque:curve(1100,560,9300),ratios:[0,3.12,2.18,1.61,1.29,1.06,.86,.72],finalDrive:3.48,drive:'awd',topSpeed:91,brakeForce:33700,handbrakeForce:10600,suspension:{rest:.25,travel:.15,stiffness:45,compression:4.4,rebound:6.1,maxForce:17000},tires:{grip:4.30,peakAngle:.11,slidingGrip:.78,sideStiffness:1.25,handbrakeGrip:.35},steering:rack(.45,.10,11),aero:{drag:.32,rolling:.010,downforce:3.6},paints:['#d9ce93','#703d64','#49918e','#ddddd1'],sound:{pitch:1.18,brightness:1.45,roughness:.7}}),
  car('mesa','Mesa D4','suv',{mass:2240,halfWidth:1.02,halfLength:2.45,height:1.94,wheelbase:2.89,track:1.85,wheelRadius:.41,engine:'diesel',idleRpm:720,redline:4300,torque:curve(720,540,4300),ratios:[0,4.17,2.34,1.52,1.14,.87,.69],finalDrive:3.91,drive:'awd',topSpeed:46,brakeForce:27500,handbrakeForce:15100,engineBrakeTorque:72,suspension:{rest:.46,travel:.34,stiffness:24,compression:3.0,rebound:4.2,maxForce:19000},tires:{grip:3.35,peakAngle:.16,slidingGrip:.75,sideStiffness:.95,handbrakeGrip:.4},steering:rack(.55,.12,5.2),aero:{drag:.79,rolling:.019,downforce:0},paints:['#94946d','#ad815b','#607f79','#d8cbb0'],sound:{pitch:.85,brightness:.8,roughness:1.3}}),
  car('summit','Summit L8','suv',{mass:2580,halfWidth:1.08,halfLength:2.575,height:1.98,wheelbase:3.13,track:1.97,wheelRadius:.42,engine:'diesel',idleRpm:810,redline:4800,torque:curve(810,680,4800),ratios:[0,4.55,2.77,1.92,1.43,1.12,.90,.72,.60],finalDrive:3.21,drive:'awd',topSpeed:54,brakeForce:32600,handbrakeForce:17800,engineBrakeTorque:83,suspension:{rest:.43,travel:.30,stiffness:29,compression:3.4,rebound:4.8,maxForce:22000},tires:{grip:3.60,peakAngle:.15,slidingGrip:.72,sideStiffness:1.08,handbrakeGrip:.38},steering:rack(.49,.11,5.8),aero:{drag:.75,rolling:.017,downforce:.1},paints:['#314c50','#bbbaaa','#694c46','#dfd3ac'],sound:{pitch:1.08,brightness:1.08,roughness:1.12}}),
  car('wren','Wren Single','motorbike',{mass:215,halfWidth:.34,halfLength:1.08,height:1.12,wheelbase:1.43,track:0,wheelRadius:.31,engine:'single',idleRpm:1380,redline:8200,stallRpm:650,torque:curve(1380,34,8200),ratios:[0,2.85,1.92,1.43,1.12,.91],finalDrive:4.05,drive:'rwd',topSpeed:45,brakeForce:4200,handbrakeForce:2100,engineBrakeTorque:11,suspension:{rest:.27,travel:.18,stiffness:33,compression:3.5,rebound:4.8,maxForce:6500},tires:{grip:3.8,peakAngle:.14,slidingGrip:.72,sideStiffness:1.1,handbrakeGrip:.42},steering:rack(.53,.12,8),aero:{drag:.23,rolling:.011,downforce:0},paints:['#648c78','#d6b76e','#cc805f','#e2e0ca'],sound:{pitch:1.03,brightness:1.1,roughness:1.3}}),
  car('kestrel','Kestrel Twin','motorbike',{mass:242,halfWidth:.37,halfLength:1.13,height:1.17,wheelbase:1.49,track:0,wheelRadius:.32,engine:'twin',idleRpm:1180,redline:10500,stallRpm:590,torque:curve(1180,86,10500),ratios:[0,2.67,2.03,1.62,1.35,1.15,1.02],finalDrive:3.74,drive:'rwd',topSpeed:69,brakeForce:5500,handbrakeForce:2600,engineBrakeTorque:16,suspension:{rest:.25,travel:.17,stiffness:39,compression:3.9,rebound:5.2,maxForce:7800},tires:{grip:4.15,peakAngle:.12,slidingGrip:.75,sideStiffness:1.2,handbrakeGrip:.4},steering:rack(.48,.10,10),aero:{drag:.21,rolling:.011,downforce:.13},paints:['#b96048','#374e59','#c2d584','#c4beb0'],sound:{pitch:1.25,brightness:1.3,roughness:1.05}}),
];
export const CARS: Readonly<Record<string, CarDefinition>> = Object.fromEntries(ROSTER.map(c => [c.id,c]));
export const CABINS: readonly { id: CarClass; label: string; engine: EngineType; trim: string; accent: string; dashWidth: number; eye: number; cylinders: number; idle: number; redline: number }[] = [
  { id: 'compact', label: 'Compact · small & bright', engine: 'i4', trim: '#c9cfc0', accent: '#a6cfac', dashWidth: 1.65, eye: 1.2, cylinders: 4, idle: 850, redline: 6500 },
  { id: 'sedan', label: 'Sedan · Harbor Six', engine: 'v6', trim: '#263d39', accent: '#b68e59', dashWidth: 1.86, eye: 1.21, cylinders: 6, idle: 820, redline: 6600 },
  { id: 'muscle', label: 'Muscle · deep-set analog', engine: 'v8', trim: '#322d29', accent: '#c88c58', dashWidth: 1.98, eye: 1.13, cylinders: 8, idle: 730, redline: 5900 },
  { id: 'supercar', label: 'Supercar · low & focused', engine: 'flat6', trim: '#172629', accent: '#d7e798', dashWidth: 1.84, eye: 1.04, cylinders: 6, idle: 1050, redline: 8500 },
  { id: 'suv', label: 'Truck / SUV · upright', engine: 'diesel', trim: '#38423a', accent: '#d5b67b', dashWidth: 2.05, eye: 1.45, cylinders: 4, idle: 760, redline: 4500 },
  { id: 'motorbike', label: 'Motorbike · exposed instruments', engine: 'single', trim: '#243735', accent: '#dcad7e', dashWidth: 1.1, eye: 1.24, cylinders: 1, idle: 1300, redline: 9000 },
];
export function torqueAt(car: CarDefinition, rpm: number): number {
  const curve = car.torque;
  if (rpm <= curve[0]![0]) return curve[0]![1];
  for (let i = 1; i < curve.length; i++) { const a = curve[i - 1]!, b = curve[i]!; if (rpm <= b[0]) return a[1] + (b[1] - a[1]) * (rpm - a[0]) / (b[0] - a[0]); }
  return curve.at(-1)![1];
}
export const clamp = (x: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : 0));
export function steeringLock(car: CarDefinition, speed: number): number { return car.steering.lowLock + (car.steering.highLock - car.steering.lowLock) * clamp(Math.abs(speed) / 38); }
export function tireGrip(car: CarDefinition, slipAngle: number, surface: Surface, handbrake: boolean): number {
  const surfaceGrip = { asphalt: 1, concrete: 0.95, gravel: 0.58, grass: 0.46 }[surface];
  const slide = clamp((Math.abs(slipAngle) - car.tires.peakAngle) / 0.42);
  return car.tires.grip * surfaceGrip * (1 - slide * (1 - car.tires.slidingGrip)) * (handbrake ? car.tires.handbrakeGrip : 1);
}
