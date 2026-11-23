// Steps 08–09: reviewed Kenney CC0 variants, two original fallback motorcycles,
// and a slim animated CC0 pedestrian derivative. No model exceeds 60k triangles.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, reorder } from '@gltf-transform/functions';
import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, Matrix4, Euler, Quaternion, Vector3 } from 'three';
import { createIO, measure, normalizeDocument, MeshoptEncoder } from './asset-lib.mjs';
import { prepareAsset } from './prepare-asset.mjs';
import { trimCivilianRosters } from './trim-civilian-roof.mjs';
import { writeCredits } from './credits.mjs';
const digest = b => createHash('sha256').update(b).digest('hex');
const url = 'https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip';
const archiveSha = 'fac7dacac5c7874348cf19729af3ef205f3d366493edaf0a827d93f4fdf3d0c4';
const selections = [
 ['pip','hatchback-sports',3.60], ['milo','van',3.85], ['harbor-roster','sedan',4.30], ['meridian','sedan-sports',4.65],
 ['brim','taxi',4.90], ['cinder','police',4.95], ['aerox','race',4.50], ['zenith','race-future',4.60], ['mesa','suv',4.90], ['summit','suv-luxury',5.15],
];
for (const [id, model, size] of selections) await prepareAsset({ id, title: `Crosstown ${id} — Kenney ${model} derivative`, kind:'car', size, forward:'+Z', author:'Kenney', license:'CC0-1.0', source:'https://opengameart.org/content/car-kit', licenseUrl:'https://opengameart.org/content/car-kit', url, archiveEntry:`Models/GLB format/${model}.glb`, expectedDownloadSha256:archiveSha });
const io = await createIO();
const failures = [];
for (const source of ['https://poly.pizza/m/dse64pqMKAR','https://poly.pizza/m/cFvmALDjMKw']) {
  try { const res=await fetch(source, { signal:AbortSignal.timeout(20000) }); failures.push({source,status:res.status,result:res.ok?'Page retrieved, no directly downloadable licensed GLB exposed to this pipeline':'Model download inaccessible; original authored fallback used'}); }
  catch(e){failures.push({source,result:String(e)});}
}
await fs.writeFile('docs/evidence/crosstown-0.9.0/motorcycle-source-attempts.json',JSON.stringify({date:'2026-11-22',failures,decision:'Original project-authored CC0 GLBs, not repackaged third-party motorcycle geometry.'},null,2)+'\n');
async function compress(doc, id, report) {
  const raw=await io.writeBinary(doc); await fs.mkdir(`assets/sources/${id}`,{recursive:true}); await fs.writeFile(`assets/sources/${id}/model.glb`,raw);
  await doc.transform(dedup(),prune({keepExtras:true,keepLeaves:true}),reorder({encoder:MeshoptEncoder,cleanup:false}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.FILTER});
  const bytes=await io.writeBinary(doc);await fs.writeFile(`public/models/${id}.glb`,bytes);
  const after=measure(await io.readBinary(bytes));
  await fs.writeFile(`docs/assets/${id}.json`,JSON.stringify({...report,id,sourceSha256:digest(raw),sourceBytes:raw.length,sourceGlbBytes:raw.length,outputBytes:bytes.length,outputSha256:digest(bytes),after},null,2)+'\n');
  await fs.writeFile(`docs/assets/${id}.license.txt`,`${report.author}\n${report.license}\n${report.licenseUrl}\n${report.source}\n${report.modifications.join('\n')}\n`);
  console.log(id,bytes.length,after.triangles,after.animations);
}
for(const [id,sport] of [['wren',false],['kestrel',true]]) {
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Original fictional motorcycle');doc.getRoot().setDefaultScene(scene);
 const mats={paint:doc.createMaterial('paint').setBaseColorFactor(sport?[.74,.24,.12,1]:[.23,.51,.40,1]).setRoughnessFactor(.42),dark:doc.createMaterial('trim').setBaseColorFactor([.045,.065,.065,1]),metal:doc.createMaterial('metal').setBaseColorFactor([.48,.55,.53,1]).setMetallicFactor(.65).setRoughnessFactor(.3),glass:doc.createMaterial('glass').setBaseColorFactor([.18,.32,.35,1]).setRoughnessFactor(.18),light:doc.createMaterial('light_front').setBaseColorFactor([.92,.89,.64,1]).setEmissiveFactor([.25,.24,.16])};
 function part(name,g,m,p=[0,0,0],r=[0,0,0],s=[1,1,1]){
   g.applyMatrix4(new Matrix4().compose(new Vector3(...p),new Quaternion().setFromEuler(new Euler(...r)),new Vector3(...s)));
   const primitive=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor('',buffer).setType('VEC3').setArray(new Float32Array(g.attributes.position.array))).setAttribute('NORMAL',doc.createAccessor('',buffer).setType('VEC3').setArray(new Float32Array(g.attributes.normal.array))).setIndices(doc.createAccessor('',buffer).setType('SCALAR').setArray(new Uint32Array(g.index.array))).setMaterial(mats[m]);
   const node=doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive));scene.addChild(node);g.dispose();return node;
 }
 for(const [z,name] of [[.77,'wheel_fl'],[-.77,'wheel_rl']]) { const n=part(name,new CylinderGeometry(.32,.32,.14,18),'dark',[0,.32,z],[0,0,Math.PI/2]); const hub=part(name+'-alloy',new TorusGeometry(.18,.028,5,12),'metal',[.075,.32,z],[0,Math.PI/2,0]); scene.removeChild(hub); n.addChild(hub); }
 part('engine',new BoxGeometry(.34,.32,.42),'metal',[0,.48,-.05]);
 part('tank',new SphereGeometry(1,14,9),'paint',[0,.84,.12],[0,0,0],sport?[.21,.20,.39]:[.23,.19,.34]);
 part('seat',new BoxGeometry(.31,.10,sport?.54:.68),'dark',[0,.81,-.41]);
 for(const x of [-.13,.13]){part('fork',new CylinderGeometry(.025,.025,.75,7),'metal',[x,.70,.64],[-.24,0,0]);part('rear-swingarm',new BoxGeometry(.028,.06,.77),'metal',[x,.36,-.42],[-.14,0,0]);part('frame',new CylinderGeometry(.025,.025,.84,7),'dark',[x,.55,-.05],[.98,0,0]);}
 part('steering_wheel',new CylinderGeometry(.023,.023,.77,8),'metal',[0,1.05,.46],[0,0,Math.PI/2]);
 for(const x of [-.36,.36])part('grip',new CylinderGeometry(.031,.031,.14,8),'dark',[x,1.05,.46],[0,0,Math.PI/2]);
 part('exhaust',new CylinderGeometry(.057,.046,.63,10),'metal',[sport?.18:.21,.39,-.42],[Math.PI/2,0,0]);
 part('light_front',new CylinderGeometry(sport?.11:.13,sport?.11:.13,.08,12),'light',[0,.97,.66],[Math.PI/2,0,0]);
 part('tail',new BoxGeometry(.27,.13,.24),'paint',[0,.82,-.80]);
 if(sport){part('fairing',new SphereGeometry(1,12,8),'paint',[0,.77,.49],[0,0,0],[.27,.29,.34]);part('glass',new SphereGeometry(1,10,6),'glass',[0,1.09,.49],[.35,0,0],[.23,.20,.08]);}
 else {part('rear-rack',new BoxGeometry(.32,.035,.27),'metal',[0,.87,-.83]);part('front-fender',new BoxGeometry(.19,.045,.56),'paint',[0,.68,.77]);}
 const before=measure(doc),length=sport?2.26:2.16;normalizeDocument(doc,{kind:'car',size:length});
 await compress(doc,id,{title:`Crosstown ${sport?'Kestrel Twin':'Wren Single'} — original motorcycle`,kind:'car',author:'Crosstown project (original procedural modelling)',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'tools/prepare-roster.mjs',url:'tools/prepare-roster.mjs',targetSize:length,targetDimension:'length',units:'metres',forward:'+Z',up:'+Y',pivot:'ground-centre',before,modifications:['Original detailed two-wheel fictional motorcycle, authored as fallback after source access failed','Ground-centred +Z-forward glTF with fork, tank, engine, two axles, exhaust, controls, lamp and class-specific fairing or luggage rack','Meshopt FILTER geometry compression']});
}
// Reuse the already-reviewed 1.75 m CC0 skinned character, not external runtime URLs.
const ped=await io.read('public/models/test-character.glb');
for(const extension of [...ped.getRoot().listExtensionsUsed()]) if(extension.extensionName==='EXT_meshopt_compression') extension.dispose();
const wanted=new Map([['Idle','Idle'],['Walking','Walk'],['Running','Run'],['Sitting','Sit'],['Wave','Chat']]);
for(const animation of [...ped.getRoot().listAnimations()]){if(wanted.has(animation.getName()))animation.setName(wanted.get(animation.getName()));else animation.dispose();}
const run=ped.getRoot().listAnimations().find(a=>a.getName()==='Run'),flee=ped.createAnimation('Flee');
for(const channel of run.listChannels()){
 const old=channel.getSampler(),t=old.getInput(),input=ped.createAccessor('flee-time',ped.getRoot().listBuffers()[0]).setType('SCALAR').setArray(Float32Array.from(t.getArray(),v=>v/1.28));
 const sampler=ped.createAnimationSampler().setInput(input).setOutput(old.getOutput()).setInterpolation(old.getInterpolation());
 flee.addSampler(sampler).addChannel(ped.createAnimationChannel().setSampler(sampler).setTargetNode(channel.getTargetNode()).setTargetPath(channel.getTargetPath()));
}
const base=JSON.parse(await fs.readFile('docs/assets/test-character.json','utf8'));
await compress(ped,'city-pedestrian',{...base,title:'Crosstown animated city pedestrian — CC0 RobotExpressive derivative',before:measure(ped),requiredAnimations:['Walk','Idle','Run','Flee','Sit','Chat'],modifications:[...base.modifications,'Six retained/renamed idle/walk/run/sit/chat/flee skeletal clips; flee is an explicitly retimed running derivative, not a newly recorded motion']});
await trimCivilianRosters();
await writeCredits(process.cwd());
