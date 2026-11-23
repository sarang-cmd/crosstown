// Original texture-free neon ribbons and warm street luminaires. All luminous
// records share at most two instanced draws per visible chunk; no point lights.
// Records are static city data. Disabled families own no render resources.
import {Group,BoxGeometry,MeshBasicNodeMaterial,Object3D,Color,type BufferGeometry} from 'three/webgpu';
import {color} from 'three/tsl';
import type {CityEnvironment} from '../world/city/environment';
import type {EffectFlags} from '../config/quality';
import {StableInstances} from './instances';
type Family='streetLamps'|'neonSigns';
interface Entry{records:Float32Array;meshes:Partial<Record<Family,StableInstances>>}
export class CityLights {
 private entries=new Map<Group,Entry>();private materials:Partial<Record<Family,MeshBasicNodeMaterial>>={};
 private active={streetLamps:true,neonSigns:true};private dummy=new Object3D();private tint=new Color();private disposed=0;
 constructor(readonly night:CityEnvironment['night'],readonly geometry:BufferGeometry=new BoxGeometry(1,1,1)){}
 register(root:Group,records:Float32Array):void{this.entries.set(root,{records,meshes:{}});for(const family of ['streetLamps','neonSigns']as const)if(this.active[family])this.install(root,family);}
 private install(root:Group,family:Family):void{const entry=this.entries.get(root)!;if(entry.meshes[family])return;const tag=family==='streetLamps'?1:2;let count=0;for(let i=0;i<entry.records.length;i+=12)if(entry.records[i+11]===tag)count++;if(!count)return;
  let material=this.materials[family];if(!material){material=new MeshBasicNodeMaterial();material.colorNode=color('#ffffff').mul(this.night.mul(family==='neonSigns'?4.5:2.8).add(family==='neonSigns'?.65:.45));material.name=family;this.materials[family]=material;}
  const mesh=new StableInstances(this.geometry,material,count);mesh.count=count;mesh.name=family==='neonSigns'?'Original emissive neon shop ribbons':'Warm dusk street lamps';let n=0;
  for(let i=0;i<entry.records.length;i+=12){const a=entry.records;if(a[i+11]!==tag)continue;this.dummy.position.set(a[i]!,a[i+1]!,a[i+2]!);this.dummy.rotation.set(0,a[i+6]!,0);this.dummy.scale.set(a[i+3]!,a[i+4]!,a[i+5]!);this.dummy.updateMatrix();mesh.setMatrixAt(n,this.dummy.matrix);mesh.setColorAt(n++,this.tint.setRGB(a[i+7]!,a[i+8]!,a[i+9]!));}
  mesh.computeBoundingSphere();mesh.updateMatrix();mesh.matrixAutoUpdate=false;entry.meshes[family]=mesh;root.add(mesh);
 }
 private remove(entry:Entry,family:Family):void{const mesh=entry.meshes[family];if(!mesh)return;mesh.removeFromParent();mesh.dispose();delete entry.meshes[family];this.disposed++;}
 configure(flags:Pick<EffectFlags,Family>):void{for(const family of ['streetLamps','neonSigns']as const){if(this.active[family]===flags[family])continue;this.active[family]=flags[family];for(const [root,entry]of this.entries){if(flags[family])this.install(root,family);else this.remove(entry,family);}if(!flags[family]){this.materials[family]?.dispose();delete this.materials[family];}}}
 forget(root:Group):void{const entry=this.entries.get(root);if(!entry)return;for(const family of ['streetLamps','neonSigns']as const)this.remove(entry,family);this.entries.delete(root);}
 snapshot(){return{...this.active,registeredChunks:this.entries.size,liveMeshes:[...this.entries.values()].reduce((n,e)=>n+Object.keys(e.meshes).length,0),materials:Object.keys(this.materials).length,textures:0,disposedMeshes:this.disposed,instances:Object.fromEntries((['streetLamps','neonSigns']as const).map(f=>[f,[...this.entries.values()].reduce((n,e)=>n+(e.meshes[f]?.count??0),0)])),staticRecordsRetainedWhenOff:true};}
 dispose():void{for(const root of [...this.entries.keys()])this.forget(root);for(const material of Object.values(this.materials))material.dispose();this.materials={};}
}
