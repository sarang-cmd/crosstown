// Surveyed source-space removal: civilian derivatives must not keep taxi signs or
// patrol roof bars. Changes are baked into glTF for BOTH batched and taken cars.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, reorder } from '@gltf-transform/functions';
import { createIO, measure, MeshoptEncoder } from './asset-lib.mjs';
export async function trimCivilianRosters(){
 const io=await createIO();
 for(const[id,roof]of [['brim',1.35],['cinder',1.29]]){
  const path=`public/models/${id}.glb`,doc=await io.read(path),node=doc.getRoot().listNodes().find(n=>n.getName()==='body');let removed=0;
  for(const primitive of node.getMesh().listPrimitives()){
   const indices=primitive.getIndices(),positions=primitive.getAttribute('POSITION'),kept=[];
   for(let i=0;i<indices.getCount();i+=3){const ids=[indices.getScalar(i),indices.getScalar(i+1),indices.getScalar(i+2)],top=Math.max(...ids.map(id=>positions.getElement(id,[0,0,0])[1]+node.getTranslation()[1]));if(top>roof){removed++;continue;}kept.push(...ids);}
   indices.setArray(new Uint32Array(kept));
  }
  if(!removed){console.log(`${id}: civilian roof already trimmed`);continue;}
  for(const ext of [...doc.getRoot().listExtensionsUsed()])if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();
  await doc.transform(dedup(),prune({keepExtras:true,keepLeaves:true}),reorder({encoder:MeshoptEncoder,cleanup:false}));doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.FILTER});
  const bytes=await io.writeBinary(doc);await fs.writeFile(path,bytes);
  const reportPath=`docs/assets/${id}.json`,report=JSON.parse(await fs.readFile(reportPath,'utf8'));report.after=measure(await io.readBinary(bytes));report.outputBytes=bytes.length;report.outputSha256=createHash('sha256').update(bytes).digest('hex');report.civilianRoofTrianglesRemoved=removed;report.modifications.push(`Surveyed civilian roof cleanup: removed ${removed} taxi-sign / patrol-light triangles offline; no police/taxi markings or siren gameplay.`);await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');await fs.appendFile(`docs/assets/${id}.license.txt`,`\n${report.modifications.at(-1)}\n`);console.log(`${id}: removed ${removed} roof accessory triangles; ${report.after.triangles} retained`);
 }
}
if(fileURLToPath(import.meta.url)===process.argv[1])await trimCivilianRosters();
