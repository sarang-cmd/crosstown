// Follow the actual analytic shoreline/canal instead of rasterizing and
// fragment-discarding a 4.1 x 4.1 km sheet beneath all the opaque city land.
// Vertex spacing is <=35 m (old grid: 42.7 m), retaining wave displacement,
// coast foam, Fresnel sky reflection and the complete water area at every tier.
import {BufferGeometry,Float32BufferAttribute} from 'three/webgpu';
export function makeWaterGeometry():BufferGeometry {
 const positions:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[];
 const strip=(z0:number,z1:number,rows:number,columns:number,bounds:(z:number)=>[number,number])=>{
  const offset=positions.length/3;
  for(let iz=0;iz<=rows;iz++){
   const z=z0+(z1-z0)*iz/rows,[left,right]=bounds(z);
   for(let ix=0;ix<=columns;ix++){positions.push(left+(right-left)*ix/columns,0,z);normals.push(0,1,0);uv.push(ix/columns,iz/rows);}
  }
  for(let iz=0;iz<rows;iz++)for(let ix=0;ix<columns;ix++){
   const a=offset+iz*(columns+1)+ix,b=a+1,c=a+columns+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
 };
 strip(-2050,2050,128,12,z=>[-2050,Math.sin(z/390)*24-1655+7]);
 strip(-1035,1075,72,2,z=>{const centre=-858+Math.sin(z/210)*18;return[centre-27,centre+27];});
 const geometry=new BufferGeometry();geometry.name='Shoreline + canal water · no masked land';
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.boundingBox!.expandByScalar(.15);geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=.15;return geometry;
}
