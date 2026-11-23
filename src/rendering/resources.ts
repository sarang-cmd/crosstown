// Explicit diagnostic, never a per-frame traversal. Payload estimates, not a
// claim about driver VRAM residency, compression, overdraw or GPU execution time.
import{Mesh,Texture,InstancedMesh,type Scene,type Material,type BufferGeometry,type BufferAttribute,type InterleavedBufferAttribute}from'three/webgpu';
export function resourceAudit(scene:Scene){
 const geometries=new Set<BufferGeometry>(),textures=new Set<Texture>(),materials=new Set<Material>();let geometryPayloadBytes=0,instancePayloadBytes=0,visibleMeshes=0,transparentMeshes=0;
 const images:{name:string;width:number;height:number;estimatedRGBA8MipBytes:number}[]=[];
 scene.traverse(o=>{if(!(o instanceof Mesh))return;if(o.visible){visibleMeshes++;if((Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transparent))transparentMeshes++;}
  if(!geometries.has(o.geometry)){geometries.add(o.geometry);const arrays=new Set<ArrayBufferView>();for(const attribute of Object.values(o.geometry.attributes)as(BufferAttribute|InterleavedBufferAttribute)[]){const array='data'in attribute?attribute.data.array:attribute.array;if(!arrays.has(array)){arrays.add(array);geometryPayloadBytes+=array.byteLength;}}if(o.geometry.index)geometryPayloadBytes+=o.geometry.index.array.byteLength;}
  if(o instanceof InstancedMesh){instancePayloadBytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}
  for(const material of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(material)){materials.add(material);for(const value of Object.values(material))if(value instanceof Texture&&!textures.has(value)){textures.add(value);const image=value.image as{width?:number;height?:number}|undefined,width=image?.width??0,height=image?.height??0;images.push({name:value.name||material.name||'unnamed material texture',width,height,estimatedRGBA8MipBytes:Math.ceil(width*height*4*(value.generateMipmaps?4/3:1))});}}
 });
 return{boundary:'Scene-owned CPU geometry/instance payloads and approximate RGBA8 texture payloads only. Excludes driver caches, hidden retired city roots, render targets and shader-node-owned textures; post/shadow/mirrors reported separately. Not actual VRAM or overdraw.',uniqueGeometries:geometries.size,uniqueMaterials:materials.size,uniqueMaterialTextures:textures.size,geometryPayloadBytes,instancePayloadBytes,estimatedMaterialTextureBytes:images.reduce((n,t)=>n+t.estimatedRGBA8MipBytes,0),visibleMeshFlags:visibleMeshes,transparentMeshFlags:transparentMeshes,largestMaterialTextures:images.sort((a,b)=>b.estimatedRGBA8MipBytes-a.estimatedRGBA8MipBytes).slice(0,12)};
}
