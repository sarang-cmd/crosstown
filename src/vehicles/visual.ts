import { StableInstances } from '../rendering/instances';
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry,
  MeshStandardNodeMaterial, MeshBasicNodeMaterial, Vector3, SpotLight, Box3, InstancedMesh, Object3D, Color,
  Float32BufferAttribute, BufferGeometry, Texture, type Material,
} from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { decodedGeometry } from './geometry';
import type { RaycastCar } from './physics';

export class CarVisual {
  readonly root = new Group(); readonly exterior = new Group(); readonly door = new Group();
  readonly wheels: { steer: Group; spin: Group }[] = []; readonly driver = new Group(); readonly npc = new Group();
  readonly lamp = new SpotLight('#ffedc3', 0, 44, .47, .35, 1.4);
  readonly brakeMaterial = new MeshBasicNodeMaterial({ color: '#9d6151', toneMapped: false });
  readonly frontMaterial = new MeshBasicNodeMaterial({ color: '#c9cfb2', toneMapped: false });
  readonly signalMaterial = new MeshBasicNodeMaterial({ color: '#584d33', toneMapped: false });
  paint: string; private paintMaterials: MeshStandardNodeMaterial[] = []; private damageMeshes: { mesh: Mesh; base: Float32Array; door: boolean }[] = []; private glassMeshes: Mesh[] = []; private damageRevision = -1; private dentedVertices = 0; private effectTime = 0;
  private effects = new Group(); private smoke: InstancedMesh; private flames: InstancedMesh; private effectDummy = new Object3D();
  headlights = false; indicator = 0; modelLoaded = false; realDoorTriangles = 0; npcState: 'seated' | 'leaving' | 'gone' = 'seated';
  private npcTime = 0; private npcGroundY = 0; private npcLimbs: Group[] = []; private resources = new Set<{ dispose(): void }>();
  private npcStart = new Vector3(); private npcDirection = new Vector3();
  constructor(readonly car: RaycastCar, source?: Object3D, npc = false) {
    this.paint = car.definition.paints[0]!; this.root.name = car.id + ' · ' + car.definition.name; this.root.add(this.exterior);
    const smokeMat = new MeshBasicNodeMaterial({ color:'#53605c',transparent:true,opacity:.42,depthWrite:false }), fireMat = new MeshBasicNodeMaterial({color:'#ffa353',toneMapped:false});
    this.smoke = new StableInstances(new SphereGeometry(1,6,4),smokeMat,10); this.flames = new StableInstances(new SphereGeometry(1,5,4),fireMat,8);
    this.effects.add(this.smoke,this.flames); this.root.add(this.effects); this.resources.add(smokeMat); this.resources.add(fireMat); this.smoke.frustumCulled = this.flames.frustumCulled = false;
    this.resources.add(this.brakeMaterial); this.resources.add(this.frontMaterial); this.resources.add(this.signalMaterial);
    if (source) {
      // Cloned Object3Ds still share source materials/textures. Each live car owns
      // its copies so clearing a route cannot invalidate another car or glTF.
      const materials = new Map<Material, Material>(), textures = new Map<Texture, Texture>();
      const copyMaterial = (original: Material): Material => {
        let copy = materials.get(original); if (copy) return copy;
        copy = original.clone(); materials.set(original, copy); this.resources.add(copy);
        for (const [key, value] of Object.entries(original)) if (value instanceof Texture) {
          let texture = textures.get(value); if (!texture) { texture = value.clone(); textures.set(value, texture); this.resources.add(texture); }
          Object.assign(copy, { [key]: texture });
        }
        return copy;
      };
      const model = source.clone(true); model.position.set(0,0,0); model.rotation.set(0,0,0); model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model), size = bounds.getSize(new Vector3()), c = car.definition;
      model.scale.multiply(new Vector3(c.halfWidth*2/Math.max(.1,size.x),c.height/Math.max(.1,size.y),c.halfLength*2/Math.max(.1,size.z)));
      model.position.y = -(c.wheelRadius+c.suspension.rest-.06); model.updateMatrixWorld(true);
      // Bake the decoded glTF transforms once. Actual named wheel meshes are re-pivoted onto the raycast axles.
      const meshes: Mesh[] = []; model.traverse(o => { if (o instanceof Mesh) { o.material = Array.isArray(o.material) ? o.material.map(copyMaterial) : copyMaterial(o.material); meshes.push(o); } });
      const wheelNames = car.bike ? ['wheel_fl','wheel_rl'] : ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
      const wheelMeshes = new Set<Mesh>();
      for (let i = 0; i < wheelNames.length; i++) {
        const node = model.getObjectByName(wheelNames[i]!); let wheel: Object3D | undefined;
        if (node) {
          const pieces: {geometry:BufferGeometry;material:Material|Material[]}[] = [], box=new Box3();
          node.traverse(o => { if(o instanceof Mesh){wheelMeshes.add(o);const geometry=decodedGeometry(o.geometry,o.matrixWorld);geometry.computeBoundingBox();box.union(geometry.boundingBox!);pieces.push({geometry,material:o.material});} });
          if(pieces.length){const center=box.getCenter(new Vector3()),size=box.getSize(new Vector3()),scale=car.definition.wheelRadius*2/Math.max(.01,size.y),group=new Group();
            for(const {geometry,material}of pieces){geometry.translate(-center.x,-center.y,-center.z);geometry.scale(scale,scale,scale);this.resources.add(geometry);group.add(new Mesh(geometry,material));}
            wheel=pieces.length===1?group.children[0]:group;
          } node.removeFromParent();
        }
        this.addWheel(i, wheel);
      }
      for (const m of meshes) {
        if (wheelMeshes.has(m)) continue;
        const geometry = decodedGeometry(m.geometry,m.matrixWorld); this.resources.add(geometry);
        const material = m.material; const body = this.splitDoor(geometry, material); this.exterior.add(body);
        for (const material of Array.isArray(m.material) ? m.material : [m.material]) this.resources.add(material);
      }
      this.modelLoaded = true;
    } else this.buildFallback();
    this.root.add(this.door); this.door.position.set(car.definition.halfWidth-.03, .20, .75); this.door.visible = !car.bike;
    if (!this.realDoorTriangles) {
      const panel = this.box(.055, .48, 1.27, '#597c72'); panel.position.set(0, .11, -.60); this.door.add(panel);
      const glass = this.box(.04, .34, .92, '#8caeaa'); glass.position.set(0, .49, -.52); this.door.add(glass);
    }
    const handle = this.box(.028, .035, .18, '#d8d0aa'); handle.position.set(.045, .34, -.91); this.door.add(handle);
    for (const x of car.bike ? [0] : [-car.definition.halfWidth*.70, car.definition.halfWidth*.70]) {
      const front = new Mesh(new BoxGeometry(.40, .10, .04), this.frontMaterial); this.resources.add(front.geometry); front.position.set(x, .16, car.definition.halfLength+.025); this.exterior.add(front);
      const brake = new Mesh(new BoxGeometry(.40, .11, .035), this.brakeMaterial); this.resources.add(brake.geometry); brake.position.set(x, .16, -car.definition.halfLength-.025); this.exterior.add(brake);
      const signal = new Mesh(new BoxGeometry(.13, .09, .04), this.signalMaterial); this.resources.add(signal.geometry); signal.position.set(x + Math.sign(x) * .15, .16, car.definition.halfLength+.03); this.exterior.add(signal);
    }
    const plate = this.box(.43, .10, .022, '#e9dfba'); plate.position.set(0, .04, -car.definition.halfLength-.04); this.exterior.add(plate);
    for (const x of [-.84, .84]) { const mirror = this.box(.24, .14, .15, '#4e6c62'); mirror.position.set(x, .54, .57); this.exterior.add(mirror); }
    this.lamp.visible=false; this.lamp.position.set(0, .21, 1.95); this.lamp.target.position.set(0, -.23, 20); this.exterior.add(this.lamp, this.lamp.target);
    this.buildPerson(this.driver, false); this.driver.position.set(.40, -.21, -.40); this.exterior.add(this.driver); this.driver.visible = false;
    this.buildPerson(this.npc, true); this.npc.position.set(.40, -.21, -.40); this.root.add(this.npc); this.npc.visible = npc;
    this.exterior.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.setPaint(this.paint); this.render(1, 0);
  }
  private box(x: number, y: number, z: number, color: string): Mesh { const g = new BoxGeometry(x, y, z), m = new MeshStandardNodeMaterial({ color, roughness: .7 }); this.resources.add(g); this.resources.add(m); return new Mesh(g, m); }
  private splitDoor(source: BufferGeometry, material: Material | Material[]): Mesh {
    const geo = source.index ? source.toNonIndexed() : source.clone(), positions = geo.getAttribute('position');
    const keep: number[] = [], door: number[] = [], glass: number[] = [];
    const baseMaterial = Array.isArray(material) ? material[0]! : material;
    for (let i=0;i<positions.count;i+=3) {
      let x=0,y=0,z=0; for(let j=0;j<3;j++){x+=positions.getX(i+j)/3;y+=positions.getY(i+j)/3;z+=positions.getZ(i+j)/3;}
      // Roof attachments on the taxi/patrol source are removed: these are fictional
      // civilian muscle derivatives, never police/siren gameplay or branded taxis.
      if (['brim','cinder'].includes(this.car.definition.id) && y>this.car.definition.height*.68 && Math.abs(x)<.55 && Math.abs(z)<.65) continue;
      const isGlass = /glass|window/.test(baseMaterial.name) || (!this.car.bike && y>.40 && y<1.2 && Math.abs(z)<.9 && (Math.abs(x)>this.car.definition.halfWidth*.65 || Math.abs(z)>.60));
      const group = isGlass ? glass : !this.car.bike && x>this.car.definition.halfWidth*.75 && y>-.05 && y<.72 && z>-.86 && z<.78 ? door : keep;
      group.push(i,i+1,i+2);
    }
    const subset = (ids:number[]) => { const out = new BufferGeometry(); for(const name of Object.keys(geo.attributes)){ const attr=geo.getAttribute(name), arr:number[]=[]; for(const i of ids)for(let k=0;k<attr.itemSize;k++)arr.push(attr.getComponent(i,k));out.setAttribute(name,new Float32BufferAttribute(arr,attr.itemSize)); } out.computeBoundingSphere();this.resources.add(out);return out; };
    const body=new Mesh(subset(keep),material); this.damageMeshes.push({mesh:body,base:new Float32Array(body.geometry.getAttribute('position').array),door:false});
    if(baseMaterial instanceof MeshStandardNodeMaterial) this.paintMaterials.push(baseMaterial);
    if(door.length){const g=subset(door);g.translate(-(this.car.definition.halfWidth-.03),-.20,-.75);const m=new Mesh(g,material);this.door.add(m);this.realDoorTriangles+=door.length/3;this.damageMeshes.push({mesh:m,base:new Float32Array(g.getAttribute('position').array),door:true});}
    if(glass.length){const mat=new MeshStandardNodeMaterial({color:'#567a7e',roughness:.2,metalness:.3});this.resources.add(mat);const mesh=new Mesh(subset(glass),mat);this.exterior.add(mesh);this.glassMeshes.push(mesh);}
    geo.dispose();return body;
  }
  setPaint(value: string): boolean {
    if(!/^#[0-9a-f]{6}$/i.test(value))return false; this.paint=value;
    for(const m of this.paintMaterials) { m.color.set(value); if(m.map) m.color.lerp(new Color('#ffffff'),.20); }
    return true;
  }
  private updateDamage(dt:number):void {
    const state=this.car.damageState; this.effectTime+=dt;
    if(this.damageRevision!==state.revision){this.damageRevision=state.revision;this.dentedVertices=0;
      for(const part of this.damageMeshes){const attr=part.mesh.geometry.getAttribute('position'), ox=part.door?this.car.definition.halfWidth-.03:0, oy=part.door?.20:0, oz=part.door?.75:0;
        for(let i=0;i<attr.count;i++){const x=part.base[i*3]!+ox,y=part.base[i*3+1]!+oy,z=part.base[i*3+2]!+oz;let px=x,py=y,pz=z;
          for(const d of state.dents){const distance=Math.hypot(x-d.point.x,y-d.point.y,z-d.point.z),w=Math.exp(-distance*distance/(d.radius*d.radius)) * d.depth;px-=Math.sign(d.point.x||x)*w*.8;pz-=Math.sign(d.point.z||z)*w;py-=w*.22;}
          if(Math.abs(px-x)+Math.abs(py-y)+Math.abs(pz-z)>.001)this.dentedVertices++;attr.setXYZ(i,px-ox,py-oy,pz-oz);
        } attr.needsUpdate=true;part.mesh.geometry.computeVertexNormals();
      }
      for(const mesh of this.glassMeshes)mesh.visible=!state.glassBroken;
      if(state.wreck)for(const material of this.paintMaterials)material.color.set('#303733');
    }
    this.smoke.visible=state.amount>=.68;this.flames.visible=state.stage==='burning';
    if(this.smoke.visible)for(let i=0;i<10;i++){const u=((this.effectTime*.42+i*.111)%1);this.effectDummy.position.set(Math.sin(i*3+u*2)*u*.7,.30+u*3.6,this.car.definition.halfLength*.65);this.effectDummy.scale.setScalar(.12+u*.52);this.effectDummy.updateMatrix();this.smoke.setMatrixAt(i,this.effectDummy.matrix);}
    if(this.flames.visible)for(let i=0;i<8;i++){this.effectDummy.position.set(Math.sin(i*4)*.46,.30+Math.abs(Math.sin(this.effectTime*9+i))* .9,this.car.definition.halfLength*.5+Math.cos(i*5)*.45);this.effectDummy.scale.set(.13,.28+Math.abs(Math.sin(this.effectTime*11+i))*.36,.16);this.effectDummy.updateMatrix();this.flames.setMatrixAt(i,this.effectDummy.matrix);}
    if(this.smoke.visible)this.smoke.instanceMatrix.needsUpdate=true;if(this.flames.visible)this.flames.instanceMatrix.needsUpdate=true;
  }
  private addWheel(i: number, model?: Object3D): void {
    const steer = new Group(), spin = new Group(), c = this.car.definition, front = this.car.bike ? i===0 : i<2;
    steer.position.set(this.car.bike ? 0 : i % 2 === 0 ? c.track / 2 : -c.track / 2, -.3, front ? c.wheelbase / 2 : -c.wheelbase / 2); steer.add(spin);
    if (model) spin.add(model);
    else {
      const tire = new Mesh(new CylinderGeometry(c.wheelRadius, c.wheelRadius, .23, 20), new MeshStandardNodeMaterial({ color: '#283e36', roughness: .95 })); tire.rotation.z = Math.PI / 2; spin.add(tire);
      const rim = new Mesh(new TorusGeometry(.20, .033, 6, 14), new MeshStandardNodeMaterial({ color: '#c6c6a7', metalness: .6, roughness: .4 })); rim.rotation.y = Math.PI / 2; rim.position.x = i % 2 === 0 ? .13 : -.13; spin.add(rim);
      for (const object of [tire, rim]) { this.resources.add(object.geometry); this.resources.add(object.material); }
    }
    this.exterior.add(steer); this.wheels.push({ steer, spin });
  }
  private buildFallback(): void {
    // Designed five-volume sedan with recessed cabin, two-tone sills, bumpers and real wheels; not a missing-model box.
    const shell = this.box(1.84, .44, 4.3, '#628a7b'); shell.position.y = .08; this.exterior.add(shell);
    const hood = this.box(1.78, .17, 1.21, '#749889'); hood.position.set(0, .35, 1.34); hood.rotation.x = -.09; this.exterior.add(hood);
    const cabin = this.box(1.52, .47, 1.92, '#354f4a'); cabin.position.set(0, .60, -.20); this.exterior.add(cabin);
    const roof = this.box(1.54, .07, 1.61, '#749889'); roof.position.set(0, .86, -.31); this.exterior.add(roof);
    for (const x of [-.88, .88]) { const sill = this.box(.08, .07, 3.0, '#d4c8a4'); sill.position.set(x, -.12, -.12); this.exterior.add(sill); }
    if (this.car.bike) { this.exterior.clear(); const c=this.car.definition; const tank=this.box(.40,.32,.60,this.paint); tank.position.set(0,.20,.12); this.exterior.add(tank); const seat=this.box(.32,.09,.65,'#283f39');seat.position.set(0,.30,-.40);this.exterior.add(seat); for(const x of [-.14,.14]) {const fork=this.box(.035,.73,.035,'#a8b5a4');fork.position.set(x,.17,c.wheelbase/2-.10);fork.rotation.x=-.2;this.exterior.add(fork);} const bars=this.box(.78,.04,.04,'#b9bba1');bars.position.set(0,.62,.45);this.exterior.add(bars); }
    for (let i = 0; i < this.car.wheels.length; i++) this.addWheel(i);
  }
  private buildPerson(root: Group, limbs: boolean): void {
    const suit = new MeshStandardNodeMaterial({ color: limbs ? '#b58464' : '#e0dec4', roughness: .85 }), skin = new MeshStandardNodeMaterial({ color: '#d5b587', roughness: .87 }); this.resources.add(suit); this.resources.add(skin);
    const torso = new Mesh(new CapsuleGeometry(.17, .23, 4, 8), suit); torso.position.y = .58; root.add(torso); this.resources.add(torso.geometry);
    const head = new Mesh(new SphereGeometry(.14, 12, 8), skin); head.position.y = .97; root.add(head); this.resources.add(head.geometry);
    for (let i = 0; i < 4; i++) { const pivot = new Group(); pivot.position.set((i % 2 ? -1 : 1) * (i < 2 ? .1 : .23), i < 2 ? .40 : .73, 0); const mesh = new Mesh(new CapsuleGeometry(.06, i < 2 ? .39 : .29, 3, 7), suit); mesh.position.y = -.18; pivot.rotation.x = i < 2 ? -1.3 : -.7; pivot.add(mesh); root.add(pivot); this.resources.add(mesh.geometry); if (limbs) this.npcLimbs.push(pivot); }
  }
  carjack(): void { if (this.npcState !== 'seated' || !this.npc.visible) return; this.npcState = 'leaving'; this.npcTime = 0; this.root.updateMatrixWorld(true); this.npc.getWorldPosition(this.npcStart); this.npcGroundY = this.car.position.y - .52; this.npcDirection.set(1, 0, -1.4).applyQuaternion(this.root.quaternion).normalize(); this.root.parent?.attach(this.npc); }
  render(alpha: number, dt: number): void {
    const car = this.car; this.root.position.set(car.previous.x + (car.position.x - car.previous.x) * alpha, car.previous.y + (car.position.y - car.previous.y) * alpha, car.previous.z + (car.position.z - car.previous.z) * alpha); this.root.quaternion.slerpQuaternions(car.previousRotation, car.rotation, alpha);
    for (let i = 0; i < this.wheels.length; i++) { const wheel = this.wheels[i]!, w = car.wheels[i]!; wheel.steer.rotation.y = w.steer; wheel.steer.position.y = .06 - w.suspension; wheel.spin.rotation.x = w.rotation; }
    this.door.rotation.y = -car.engine.door * 1.12; this.door.visible = !car.bike && this.exterior.visible; this.updateDamage(dt);
    this.driver.visible = car.engine.occupied;
    this.brakeMaterial.color.set(car.input.brake > .1 || car.input.handbrake ? '#ffb085' : this.headlights ? '#bd705a' : '#885246'); this.frontMaterial.color.set(this.headlights ? '#ffefb9' : '#a4b39d'); this.lamp.intensity = this.headlights && !car.damageState.frontBroken && !car.bike ? 17 : 0;
    if(car.damageState.frontBroken)this.frontMaterial.color.set('#2d3835'); if(car.damageState.rearBroken)this.brakeMaterial.color.set('#2d3835');
    this.signalMaterial.color.set(this.indicator && Math.floor(car.engine.time * 1.5) % 2 === 0 ? '#ffcb79' : '#594d35');
    if (this.npcState === 'leaving') {
      this.npcTime += dt; const t = this.npcTime;
      this.npc.position.copy(this.npcStart).addScaledVector(this.npcDirection, t * 2.3); this.npc.position.y = this.npcStart.y + (this.npcGroundY - this.npcStart.y) * Math.min(1, t * 1.2);
      for (let i = 0; i < this.npcLimbs.length; i++) this.npcLimbs[i]!.rotation.x = Math.sin(t * 12 + (i % 2) * Math.PI) * .65;
      if (t > 5) { this.npcState = 'gone'; this.npc.visible = false; }
    }
  }
  snapshot() { return { gltf: this.modelLoaded, model: this.car.definition.model, paint: this.paint, damage:{...this.car.damageState.snapshot(),deformedVertices:this.dentedVertices,glassMeshes:this.glassMeshes.length,glassVisible:this.glassMeshes.some(m=>m.visible),smoke:this.smoke.visible,fire:this.flames.visible}, movingGltfDoorTriangles: this.realDoorTriangles, doorRadians: this.door.rotation.y, wheelNodes: this.wheels.length, wheels: this.wheels.map(w => ({ steer: w.steer.rotation.y, spin: w.spin.rotation.x, suspensionY: w.steer.position.y })), lights: this.headlights, headlightIntensity: this.lamp.intensity, npc: this.npc.visible ? this.npcState : 'none', exteriorVisible: this.exterior.visible }; }
  dispose(seen = new Set<unknown>()): void {
    this.npc.removeFromParent(); this.lamp.dispose(); this.smoke.dispose(); this.flames.dispose(); this.root.traverse(o => { if (o instanceof Mesh) { this.resources.add(o.geometry); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { this.resources.add(m); for (const val of Object.values(m)) if (val instanceof Texture) this.resources.add(val); } } });
    for (const resource of this.resources) if (!seen.has(resource)) { seen.add(resource); resource.dispose(); } this.resources.clear(); this.root.clear();
  }
}

// Used by the cabin builder too: coalesce compatible static geometry without removing the detail.
export function mergeStaticParts(root: Group, exclude: readonly Object3D[] = []): void {
  root.updateMatrixWorld(true); const bins = new Map<Material, Mesh[]>();
  for (const child of [...root.children]) if (child instanceof Mesh && !exclude.includes(child) && !Array.isArray(child.material) && child.material instanceof MeshStandardNodeMaterial) { const list = bins.get(child.material) ?? []; list.push(child); bins.set(child.material, list); }
  for (const [material, meshes] of bins) { if (meshes.length < 2) continue; const clones = meshes.map(m => m.geometry.clone().applyMatrix4(m.matrix)); const geometry = mergeGeometries(clones); if (geometry) { const mesh = new Mesh(geometry, material); mesh.name = 'Merged static cabin detail'; mesh.frustumCulled = false; root.add(mesh); for (const old of meshes) old.removeFromParent(); } clones.forEach(g => g.dispose()); }
}
