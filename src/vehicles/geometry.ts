import { Float32BufferAttribute, type BufferGeometry, type Matrix4 } from 'three/webgpu';
/** Decode normalized Meshopt/quantized attributes BEFORE baking transforms.
 * BufferGeometry.applyMatrix4 writes in-place; writing metre coordinates into a
 * normalized Uint16 buffer clips/wraps cars into giant triangles. Sources stay owned
 * by CarLibrary and are never mutated by the live or batched renderers.
 */
export function decodedGeometry(source:BufferGeometry,matrix?:Matrix4):BufferGeometry {
 const out=source.clone();
 for(const [name,attribute]of Object.entries(source.attributes)){
  const values=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let k=0;k<attribute.itemSize;k++)values[i*attribute.itemSize+k]=attribute.getComponent(i,k);
  out.setAttribute(name,new Float32BufferAttribute(values,attribute.itemSize));
 }
 if(matrix)out.applyMatrix4(matrix);
 return out;
}
