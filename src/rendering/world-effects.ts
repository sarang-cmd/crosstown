// Bounded, pooled effects. Disabled families are actually removed/disposed, not
// zero-opacity draws. Everything is original geometry/TSL; no external assets.
import {Group,MeshBasicNodeMaterial,PlaneGeometry,CylinderGeometry,AdditiveBlending,NormalBlending,DoubleSide,Object3D,Vector3,Quaternion,Color,InstancedBufferAttribute,type Camera}from'three/webgpu';
import{uv,smoothstep,pow,positionLocal,attribute}from'three/tsl';
import{StableInstances}from'./instances';import{ParticlePool}from'./particles';
import type{RaycastCar}from'../vehicles/physics';import type{V3}from'../parkour/types';import type{EffectFlags}from'../config/quality';import type{EffectName}from'./effects-policy';
export interface EffectCar{car:RaycastCar;headlights:boolean}
interface Batch{mesh:StableInstances;material:MeshBasicNodeMaterial;pool:ParticlePool;alpha?:InstancedBufferAttribute}
const FAMILIES=['lightCones','tireSmoke','skidMarks','sparks','rainSplashes']as const;
export class WorldEffects {
 readonly root=new Group();private batches=new Map<EffectName,Batch>();private lightPools?:Batch;private flags?:EffectFlags;
 private dummy=new Object3D();private point=new Vector3();private direction=new Vector3();private up=new Vector3(0,1,0);private q=new Quaternion();private tint=new Color();
 private serial=0;private emissionClock=0;private rainClock=0;private disposed=0;private lastTracks=new Map<string,V3>();private updates:Partial<Record<EffectName,number>>={};private nearestLights:EffectCar[]=[];
 constructor(){this.root.name='Pooled light cones / tire smoke / skid marks / collision sparks / rain splashes';}
 private make(name:EffectName,capacity:number,pool=false):Batch {
  const cone=name==='lightCones'&&!pool,geometry=cone?new CylinderGeometry(0,1,1,10,1,true):new PlaneGeometry(1,1),material=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:DoubleSide,toneMapped:true,blending:name==='skidMarks'||name==='tireSmoke'?NormalBlending:AdditiveBlending});
  // Two-sided unlit alpha geometry needs one submission, not r180's default
  // transparent back/front double draw. Keep both faces with bounded overdraw.
  material.forceSinglePass=true;
  const radial=uv().sub(.5).length();
  const alpha=cone?smoothstep(0,.8,uv().y).mul(.025):name==='rainSplashes'?smoothstep(.12,.01,radial.sub(.31).abs()).mul(.55):name==='skidMarks'?smoothstep(.5,.32,uv().x.sub(.5).abs()).mul(.72):pow(smoothstep(.5,.02,radial),2).mul(name==='tireSmoke'?.35:.8);
  const opacity=name==='lightCones'?undefined:new InstancedBufferAttribute(new Float32Array(1024),1);if(opacity)geometry.setAttribute('effectOpacity',opacity);
  material.opacityNode=(cone?alpha.mul(positionLocal.y.add(.5)):alpha).mul(opacity?attribute('effectOpacity','float'):1);
  const mesh=new StableInstances(geometry,material,capacity);mesh.count=0;mesh.setColorAt(0,new Color('#ffffff'));mesh.frustumCulled=false;mesh.name=name+(pool?' · ground pools':'');mesh.renderOrder=name==='skidMarks'?1:3;this.root.add(mesh);return{mesh,material,pool:new ParticlePool(capacity),alpha:opacity};
 }
 private drop(batch:Batch):void{batch.mesh.removeFromParent();batch.mesh.dispose();batch.mesh.geometry.dispose();batch.material.dispose();batch.pool.clear();this.disposed++;}
 configure(flags:EffectFlags):void {
  this.flags=flags;
  for(const name of FAMILIES){const exists=this.batches.get(name);if(flags[name]&&!exists)this.batches.set(name,this.make(name,name==='skidMarks'?192:name==='lightCones'?24:96));else if(!flags[name]&&exists){this.drop(exists);this.batches.delete(name);if(name==='skidMarks')this.lastTracks.clear();}}
  if(flags.lightCones&&!this.lightPools)this.lightPools=this.make('lightCones',24,true);else if(!flags.lightCones&&this.lightPools){this.drop(this.lightPools);this.lightPools=undefined;}
 }
 impact(car:RaycastCar,intensity:number):void {
  const b=this.batches.get('sparks');if(!b||intensity<.12)return;
  const dent=car.damageState.dents.at(-1),offset=dent?.point??{x:0,y:.2,z:car.definition.halfLength};this.point.copy(offset).applyQuaternion(car.rotation).add(car.position);
  for(let i=0;i<Math.min(18,Math.ceil(intensity*18));i++){const t=this.serial++*2.399963,y=.5+((this.serial*37)%17)/12;b.pool.emit(this.point,{x:Math.cos(t)*(1+intensity*6),y,z:Math.sin(t)*(1+intensity*6)},.28+(i%5)*.08,.08+intensity*.12);}
 }
 update(dt:number,camera:Camera,anchor:V3,cars:readonly EffectCar[],rain:boolean,_night:number,ground:(x:number,z:number)=>number):void {
  if(!this.batches.size)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  if(this.batches.has('tireSmoke')||this.batches.has('skidMarks'))this.emissionClock+=dt;if(this.batches.has('rainSplashes'))this.rainClock+=dt;
  if(this.batches.has('lightCones'))this.lights(cars,camera.position,ground);
  const smoke=this.batches.get('tireSmoke'),skids=this.batches.get('skidMarks');
  if((smoke||skids)&&this.emissionClock>=.045){this.emissionClock=0;
   for(const{car}of cars){if(car.contacts===0||Math.abs(car.speed)<3||!(car.slip>.20||car.input.handbrake||car.input.brake>.65&&Math.abs(car.speed)>9))continue;
    const yaw=Math.atan2(2*(car.rotation.w*car.rotation.y+car.rotation.x*car.rotation.z),1-2*(car.rotation.y**2+car.rotation.x**2));
    for(let i=Math.max(0,car.wheels.length-2);i<car.wheels.length;i++){if(!car.wheels[i]!.contact)continue;const p=car.vehicle.wheelContactPoint(i);if(!p)continue;
     if(smoke&&!rain)smoke.pool.emit({x:p.x,y:p.y+.14,z:p.z},{x:Math.sin(this.serial++*3)*.15,y:.55,z:.1},1.1,.4);
     if(skids){const key=car.id+':'+i,prior=this.lastTracks.get(key);if(prior&&Math.hypot(p.x-prior.x,p.z-prior.z)<.45)continue;if(!prior&&this.lastTracks.size>=256)this.lastTracks.delete(this.lastTracks.keys().next().value!);this.lastTracks.set(key,{...p});skids.pool.emit({x:p.x,y:p.y+.025,z:p.z},{x:0,y:0,z:0},22,.23,0,yaw);}
    }
   }
  }
  const splashes=this.batches.get('rainSplashes');if(splashes&&rain&&dt>0&&this.rainClock>.035){this.rainClock=0;for(let i=0;i<6;i++){const k=this.serial++,x=anchor.x+Math.sin(k*24.7)*17,z=anchor.z+Math.cos(k*14.3)*17,y=ground(x,z)+.035;splashes.pool.emit({x,y,z},{x:0,y:.05,z:0},.28,.45);}}
  for(const[name,b]of this.batches){if(name==='lightCones')continue;this.updates[name]=(this.updates[name]??0)+Number(dt>0);b.pool.update(dt,name==='sparks'?8:0);let n=0;
   for(const p of b.pool.items){const life=p.age/p.life;this.dummy.position.copy(p.p);this.dummy.quaternion.copy(camera.quaternion);
    if(name==='skidMarks'||name==='rainSplashes'){this.dummy.rotation.set(-Math.PI/2,0,p.yaw);this.dummy.scale.set(p.size*(name==='rainSplashes'?1+life*2:1),name==='skidMarks'?.85:p.size*(1+life*2),1);}
    else this.dummy.scale.setScalar(p.size*(name==='tireSmoke'?1+life*2.5:1-life*.65));
    this.dummy.updateMatrix();b.mesh.setMatrixAt(n,this.dummy.matrix);this.tint.set(name==='tireSmoke'?'#aab5b0':name==='skidMarks'?'#070e13':name==='sparks'?'#ffc271':'#9ad5e2');this.tint.multiplyScalar(name==='sparks'?(1-life)*3:name==='skidMarks'?1:(1-life)*1.3);b.mesh.setColorAt(n,this.tint);b.alpha!.setX(n++,name==='skidMarks'?Math.min(1,(1-life)*5):Math.max(0,1-life));
   }b.mesh.count=n;b.mesh.visible=n>0;if(n){if(b.alpha)b.alpha.needsUpdate=true;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;}
  }
 }
 private lights(cars:readonly EffectCar[],eye:V3,ground:(x:number,z:number)=>number):void {
  const near=this.nearestLights;near.length=0;for(const source of cars)if(Math.hypot(source.car.position.x-eye.x,source.car.position.z-eye.z)<120)near.push(source);near.sort((a,b)=>Math.hypot(a.car.position.x-eye.x,a.car.position.z-eye.z)-Math.hypot(b.car.position.x-eye.x,b.car.position.z-eye.z));
  const cones=this.batches.get('lightCones')!,pools=this.lightPools!;let c=0,p=0;
  for(let index=0;index<Math.min(6,near.length);index++){const{car,headlights}=near[index]!;
   const brake=(car.input.brake>.1||car.input.handbrake)&&!car.damageState.rearBroken,head=headlights&&!car.damageState.frontBroken;
   for(const side of car.bike?[0]:[-1,1])for(const front of[true,false]){if(front?!head:!brake)continue;const length=front?16:2.4,width=front?2.5:1.1,sign=front?1:-1;
    this.point.set(side*car.definition.halfWidth*.7,.20,sign*(car.definition.halfLength+.06)).applyQuaternion(car.rotation).add(car.position);this.direction.set(0,-.04,sign).applyQuaternion(car.rotation).normalize();
    this.dummy.position.copy(this.point).addScaledVector(this.direction,length*.5);this.q.setFromUnitVectors(this.up,this.direction.multiplyScalar(-1));this.direction.negate();this.dummy.quaternion.copy(this.q);this.dummy.scale.set(width,length,width);this.dummy.updateMatrix();cones.mesh.setMatrixAt(c,this.dummy.matrix);cones.mesh.setColorAt(c++,this.tint.set(front?'#fff0c4':'#ff342b').multiplyScalar(front?1.5:2));
    this.dummy.position.copy(this.point).addScaledVector(this.direction,front?7:1.5);this.dummy.position.y=Math.abs(car.position.y-ground(this.dummy.position.x,this.dummy.position.z))<3?ground(this.dummy.position.x,this.dummy.position.z)+.035:car.position.y-.54;this.dummy.rotation.set(-Math.PI/2,0,Math.atan2(this.direction.x,this.direction.z));this.dummy.scale.set(front?4:1.8,front?12:2.2,1);this.dummy.updateMatrix();pools.mesh.setMatrixAt(p,this.dummy.matrix);pools.mesh.setColorAt(p++,this.tint.set(front?'#ffedbb':'#f31f25').multiplyScalar(.32));
   }
  }
  for(const[b,count]of[[cones,c],[pools,p]]as const){b.mesh.count=count;b.mesh.visible=count>0;if(count){b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;}}this.updates.lightCones=(this.updates.lightCones??0)+1;
 }
 // Explicit test fixture for a selected effect's pixels; never used for FPS or
 // gameplay acceptance, and never writes damage/rewards/physics state.
 fixture(name:EffectName,p:V3):boolean {const b=this.batches.get(name);if(!b||name==='lightCones')return false;for(let i=0;i<12;i++){const angle=i*2.399;b.pool.emit({x:p.x+Math.cos(angle)*1.8,y:p.y+.08+(name==='sparks'?.5:0),z:p.z+Math.sin(angle)*1.8},{x:name==='sparks'?Math.cos(angle)*2:0,y:name==='tireSmoke'?.5:0,z:name==='sparks'?Math.sin(angle)*2:0},name==='skidMarks'?22:2,name==='tireSmoke'?1.3:name==='rainSplashes'?.9:.2);}return true;}
 snapshot(){return{active:[...this.batches.keys()],batches:this.batches.size+Number(!!this.lightPools),disposedFamilies:this.disposed,updates:{...this.updates},families:Object.fromEntries(FAMILIES.map(name=>{const b=this.batches.get(name);return[name,{enabled:!!b,instances:b?.mesh.count??0,capacity:b?.pool.capacity??0,liveParticles:b?.pool.items.length??0,spawned:b?.pool.spawned??0,draws:b?.mesh.visible&&b.mesh.count?1:0,allocatedMatrixBytes:b?.mesh.instanceMatrix.array.byteLength??0,allocatedOpacityBytes:b?.alpha?.array.byteLength??0}];})),groundLightPools:this.lightPools?.mesh.count??0,trackedWheels:this.lastTracks.size,maximumTrackedWheels:256,offContract:'Disabled families have zero meshes/materials/particles/uploads/draws. Shared policy dispatch remains.',tierFlags:this.flags};}
 dispose():void{for(const b of this.batches.values())this.drop(b);this.batches.clear();if(this.lightPools)this.drop(this.lightPools);this.lightPools=undefined;this.root.clear();this.lastTracks.clear();}
}
