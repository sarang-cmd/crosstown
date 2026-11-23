// r180 stores <=1000 per-instance matrices in a count-specialized uniform array.
// City chunks then compile/upload separate UBO programs on the render path. Keep
// an actual, fixed 1024-matrix capacity so BOTH backends use instanced vertex
// attributes instead. The public draw count stays exact: no extra cars/triangles.
// This trades <=64 KiB per small batch for stable shaders and update-on-change
// attribute uploads; no renderer internals, vendor patch or fake FPS are used.
import {InstancedMesh, type BufferGeometry, type Material} from 'three/webgpu';
export class StableInstances extends InstancedMesh {
  readonly requestedCapacity:number;
  constructor(geometry:BufferGeometry,material:Material|Material[],count:number){
    super(geometry,material,Math.max(1024,count));
    this.requestedCapacity=count;
    this.count=count;
  }
}
