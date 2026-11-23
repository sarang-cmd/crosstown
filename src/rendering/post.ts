// Pinned Three r180 PostProcessing + TSL, shared WGSL/GLSL graph.
// One shared HDR beauty/grade. Each optional prepass is only 1/16 pixel count;
// OFF means no branch, target, draw, samples or effect-specific uniform updates.
import {PostProcessing,RenderTarget,DepthTexture,HalfFloatType,UnsignedIntType,MeshBasicNodeMaterial,QuadMesh,Vector2,Vector3,Quaternion,Matrix4,NoToneMapping,LinearSRGBColorSpace,type WebGPURenderer,type Scene,type Camera} from 'three/webgpu';
import {Fn,If,texture,uniform,uv,vec2,vec3,vec4,float,mix,max,min,abs,pow,exp,sin,cos,smoothstep,normalize,dot,cross,dFdx,dFdy,reflect,getViewPosition,getScreenPosition,saturation,luminance,fract} from 'three/tsl';
import type {EffectFlags} from '../config/quality';
import type {CityEnvironment} from '../world/city/environment';
import {POST_EFFECTS} from './effects-policy';
type Prepass='bloom'|'sunShafts'|'wetReflections';
interface Layer{target:RenderTarget;quad:QuadMesh}
const SHAFT_STEPS=24,REFLECTION_STEPS=12;
const REFLECTION_DISTANCES=[1,2,3.5,5,7,10,14,20,28,40,56,78];
export class CityPost {
 private beauty?:RenderTarget;private processing?:PostProcessing;private layers=new Map<Prepass,Layer>();
 private inverseProjection=uniform(new Matrix4());private cameraWorld=uniform(new Matrix4());private projection=uniform(new Matrix4());private previousVP=uniform(new Matrix4());private eye=uniform(new Vector3());
 private clock=uniform(0);private night=uniform(0);private wet=uniform(0);private fogDensity=uniform(.006);private groundY=uniform(0);private shutter=uniform(.4);
 private sunUV=uniform(new Vector2(.5,.2));private sunVisible=uniform(0);private sunDirection=uniform(new Vector3(1,.3,-.5));private pixel=uniform(new Vector2(1/1920,1/1080));
 private previousMatrix=new Matrix4();private matrix=new Matrix4();private lastEye=new Vector3();private lastRotation=new Quaternion();private sunPoint=new Vector3();private lastCamera?:Camera;
 private size=new Vector2();private width=1;private height=1;private key='';private flags?:EffectFlags;private frames=0;private rebuilds=0;private disposedTargets=0;private effectFrames:Partial<Record<keyof EffectFlags,number>>={};
 // Explicit diagnostic bypass only, never an automatic-quality trick.
 bypass=false;
 constructor(readonly renderer:WebGPURenderer){}
 private layer(name:Prepass,fragment:MeshBasicNodeMaterial['fragmentNode']):Layer {
  const target=new RenderTarget(1,1,{type:HalfFloatType,depthBuffer:false});target.texture.name=`City quarter-resolution ${name}`;target.texture.generateMipmaps=false;
  const material=new MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false});material.fragmentNode=fragment;
  const layer={target,quad:new QuadMesh(material)};this.layers.set(name,layer);return layer;
 }
 private release():void {
  if(this.beauty){this.beauty.dispose();this.disposedTargets++;}this.beauty=undefined;
  for(const {target,quad}of this.layers.values()){target.dispose();this.disposedTargets++;for(const m of Array.isArray(quad.material)?quad.material:[quad.material])m.dispose();}this.layers.clear();
  this.processing?.dispose();this.processing=undefined;this.lastCamera=undefined;
 }
 configure(flags:EffectFlags):void {
  const key=POST_EFFECTS.map(k=>Number(flags[k])).join('')+':'+Number(this.bypass);if(this.key===key)return;this.release();this.key=key;this.flags={...flags};this.rebuilds++;
  if(this.bypass)return;
  const sampledDepth=flags.volumetricFog||flags.motionBlur||flags.wetReflections||flags.heatHaze||flags.sunShafts||flags.lensFlare;
  this.beauty=new RenderTarget(1,1,{type:HalfFloatType,depthBuffer:true,...(sampledDepth?{depthTexture:new DepthTexture(1,1,UnsignedIntType)}:{})});this.beauty.texture.name='City HDR beauty';this.beauty.texture.generateMipmaps=false;
  const scene=texture(this.beauty.texture),depth=this.beauty.depthTexture?texture(this.beauty.depthTexture):undefined;
  const glow=flags.bloom?texture(this.layer('bloom',Fn(()=>{
   const sum=vec3(0).toVar();
   for(const[x,y]of [[0,0],[-2,-2],[2,-2],[-2,2],[2,2],[-4,0],[4,0],[0,-4],[0,4]]){
    const c=scene.sample(uv().add(this.pixel.mul(vec2(x,y)))).rgb;sum.addAssign(c.mul(smoothstep(.85,1.8,luminance(c))));
   }return vec4(sum.div(9),1);
  })()).target.texture):undefined;
  const shafts=flags.sunShafts?texture(this.layer('sunShafts',Fn(()=>{
   // Jittered quarter-resolution radial occlusion, then a five-tap composite.
   // Removes the objectionable eight-step silhouette copies of the first build.
   const u=uv(),sum=float(0).toVar(),noise=fract(sin(dot(u.div(this.pixel.mul(4)).floor(),vec2(12.9898,78.233))).mul(43758.5453));
   for(let i=0;i<SHAFT_STEPS;i++){const t=float(i).add(noise).div(SHAFT_STEPS),at=mix(u,this.sunUV,t.mul(.78));sum.addAssign(smoothstep(.9995,.99999,depth!.sample(at.clamp(.001,.999)).r).mul(t.mul(-.75).add(1)));}
   const falloff=exp(u.sub(this.sunUV).length().mul(-3));return vec4(vec3(sum.div(SHAFT_STEPS).mul(falloff).mul(this.sunVisible)),1);
  })()).target.texture):undefined;
  const wetSurface=flags.wetReflections?texture(this.layer('wetReflections',Fn(()=>{
   const u=uv(),d=depth!.sample(u).r,view=getViewPosition(u,d,this.inverseProjection),normal=normalize(cross(dFdx(view),dFdy(view))),up=this.cameraWorld.mul(vec4(normal,0)).y.abs();
   const base=scene.sample(u).rgb,mask=smoothstep(.82,.98,up).mul(smoothstep(.85,.22,luminance(base))).mul(this.wet).mul(d.lessThan(.9999));
   const reflected=vec3(0).toVar(),weight=float(0).toVar(),confidence=float(0).toVar();
   If(mask.greaterThan(.002),()=>{
    const direction=reflect(normalize(view),normal);
    // Soft hit confidence avoids binary missing-stripe reflections. Rough wet
    // surfaces are intentionally filtered, not perfect mirror copies.
    for(const distance of REFLECTION_DISTANCES){
     const ray=view.add(direction.mul(distance)),at=getScreenPosition(ray,this.projection),sampleDepth=depth!.sample(at.clamp(.001,.999)).r,hit=getViewPosition(at,sampleDepth,this.inverseProjection);
     const valid=at.x.greaterThan(.002).and(at.x.lessThan(.998)).and(at.y.greaterThan(.002)).and(at.y.lessThan(.998)).and(sampleDepth.lessThan(.9999)).and(ray.z.lessThan(-.1));
     const closeness=smoothstep(.3+distance*.085,.05,abs(hit.z.sub(ray.z))).mul(valid);
     If(closeness.greaterThan(.01),()=>{reflected.addAssign(scene.sample(at.clamp(.001,.999)).rgb.mul(closeness));weight.addAssign(closeness);confidence.assign(max(confidence,closeness));});
    }
    reflected.divAssign(max(.001,weight));
   });
   const fresnel=pow(dot(normalize(view).negate(),normal).abs().oneMinus(),3).mul(.32).add(.10),alpha=mask.mul(confidence).mul(fresnel);
   return vec4(reflected.mul(alpha),alpha);
  })()).target.texture):undefined;
  const output=Fn(()=>{
   const u=uv().toVar(),needsWorld=flags.volumetricFog||flags.motionBlur||flags.heatHaze||flags.wetReflections;
   const rawDepth=needsWorld?depth!.sample(u).r.toVar():float(1);
   const view=needsWorld?getViewPosition(u,rawDepth,this.inverseProjection).toVar():vec3(0);
   const world=flags.volumetricFog||flags.motionBlur||flags.heatHaze?this.cameraWorld.mul(vec4(view,1)).xyz.toVar():vec3(0);
   if(flags.heatHaze){const distance=view.length(),height=world.y.sub(this.groundY).abs(),mask=smoothstep(12,60,distance).mul(smoothstep(9,1,height)).mul(rawDepth.lessThan(.9999));
    u.addAssign(vec2(sin(u.y.mul(210).add(this.clock.mul(4))).mul(cos(u.x.mul(90).sub(this.clock.mul(2)))),sin(u.x.mul(170).add(this.clock.mul(3))).mul(.35)).mul(this.pixel.mul(vec2(2.5,1.4))).mul(mask));}
   const result=scene.sample(u).rgb.toVar();
   if(flags.motionBlur){
    const previous=this.previousVP.mul(vec4(world,1)),previousUV=vec2(previous.x,previous.y.negate()).div(max(.001,previous.w)).mul(.5).add(.5);
    const motion=u.sub(previousUV).mul(this.shutter).clamp(this.pixel.mul(-12),this.pixel.mul(12));
    for(const t of[-.4,-.2,.2,.4])result.addAssign(scene.sample(u.add(motion.mul(t)).clamp(.001,.999)).rgb);result.divAssign(5);
   }
   if(wetSurface){
    const reflection=vec4(0).toVar();for(const[x,y]of [[0,0],[-3,0],[3,0],[0,-3],[0,3]])reflection.addAssign(wetSurface.sample(u.add(this.pixel.mul(vec2(x,y)))));reflection.divAssign(5);
    // Full-resolution normal rejection prevents reflected color bleeding from
    // the quarter target onto cars, facades, sky or silhouettes.
    const normal=normalize(cross(dFdx(view),dFdy(view))),horizontal=smoothstep(.8,.98,this.cameraWorld.mul(vec4(normal,0)).y.abs()).mul(rawDepth.lessThan(.9999));
    result.assign(result.mul(reflection.a.mul(horizontal).oneMinus()).add(reflection.rgb.mul(horizontal)));
   }
   if(flags.volumetricFog){
    const ray=normalize(world.sub(this.eye)),length=min(220,view.length()),density=float(0).toVar();
    for(let i=0;i<8;i++){const p=this.eye.add(ray.mul(length.mul((i+.5)/8)));density.addAssign(exp(max(0,p.y.sub(this.groundY)).mul(-.065)));}
    const alpha=exp(density.mul(length).mul(this.fogDensity).div(-8)).oneMinus().clamp(0,.48),phase=pow(max(0,dot(ray,this.sunDirection)),10);
    result.assign(mix(result,mix(vec3(.65,.79,.79),vec3(.16,.28,.48),this.night).add(vec3(.30,.17,.06).mul(phase)),alpha));
   }
   if(shafts){const light=float(0).toVar();for(const[x,y]of [[0,0],[-4,-4],[4,-4],[-4,4],[4,4]])light.addAssign(shafts.sample(u.add(this.pixel.mul(vec2(x,y)))).r);result.addAssign(vec3(1,.68,.32).mul(light.div(5)).mul(.12));}
   if(glow){const bloom=vec3(0).toVar();for(const[x,y]of [[0,0],[-8,0],[8,0],[0,-8],[0,8]])bloom.addAssign(glow.sample(u.add(this.pixel.mul(vec2(x,y)))).rgb);result.addAssign(bloom.mul(.27/5));}
   if(flags.lensFlare){const at=u.sub(this.sunUV),aspect=this.pixel.y.div(this.pixel.x),r=vec2(at.x.mul(aspect),at.y).length(),occlusion=smoothstep(.9995,.99999,depth!.sample(this.sunUV.clamp(.001,.999)).r),core=exp(r.mul(-70)),streak=exp(abs(at.y).mul(-700)).mul(exp(abs(at.x).mul(-13))),ghost=u.sub(vec2(.5).sub(this.sunUV.sub(.5).mul(.6))).length();
    const rings=exp(abs(ghost.sub(.09)).mul(-240)).mul(.035);result.addAssign(vec3(1,.66,.31).mul(core.mul(.35).add(streak.mul(.08)).add(rings)).mul(occlusion).mul(this.sunVisible));}
   // One output transform only. A mild toe lift keeps night roads legible;
   // restrained saturation preserves sunny colors and colored night emission.
   const lift=mix(vec3(.002,.003,.004),vec3(.006,.009,.015),this.night);
   const graded=saturation(max(result.add(lift),vec3(0)),mix(1.12,1.22,this.night)).mul(mix(vec3(1.035,1.02,.98),vec3(.98,1.025,1.10),this.night));
   return vec4(graded,1);
  })();
  this.processing=new PostProcessing(this.renderer,output);this.resize(this.width,this.height);
 }
 resize(width:number,height:number):void {
  this.width=Math.max(1,Math.floor(width));this.height=Math.max(1,Math.floor(height));this.beauty?.setSize(this.width,this.height);
  for(const {target}of this.layers.values())target.setSize(Math.max(1,Math.ceil(this.width/4)),Math.max(1,Math.ceil(this.height/4)));this.pixel.value.set(1/this.width,1/this.height);
 }
 render(scene:Scene,camera:Camera,environment:CityEnvironment,dt:number,anchorY:number):void {
  if(this.bypass||!this.processing||!this.beauty){this.renderer.render(scene,camera);return;}
  this.renderer.getDrawingBufferSize(this.size);if(this.width!==this.size.x||this.height!==this.size.y)this.resize(this.size.x,this.size.y);
  if(camera.coordinateSystem!==this.renderer.coordinateSystem){camera.coordinateSystem=this.renderer.coordinateSystem;const projectionCamera=camera as Camera&{updateProjectionMatrix?:()=>void};projectionCamera.updateProjectionMatrix?.();}
  const f=this.flags!;for(const key of POST_EFFECTS)if(f[key])this.effectFrames[key]=(this.effectFrames[key]??0)+1;
  const needsWorld=f.volumetricFog||f.motionBlur||f.wetReflections||f.heatHaze;
  if(needsWorld){camera.updateMatrixWorld();this.inverseProjection.value.copy(camera.projectionMatrixInverse);this.cameraWorld.value.copy(camera.matrixWorld);this.projection.value.copy(camera.projectionMatrix);this.eye.value.setFromMatrixPosition(camera.matrixWorld);}
  if(f.motionBlur){
   this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
   if(this.lastCamera!==camera||this.lastEye.distanceTo(this.eye.value)>25||Math.abs(this.lastRotation.dot(camera.quaternion))<.8)this.previousMatrix.copy(this.matrix);
   this.previousVP.value.copy(this.previousMatrix);this.shutter.value=Math.min(.45,.45*.01667/Math.max(.01667,dt));this.lastEye.copy(this.eye.value);this.lastRotation.copy(camera.quaternion);this.lastCamera=camera;
  }
  this.night.value=environment.night.value;
  if(f.heatHaze)this.clock.value=environment.elapsed;if(f.wetReflections)this.wet.value=environment.wet.value;if(f.volumetricFog||f.heatHaze)this.groundY.value=anchorY;
  if(f.volumetricFog)this.fogDensity.value=environment.weather==='fog'?.014:environment.weather==='rain'?.005:.002;
  if(f.volumetricFog||f.sunShafts||f.lensFlare)this.sunDirection.value.copy(environment.sky.sunPosition.value).normalize();
  if(f.sunShafts||f.lensFlare){
   this.eye.value.setFromMatrixPosition(camera.matrixWorld);this.sunPoint.copy(this.sunDirection.value).multiplyScalar(2000).add(this.eye.value).project(camera);
   this.sunUV.value.set(this.sunPoint.x*.5+.5,.5-this.sunPoint.y*.5);this.sunVisible.value=this.sunPoint.z<1&&this.sunDirection.value.y>0&&Math.abs(this.sunPoint.x)<1&&Math.abs(this.sunPoint.y)<1?1:0;
  }
  const target=this.renderer.getRenderTarget(),tone=this.renderer.toneMapping,space=this.renderer.outputColorSpace;
  try{
   this.renderer.toneMapping=NoToneMapping;this.renderer.outputColorSpace=LinearSRGBColorSpace;this.renderer.setRenderTarget(this.beauty);this.renderer.render(scene,camera);
   for(const layer of this.layers.values()){this.renderer.setRenderTarget(layer.target);layer.quad.render(this.renderer);}
  }finally{this.renderer.setRenderTarget(target);this.renderer.toneMapping=tone;this.renderer.outputColorSpace=space;}
  this.processing.render();if(f.motionBlur)this.previousMatrix.copy(this.matrix);this.frames++;
 }
 snapshot(){
  const layer=(name:Prepass)=>{const l=this.layers.get(name);return l?[l.target.width,l.target.height]:null;};
  return{backendIndependentTSL:true,grade:'bright coastal / neon night',effectFrames:{...this.effectFrames},sampledDepth:!!this.beauty?.depthTexture,sunUV:this.sunUV.value.toArray(),sunVisible:this.sunVisible.value,
   active:POST_EFFECTS.filter(k=>this.flags?.[k]&&!this.bypass),disabled:POST_EFFECTS.filter(k=>!this.flags?.[k]||this.bypass),targets:Number(!!this.beauty)+this.layers.size,
   glowResolution:layer('bloom'),shaftsResolution:layer('sunShafts'),reflectionResolution:layer('wetReflections'),beautyResolution:this.beauty?[this.beauty.width,this.beauty.height]:null,
   estimatedTargetBytes:this.beauty?this.width*this.height*12+[...this.layers.values()].reduce((n,l)=>n+l.target.width*l.target.height*8,0):0,auxiliaryDraws:this.bypass?0:1+this.layers.size,
   bloomPyramidLevels:0,reflectionSteps:this.layers.has('wetReflections')?REFLECTION_STEPS:0,fogSamples:this.flags?.volumetricFog&&!this.bypass?8:0,motionSamples:this.flags?.motionBlur&&!this.bypass?5:0,sunShaftSamples:this.layers.has('sunShafts')?SHAFT_STEPS:0,
   frames:this.frames,rebuilds:this.rebuilds,disposedTargets:this.disposedTargets,bypass:this.bypass,offContract:'Disabled optional effects have no graph branch, auxiliary target, texture lookup or effect-specific update. Shared beauty/grade and its depth buffer remain.'};
 }
 dispose():void{this.release();this.key='';}
}
