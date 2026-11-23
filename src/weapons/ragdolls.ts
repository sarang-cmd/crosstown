// Four original five-part articulated ragdolls. Physics bodies and joints are
// pooled before shader warm-up; faded bodies are disabled, never stepped here.
import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Mesh, BoxGeometry, SphereGeometry, MeshStandardNodeMaterial } from 'three/webgpu';
import { v3, type V3 } from '../parkour/types';
export class Ragdolls {
 readonly root=new Group();private cursor=0;private owned:{dispose():void}[]=[];
 private dolls:{parts:{body:RAPIER.RigidBody;mesh:Mesh;offset:V3}[];joints:RAPIER.ImpulseJoint[];material:MeshStandardNodeMaterial;left:number}[]=[];
 constructor(readonly world:RAPIER.World){for(let i=0;i<4;i++){const material=new MeshStandardNodeMaterial({color:['#b8c5a2','#ba9d7f','#84a6a8','#ba9bac'][i],roughness:.9,transparent:true,opacity:1}),parts:{body:RAPIER.RigidBody;mesh:Mesh;offset:V3}[]=[],joints:RAPIER.ImpulseJoint[]=[];this.owned.push(material);
  const shapes=[[0,1,0,.23,.32,.16],[0,1.52,0,.16,.16,.16],[-.13,.4,0,.095,.3,.10],[.13,.4,0,.095,.3,.10],[.36,1,0,.10,.28,.10]];
  for(let n=0;n<shapes.length;n++){const[x,y,z,hx,hy,hz]=shapes[n]!,offset=v3(x!,y!,z!),body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x!,-200+y!,z!).setLinearDamping(.15).setAngularDamping(.7));body.userData={ragdoll:true,surface:'fabric'};world.createCollider(RAPIER.ColliderDesc.cuboid(hx!,hy!,hz!).setMass(n===0?8:2).setFriction(.7),body);const geo=n===1?new SphereGeometry(.16,8,6):new BoxGeometry(hx!*2,hy!*2,hz!*2),mesh=new Mesh(geo,material);mesh.visible=false;this.root.add(mesh);this.owned.push(geo);parts.push({body,mesh,offset});}
  for(let n=1;n<parts.length;n++){const a=parts[0]!,b=parts[n]!,worldY=n===1?1.32:n<4?.69:1.2;const joint=world.createImpulseJoint(RAPIER.JointData.spherical(v3((b.offset.x)*.5,worldY-a.offset.y,0),v3(-b.offset.x*.5,worldY-b.offset.y,0)),a.body,b.body,true);joint.setContactsEnabled(false);joints.push(joint);}for(const p of parts)p.body.setEnabled(false);this.dolls.push({parts,joints,material,left:0});}}
 spawn(position:V3,direction:V3):void{const d=this.dolls[this.cursor++%this.dolls.length]!;d.left=4;d.material.opacity=1;for(const p of d.parts){p.body.setEnabled(true);p.body.setTranslation(v3(position.x+p.offset.x,position.y+p.offset.y,position.z+p.offset.z),true);p.body.setRotation({x:0,y:0,z:0,w:1},true);p.body.setLinvel(v3(direction.x*3,1.4,direction.z*3),true);p.body.setAngvel(v3(.8,0,.4),true);p.mesh.visible=true;}}
 update(dt:number):void{for(const d of this.dolls){if(d.left<=0)continue;d.left=Math.max(0,d.left-dt);d.material.opacity=Math.min(1,d.left/1.2);for(const p of d.parts){p.mesh.visible=d.left>0;if(d.left===0)p.body.setEnabled(false);else{p.mesh.position.copy(p.body.translation());p.mesh.quaternion.copy(p.body.rotation());}}}}
 snapshot(){return{capacity:this.dolls.length,active:this.dolls.filter(d=>d.left>0).length,bodies:this.dolls.reduce((n,d)=>n+d.parts.length,0)};}
 dispose():void{for(const d of this.dolls){for(const j of d.joints)this.world.removeImpulseJoint(j,true);for(const p of d.parts)this.world.removeRigidBody(p.body);}for(const r of this.owned)r.dispose();this.root.clear();}
}
