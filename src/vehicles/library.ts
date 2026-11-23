import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Mesh, Texture, type Object3D, type Material } from 'three/webgpu';
import { ROSTER } from './cars';
// Sources are immutable. Live cars clone owned resources; traffic bakes immutable copies.
export class CarLibrary {
  readonly models = new Map<string,Object3D>(); readonly failures:string[]=[];
  async load():Promise<void>{const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);await Promise.all(ROSTER.map(async c=>{try{const gltf=await loader.loadAsync(c.model);gltf.scene.name=`${c.id} immutable glTF source`;this.models.set(c.id,gltf.scene);}catch{this.failures.push(c.id);console.warn(`Using designed code-built ${c.class} fallback for ${c.name}.`);}}));}
  get(id:string):Object3D|undefined{return this.models.get(id);}
  dispose():void{const seen=new Set<unknown>();for(const root of this.models.values())root.traverse(o=>{if(o instanceof Mesh){if(!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const m of (Array.isArray(o.material)?o.material:[o.material]) as Material[]){if(!seen.has(m)){seen.add(m);for(const value of Object.values(m))if(value instanceof Texture&&!seen.has(value)){seen.add(value);value.dispose();}m.dispose();}}}});this.models.clear();}
}
