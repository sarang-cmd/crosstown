import { StableInstances } from '../rendering/instances';
import { bakeParts, type BakePart } from './bake';
// Instanced, authored-in-code coastal architecture. No photo backdrop, external textures, or placeholder city boxes.
import { Scene, Group, Mesh, InstancedMesh, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, RingGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, MeshStandardNodeMaterial, MeshBasicNodeMaterial, HemisphereLight, DirectionalLight, Color, FogExp2, Object3D, Vector3, CanvasTexture, SRGBColorSpace, DoubleSide, type BufferGeometry as Geometry, type Material, Texture } from 'three/webgpu';
import { color, mix, smoothstep, screenUV, positionWorld, fract, abs, min, float, texture as textureNode } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { add, direction, horizontal, seededRandom, v3, type RouteData, type V3, type Roof } from '../parkour/types';
import type { QualityTier } from '../config/quality';
import type { ParkourRun } from '../parkour/ParkourRun';
import { hazardPosition } from '../parkour/hazards';

type Part = { p: V3; s: V3; color: string; yaw: number; pitch: number; roll: number };
type Recipes = Map<string, Part[]>;
const PALETTE = ['#eed9bd', '#eabda5', '#a3c6c1', '#e0d6c5', '#bdc9d3', '#d8c3bb'];
const nextFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export class RooftopScene {
  readonly scene = new Scene();
  readonly sun = new DirectionalLight('#ffe6b2', 2.9);
  readonly ambient = new HemisphereLight('#c9edff', '#9a9a75', 1.7);
  readonly root = new Group();
  readonly car = new Group();
  readonly carArrow = new Group();
  readonly nextCheckpoint = new Group();
  readonly goalBeam = new Group();
  readonly pickupMeshes = new Map<string, Group>();
  readonly dynamicMeshes = new Map<string, Group>();
  readonly hazardMeshes = new Map<string, Group>();
  readonly chunks: { root: Group; center: Vector3 }[] = [];
  private geometries: Record<string, Geometry>;
  private materials: Record<string, Material>;
  private disposables: (Geometry | Material | CanvasTexture)[] = [];
  private fireworks: Mesh[] = [];
  private recipes = new Map<string, Recipes>();
  private viewDistance = 135;
  externalLighting = false;
  private materialCache = new Map<string, Material>();
  private coarse?: InstancedMesh;
  private pickupRings?: InstancedMesh;
  private pickupCores?: InstancedMesh;
  private fireworkBatch?: InstancedMesh;
  private tempObject = new Object3D();
  private staticExtras: { root: Group; center: Vector3 }[] = [];
  private lastCheckpoint = -1;
  private night = false;
  built = false;
  private disposed = false;
  constructor(readonly route: RouteData, readonly cityMode = false) {
    this.scene.backgroundNode = mix(color('#87c7e5'), color('#ecf0d9'), smoothstep(0.0, 0.86, screenUV.y));
    this.scene.fog = new FogExp2('#c9dfd9', 0.0018);
    this.scene.add(this.root, this.ambient, this.sun, this.sun.target);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -37, right: 37, top: 37, bottom: -37, near: 1, far: 180 });
    this.sun.shadow.bias = -0.0002; this.sun.shadow.normalBias = 0.035;
    const arrow = new BufferGeometry(); arrow.setAttribute('position', new Float32BufferAttribute([-0.55, 0, -0.05, 0, 0, 0.65, 0.55, 0, -0.05, -0.2, 0, -0.05, 0.2, 0, -0.05, -0.2, 0, -0.7, -0.2, 0, -0.7, 0.2, 0, -0.05, 0.2, 0, -0.7], 3)); arrow.computeVertexNormals();
    this.geometries = { box: new BoxGeometry(1, 1, 1), plane: new PlaneGeometry(1, 1), cylinder: new CylinderGeometry(1, 1, 1, 12), cone: new ConeGeometry(1, 1, 12), sphere: new SphereGeometry(1, 12, 8), ring: new RingGeometry(0.82, 1, 32), torus: new TorusGeometry(1, 0.08, 5, 24), arrow };
    const solid = new MeshStandardNodeMaterial({ roughness: 0.83, metalness: 0.03 });
    const roof = new MeshStandardNodeMaterial({ roughness: 0.95 });
    const cell = abs(fract(positionWorld.xz.div(3)).sub(0.5));
    const seam = float(1).sub(smoothstep(0.47, 0.49, min(cell.x, cell.y)));
    roof.colorNode = mix(color('#8eaa9f'), color('#a9bfae'), seam);
    this.materials = { solid, roof, glass: new MeshStandardNodeMaterial({ color: '#ffffff', metalness: 0.25, roughness: 0.26, emissive: '#5e8479', emissiveIntensity: 0.12 }), glow: new MeshBasicNodeMaterial({ color: '#ffffff', side: DoubleSide }), metal: new MeshStandardNodeMaterial({ color: '#ffffff', metalness: 0.35, roughness: 0.5 }) };
    if (!cityMode) { const ground = new Mesh(new PlaneGeometry(2200, 2200), new MeshStandardNodeMaterial({ color: '#5a727a', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; this.root.add(ground);
    const sea = new Mesh(new PlaneGeometry(2800, 1600), new MeshStandardNodeMaterial({ color: '#57aebb', roughness: 0.27, metalness: 0.25 })); sea.rotation.x = -Math.PI / 2; sea.position.set(180, -0.12, -1050); this.root.add(sea); }
  }
  private part(chunk: string, geometry: string, material: string, p: V3, s: V3, tint: string, yaw = 0, pitch = 0, roll = 0): void {
    let recipes = this.recipes.get(chunk); if (!recipes) this.recipes.set(chunk, recipes = new Map());
    const key = `${geometry}/${material}`; let parts = recipes.get(key); if (!parts) recipes.set(key, parts = []);
    parts.push({ p, s, color: tint, yaw, pitch, roll });
  }
  private architecture(roof: Roof): void {
    const c = roof.center, w = roof.width, d = roof.depth, random = seededRandom(this.route.seed ^ (roof.id + 1) * 17231), chunk = `${Math.floor(c.x / 124)},${Math.floor(c.z / 124)}`;
    const b = (p: V3, s: V3, tint: string, yaw = 0, material = 'solid', geometry = 'box', pitch = 0, roll = 0) => this.part(chunk, geometry, material, p, s, tint, yaw, pitch, roll);
    const base = PALETTE[Math.floor(roof.tint * PALETTE.length)]!;
    b(v3(c.x, c.y / 2 - 0.1, c.z), v3(w, c.y, d), base);
    b(v3(c.x, c.y + 0.03, c.z), v3(w - 0.65, 0.1, d - 0.65), '#c8d0bf', 0, 'roof');
    // Cornices, alternating facade bays, recessed windows, and slim rooftop lips give each tower a real silhouette.
    for (const sign of [-1, 1]) {
      b(v3(c.x, c.y + 0.13, c.z + sign * (d / 2 - 0.16)), v3(w, 0.24, 0.32), '#e5dfc9');
      b(v3(c.x + sign * (w / 2 - 0.16), c.y + 0.13, c.z), v3(0.32, 0.24, d), '#e5dfc9');
      for (let floor = 0; floor < 7 && 2.6+floor*3.45<c.y-1.5; floor++) {
        const y = 2.6 + floor * 3.45;
        b(v3(c.x, y - 1.2, c.z + sign * (d / 2 + 0.05)), v3(w + 0.45, 0.15, 0.5), '#f2e7cd');
        b(v3(c.x + sign * (w / 2 + 0.05), y - 1.2, c.z), v3(0.5, 0.15, d + 0.45), '#f2e7cd');
        for (let col = 0; col < 7; col++) {
          const offset = (col - 3) * 7.3, glass = random() > 0.25 ? '#38606b' : '#8fb8bc';
          b(v3(c.x + offset, y, c.z + sign * (d / 2 + 0.023)), v3(3.5, 1.95, 1), glass, sign > 0 ? 0 : Math.PI, 'glass', 'plane');
          b(v3(c.x + sign * (w / 2 + 0.023), y, c.z + offset), v3(3.5, 1.95, 1), glass, sign > 0 ? Math.PI / 2 : -Math.PI / 2, 'glass', 'plane');
          b(v3(c.x + offset, y, c.z + sign * (d / 2 + 0.04)), v3(0.09, 2.1, 0.08), '#d8dbc9');
        }
      }
    }
    // Roof access cabin with a projecting canopy, a recessed door, louvres and a glazed clerestory.
    const cabin = v3(c.x - 21, c.y, c.z + 22);
    b(add(cabin, v3(0, 1.6, 0)), v3(6.2, 3.2, 5.4), '#c8d1bd');
    b(add(cabin, v3(0, 3.23, 0)), v3(6.7, 0.2, 5.9), '#e1debf');
    b(add(cabin, v3(0, 1.2, 2.73)), v3(1.35, 2.4, 0.06), '#567970');
    b(add(cabin, v3(0.4, 1.25, 2.79)), v3(0.06, 0.3, 0.04), '#d4d8b9');
    b(add(cabin, v3(0, 2.8, 3.2)), v3(2.6, 0.12, 1.2), '#798f7d');
    b(add(cabin, v3(2, 2.1, 2.74)), v3(1.3, 0.7, 0.06), '#8fb4b4', 0, 'glass');
    for (let k = 0; k < 4; k++) b(v3(c.x + 13 + k * 3.3, c.y + 0.7, c.z - 18), v3(2.7, 0.13, 4), '#486e7d', 0, 'glass', 'box', -0.2);
    // Water tower with open steel legs and a conical roof.
    const tank = v3(c.x + 19.5, c.y, c.z + 18.5);
    for (const x of [-1, 1]) for (const z of [-1, 1]) { b(add(tank, v3(x * 1.2, 1.7, z * 1.2)), v3(0.18, 3.4, 0.18), '#627c7b', 0, 'metal'); b(add(tank, v3(x * 1.2, 1.8, 0)), v3(0.12, 0.12, 3.5), '#627c7b', 0, 'metal', 'box', z * 0.6); }
    b(add(tank, v3(0, 4.35, 0)), v3(1.85, 2.7, 1.85), roof.id % 2 ? '#d1a27c' : '#97b6b0', 0, 'metal', 'cylinder');
    b(add(tank, v3(0, 6.1, 0)), v3(2.1, 1.1, 2.1), '#7c8e82', 0, 'metal', 'cone');
    for (const y of [3.2, 4.4, 5.5]) b(add(tank, v3(0, y, 0)), v3(1.87, 0.07, 1.87), '#536a68', 0, 'metal', 'cylinder');
    for (let k = 0; k < 3; k++) {
      const p = v3(c.x - 19 + k * 5.6, c.y, c.z - 17.5);
      b(add(p, v3(0, 0.6, 0)), v3(3.6, 1.2, 2.3), '#d8ddd0');
      b(add(p, v3(0, 1.27, 0)), v3(0.82, 0.15, 0.82), '#526969', 0, 'metal', 'cylinder');
      for (let grille = 0; grille < 5; grille++) b(add(p, v3(-1.2 + grille * 0.55, 0.65, 1.17)), v3(0.14, 0.75, 0.05), '#788d87');
      b(add(p, v3(1.55, 0.65, -2.5)), v3(0.42, 3.1, 0.42), '#899e99', 0, 'metal', 'cylinder', Math.PI / 2);
    }
    // Clothesline and original, unbranded fabric patches.
    for (const x of [-6, 6]) b(v3(c.x - 13 + x, c.y + 1.9, c.z - 23), v3(0.07, 3.8, 0.07), '#6e8278', 0, 'metal');
    b(v3(c.x - 13, c.y + 3.5, c.z - 23), v3(12, 0.028, 0.028), '#6a7f71');
    for (let k = 0; k < 6; k++) b(v3(c.x - 17.6 + k * 1.8, c.y + 2.9, c.z - 23), v3(1.15, 1.2, 0.025), ['#efb59b', '#b7d6c7', '#f0e4b5'][k % 3]!, 0.07 * (k % 2 ? 1 : -1));
    // Exterior fire-escape landings, rails and ladders, visible down the facade.
    for (let floor = 1; floor <= 5 && floor*4.3<c.y-1; floor++) {
      const y = floor * 4.3, x = c.x - w / 2 - 0.8, z = c.z - 8;
      b(v3(x, y, z), v3(2.1, 0.12, 6.2), '#6a7770', 0, 'metal');
      for (const edge of [-1, 1]) { b(v3(x + edge * 0.95, y + 0.9, z), v3(0.06, 0.06, 6), '#5c716b'); for (let post = -2; post <= 2; post++) b(v3(x + edge * 0.95, y + 0.45, z + post), v3(0.05, 0.9, 0.05), '#5c716b'); }
      for (const edge of [-1, 1]) b(v3(x + edge * 0.42, y - 1.8, z + 2), v3(0.06, 4.3, 0.06), '#5c716b');
      for (let rung = 0; rung < 10; rung++) b(v3(x, y - rung * 0.42, z + 2), v3(0.95, 0.05, 0.08), '#6f8275');
    }
  }
  async build(): Promise<void> {
    let slice = performance.now();
    for (const roof of this.route.roofs) { this.architecture(roof); if (performance.now() - slice > 4) { await nextFrame(); slice = performance.now(); } }
    if (!this.cityMode) this.addSkyline(); this.addRoutePaint(); this.addSlabs();
    const bakedMaterials: Record<string, Material> = { solid: new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.82 }), roof: (this.materials.roof as MeshStandardNodeMaterial).clone(), glass: (this.materials.glass as MeshStandardNodeMaterial).clone(), glow: new MeshBasicNodeMaterial({ vertexColors: true, side: DoubleSide }) };
    (bakedMaterials.roof as MeshStandardNodeMaterial).vertexColors = true; (bakedMaterials.glass as MeshStandardNodeMaterial).vertexColors = true;
    this.materials.bakedGlass = bakedMaterials.glass!;
    for (const [key, recipes] of this.recipes) {
      const group = new Group(); this.root.add(group); const batches = new Map<string, BakePart[]>();
      for (const [kind, parts] of recipes) { const [geometry, material] = kind.split('/'), family = material === 'metal' ? 'solid' : material!; let list = batches.get(family); if (!list) batches.set(family, list = []); list.push(...parts.map(p => ({ ...p, geometry: geometry! }))); }
      for (const [family, parts] of batches) { const mesh = new Mesh(bakeParts(parts, this.geometries), bakedMaterials[family]!); mesh.castShadow = family === 'solid'; mesh.receiveShadow = family === 'roof'; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; group.add(mesh); }
      const [x,z] = key.split(',').map(Number); this.chunks.push({ root: group, center: new Vector3(x! * 124 + 62, 20, z! * 124 + 62) }); await nextFrame();
    }
    this.coarse = new StableInstances(this.geometries.box!, this.materials.solid!, this.route.roofs.length);
    const temp = this.tempObject, tint = new Color();
    for (let i=0;i<this.route.roofs.length;i++) { const r=this.route.roofs[i]!; temp.position.set(r.center.x,r.center.y/2,r.center.z); temp.scale.set(r.width,r.center.y,r.depth); temp.rotation.set(0,0,0); temp.updateMatrix(); this.coarse.setMatrixAt(i,temp.matrix); this.coarse.setColorAt(i,tint.set(PALETTE[Math.floor(r.tint*PALETTE.length)]!)); } this.coarse.computeBoundingSphere();this.root.add(this.coarse);
    this.recipes.clear(); this.addInteractions(); this.addPickups(); this.addHazards(); this.addCheckpoint(); this.addFinish();
    await this.loadCar(); this.groupStaticExtras(); this.built = true;
  }
  private addSkyline(): void {
    const random = seededRandom(this.route.seed ^ 9912);
    const centers = this.route.roofs.map(r => r.center), minX = Math.min(...centers.map(c => c.x)), maxX = Math.max(...centers.map(c => c.x)), minZ = Math.min(...centers.map(c => c.z)), maxZ = Math.max(...centers.map(c => c.z));
    for (let i = 0; i < 54; i++) {
      const angle = i / 54 * Math.PI * 2, radius = 450 + random() * 240, x = (minX + maxX) / 2 + Math.sin(angle) * radius, z = (minZ + maxZ) / 2 + Math.cos(angle) * radius, h = 35 + random() ** 1.5 * 120, w = 18 + random() * 28;
      this.part('skyline', 'box', 'solid', v3(x, h / 2, z), v3(w, h, w * 0.8), ['#82a6ac', '#b2bba9', '#779fae'][i % 3]!, 0, 0, 0);
      this.part('skyline', 'box', 'solid', v3(x, h + 4, z), v3(w * 0.7, 8, w * 0.55), '#b3c8c0', 0, 0, 0);
      for (let band = 8; band < h; band += 6) for (const sign of [-1, 1]) {
        this.part('skyline', 'box', 'glass', v3(x, band, z + sign * (w * 0.4 + 0.03)), v3(w * 0.86, 1.8, 0.04), '#4c7c91', 0, 0, 0);
        this.part('skyline', 'box', 'glass', v3(x + sign * (w * 0.5 + 0.03), band, z), v3(0.04, 1.8, w * 0.68), '#4c7c91', 0, 0, 0);
      }
      if (i % 4 === 0) this.part('skyline', 'cylinder', 'solid', v3(x, h + 16, z), v3(0.3, 20, 0.3), '#819a9a', 0, 0, 0);
    }
    // Broad perimeter streets and crosswalks, including the street receiving the reward car.
    const streetColor = '#edf0ce';
    for (const z of [minZ - 38, maxZ + 38]) for (let x = minX - 40; x < maxX + 45; x += 12) this.part('streets', 'box', 'solid', v3(x, 0.01, z), v3(6, 0.04, 0.16), streetColor, 0, 0, 0);
    for (const x of [minX - 38, maxX + 38]) for (let z = minZ - 40; z < maxZ + 45; z += 12) this.part('streets', 'box', 'solid', v3(x, 0.01, z), v3(0.16, 0.04, 6), streetColor, 0, 0, 0);
    // Eight-metre street lamps, coastal palms, curbs and crossings read clearly on the final camera flight.
    const avenue = (x: number, z: number, yaw: number) => {
      this.part('streets', 'cylinder', 'metal', v3(x, 4, z), v3(0.1, 8, 0.1), '#688480', 0, 0, 0);
      this.part('streets', 'box', 'solid', v3(x + Math.cos(yaw), 7.95, z + Math.sin(yaw)), v3(2.2, 0.1, 0.1), '#6a8178', -yaw, 0, 0);
      this.part('streets', 'sphere', 'glow', v3(x + Math.cos(yaw) * 2, 7.85, z + Math.sin(yaw) * 2), v3(0.3, 0.08, 0.22), '#efe3b1', 0, 0, 0);
      const px = x + 7, pz = z + 4;
      this.part('streets', 'cylinder', 'solid', v3(px, 4.5, pz), v3(0.23, 9, 0.23), '#a99b73', 0, 0, -0.04);
      for (let leaf = 0; leaf < 7; leaf++) this.part('streets', 'arrow', 'solid', v3(px, 9, pz), v3(1.8, 1, 5), '#5e967e', leaf / 7 * Math.PI * 2, -0.25, 0);
    };
    for (let x = minX - 12; x < maxX + 20; x += 75) for (const z of [minZ - 47, maxZ + 47]) avenue(x, z, 0);
    for (let z = minZ + 20; z < maxZ; z += 75) for (const x of [minX - 47, maxX + 47]) avenue(x, z, Math.PI / 2);
    for (const z of [minZ - 48, maxZ + 48]) this.part('streets', 'box', 'solid', v3((minX + maxX) / 2, 0.06, z), v3(maxX - minX + 110, 0.16, 1.8), '#b8c2b2', 0, 0, 0);
    for (const x of [minX - 48, maxX + 48]) this.part('streets', 'box', 'solid', v3(x, 0.06, (minZ + maxZ) / 2), v3(1.8, 0.16, maxZ - minZ + 110), '#b8c2b2', 0, 0, 0);
    for (const x of [minX - 38, maxX + 38]) for (const z of [minZ - 38, maxZ + 38]) for (let k = -3; k <= 3; k++) this.part('streets', 'box', 'solid', v3(x + k * 0.9, 0.04, z), v3(0.4, 0.05, 5.2), '#e7e8cb', 0, 0, 0);
    // Distant clouds are actual softly lit low-poly forms, not a sky photograph.
    for (let i = 0; i < 14; i++) for (let k = 0; k < 3; k++) this.part('skyline', 'sphere', 'solid', v3(minX - 200 + random() * 950 + k * 18, 150 + random() * 50, minZ - 280 + i * 55), v3(30, 5, 10), '#edf1db', 0, 0, 0);
  }
  private addRoutePaint(): void {
    for (let i = 1; i < this.route.nav.length; i++) {
      const a = this.route.nav[i - 1]!, b = this.route.nav[i]!, length = horizontal(a.position, b.position), d = direction(a.position, b.position);
      if (a.action === 'jump' || length < 3) continue;
      for (let t = 3; t < length - 0.8; t += 6) { const p = add(a.position, d, t); p.y += 0.06 + (b.position.y - a.position.y) * t / length; this.part(`${Math.floor(p.x / 124)},${Math.floor(p.z / 124)}`, 'arrow', 'glow', p, v3(1.4, 1, 1.4), '#dbed94', Math.atan2(d.x, d.z), 0, 0); }
    }
    for (const cp of this.route.checkpoints) this.part(`${Math.floor(cp.position.x / 124)},${Math.floor(cp.position.z / 124)}`, 'ring', 'glow', add(cp.position, v3(0, 0.055, 0)), v3(2.7, 2.7, 2.7), '#d3ef97', 0, -Math.PI / 2, 0);
    for (const j of this.route.jumps) for (const p of [j.from, j.to]) this.part(`${Math.floor(p.x / 124)},${Math.floor(p.z / 124)}`, 'box', 'glow', add(p, v3(0, 0.06, 0)), v3(3.2, 0.07, 0.32), j.branch === 'safe' ? '#defc99' : '#f2a470', Math.atan2(j.to.x - j.from.x, j.to.z - j.from.z), 0, 0);
  }
  private mesh(geo: Geometry, tint: string, basic = false): Mesh {
    const key = `${basic}/${tint}`; let mat = this.materialCache.get(key); if (!mat) { mat = basic ? new MeshBasicNodeMaterial({ color: tint, side: DoubleSide }) : new MeshStandardNodeMaterial({ color: tint, roughness: 0.65, metalness: 0.15 }); this.materialCache.set(key, mat); }
    const mesh = new Mesh(geo, mat); this.disposables.push(mat); return mesh;
  }
  private addSlabs(): void {
    for (const slab of this.route.slabs) {
      const group = new Group(), tint = slab.safe ? '#bfcbb8' : slab.kind === 'vent' ? '#c8d6c6' : slab.kind === 'crumbling' ? '#e7af83' : '#e9cb77';
      if (!slab.dynamic) {
        const key = `${Math.floor(slab.center.x / 124)},${Math.floor(slab.center.z / 124)}`;
        this.part(key, 'box', 'solid', slab.center, slab.size, tint, slab.yaw, slab.pitch, slab.roll);
        const pose = new Object3D(); pose.rotation.set(slab.pitch, slab.yaw, slab.roll, 'YXZ');
        for (const sign of [-1, 1]) { const offset = new Vector3(sign * (slab.size.x / 2 - 0.06), slab.size.y / 2 + 0.025, 0).applyQuaternion(pose.quaternion); this.part(key, 'box', 'solid', add(slab.center, offset), v3(0.08, 0.03, slab.size.z), slab.safe ? '#dbeeb2' : '#5d6b67', slab.yaw, slab.pitch, slab.roll); }
        if (slab.kind === 'vent') for (let k = -2; k <= 2; k++) { const offset = new Vector3(0, slab.size.y / 2 + 0.025, k * slab.size.z / 6).applyQuaternion(pose.quaternion); this.part(key, 'box', 'metal', add(slab.center, offset), v3(slab.size.x * 0.75, 0.04, 0.08), '#7e9389', slab.yaw, slab.pitch, slab.roll); }
        continue;
      }

      const mesh = this.mesh(this.geometries.box!, tint); mesh.scale.copy(slab.size); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      for (const sign of [-1, 1]) { const strip = this.mesh(this.geometries.box!, slab.safe ? '#dbeeb2' : '#5d6b67'); strip.scale.set(0.08, 0.03, slab.size.z); strip.position.set(sign * (slab.size.x / 2 - 0.06), slab.size.y / 2 + 0.025, 0); group.add(strip); }
      if (slab.kind === 'vent') for (let k = -2; k <= 2; k++) { const fin = this.mesh(this.geometries.box!, '#7e9389'); fin.scale.set(slab.size.x * 0.75, 0.045, 0.08); fin.position.set(0, slab.size.y / 2 + 0.01, k * slab.size.z / 6); group.add(fin); }
      if (slab.kind === 'crumbling') for (const angle of [-0.3, 0.5]) { const crack = this.mesh(this.geometries.box!, '#846b58'); crack.scale.set(0.035, 0.018, slab.size.z * 0.8); crack.position.y = slab.size.y / 2 + 0.025; crack.rotation.y = angle; group.add(crack); }
      group.position.copy(slab.center); group.rotation.set(slab.pitch, slab.yaw, slab.roll, 'YXZ'); this.root.add(group);
      if (slab.dynamic) this.dynamicMeshes.set(slab.id, group);
    }
  }
  private cable(a: V3, b: V3, tint = '#587778', radius = 0.025): Mesh {
    const delta = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z), m = this.mesh(this.geometries.cylinder!, tint); m.scale.set(radius, delta.length(), radius); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()); return m;
  }
  private addInteractions(): void {
    for (const i of this.route.interactions) {
      const a = add(i.start, v3(0, 3.5, 0)), b = add(i.end, v3(0, 3.5, 0));
      this.root.add(this.cable(a, b));
      for (const p of [i.start, i.end]) this.root.add(this.cable(p, add(p, v3(0, 4.2, 0)), '#edb96d', 0.095));
      const handle = this.mesh(this.geometries.torus!, '#e9b45d'); handle.position.copy(add(i.start, v3(0, 2.5, 0))); handle.scale.setScalar(0.35); this.root.add(handle);
      if (i.type === 'swing') for (let k = 1; k < 6; k++) { const t = k / 6, cloth = this.mesh(this.geometries.box!, ['#dfae91', '#b8cbb7', '#e7d9b6'][k % 3]!); cloth.position.set(a.x + (b.x - a.x) * t, a.y - 0.4, a.z + (b.z - a.z) * t); cloth.scale.set(0.7, 0.85, 0.03); cloth.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); this.root.add(cloth); }
    }
    for (const e of this.route.encounters) if (e.type === 'crane') {
      const base = add(e.position, v3(e.direction.z, 0, -e.direction.x), -5), top = add(base, v3(0, 13, 0));
      for (const side of [-1, 1]) this.root.add(this.cable(add(base, v3(side * 0.7, -base.y, 0)), add(top, v3(side * 0.7, 0, 0)), '#d1a855', 0.12));
      const arm = this.cable(add(top, e.direction, -8), add(top, e.direction, 14), '#edc06a', 0.2); this.root.add(arm); this.root.add(this.cable(add(top, e.direction, 11), add(e.position, e.direction, 3), '#81918b', 0.025));
    }
  }
  private addPickups(): void {
    const colors = { coin: '#ffc36c', time: '#a0e9df', double: '#d5b4ff', slow: '#89c8ff', speed: '#ffa979', magnet: '#ff91bb' };
    this.pickupRings = new StableInstances(this.geometries.torus!, new MeshBasicNodeMaterial({ color: '#ffffff' }), this.route.pickups.length);
    this.pickupCores = new StableInstances(this.geometries.cylinder!, new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.15 }), this.route.pickups.length);
    const tint = new Color(); for (let i=0;i<this.route.pickups.length;i++) { const p=this.route.pickups[i]!; this.pickupRings.setColorAt(i,tint.set(colors[p.type])); this.pickupCores.setColorAt(i,tint); }
    this.pickupRings.frustumCulled = this.pickupCores.frustumCulled = false; this.root.add(this.pickupRings,this.pickupCores);

  }
  private addHazards(): void {
    for (const h of this.route.hazards) {
      const g = new Group();
      if (h.type === 'rolling') { const ball = this.mesh(this.geometries.sphere!, '#657e7d'); ball.scale.setScalar(0.8); g.add(ball); const band = this.mesh(this.geometries.torus!, '#f0b26d'); band.scale.setScalar(0.79); g.add(band); }
      if (h.type === 'laser') { for (const s of [-1, 1]) { const post = this.mesh(this.geometries.box!, '#667d7a'); post.position.set(s * 3.1, 0, 0); post.scale.set(0.18, 2.2, 0.24); g.add(post); } const laser = this.mesh(this.geometries.box!, '#ff866e', true); laser.scale.set(6.2, 0.045, 0.045); g.add(laser); }
      if (h.type === 'drone') { const body = this.mesh(this.geometries.sphere!, '#657675'); body.scale.set(0.48, 0.2, 0.4); g.add(body); for (const x of [-1, 1]) for (const z of [-1, 1]) { const rotor = this.mesh(this.geometries.torus!, '#d9ebad'); rotor.scale.setScalar(0.32); rotor.rotation.x = Math.PI / 2; rotor.position.set(x * 0.52, 0, z * 0.45); g.add(rotor); } }
      if (h.type === 'wind') for (let i = 0; i < 7; i++) { const streak = this.mesh(this.geometries.box!, '#d8edcf', true); streak.scale.set(2.7, 0.025, 0.03); streak.position.set((i % 3 - 1) * 2, 0.5 + i * 0.3, i - 3); g.add(streak); }
      this.hazardMeshes.set(h.id, g); this.root.add(g);
    }
  }
  private addCheckpoint(): void {
    for (const radius of [1.8, 2.1]) { const ring = this.mesh(new TorusGeometry(radius, 0.035, 5, 48), '#e0ff9f', true); ring.rotation.x = Math.PI / 2; this.nextCheckpoint.add(ring); }
    for (const x of [-1, 1]) { const post = this.mesh(this.geometries.box!, '#dfff9a', true); post.scale.set(0.06, 2, 0.06); post.position.set(x * 2.5, 1, 0); this.nextCheckpoint.add(post); }
    this.root.add(this.nextCheckpoint);
  }
  private billboard(position: V3, yaw: number, text: string, large = false): void {
    const group = new Group(), w = large ? 16 : 9, h = large ? 7 : 4.4;
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512; const c = canvas.getContext('2d')!;
    c.fillStyle = '#264e4a'; c.fillRect(0, 0, 1024, 512); c.fillStyle = '#dfff9a'; c.fillRect(36, 38, 44, 5); c.font = '500 24px sans-serif'; c.fillText('CROSSTOWN / CITY IN MOTION', 104, 50); c.font = '900 116px sans-serif'; c.fillStyle = '#f4eedb'; text.split('|').forEach((line, i) => c.fillText(line, 55, 214 + i * 121)); c.font = '500 23px sans-serif'; c.fillStyle = '#b5cabb'; c.fillText('TAKE THE HIGH LINE.     ↗', 55, 464);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; this.disposables.push(texture);
    // Own a direct texture node. In r180, a newly rebuilt .map material can reuse
    // an initially-null material-reference binding during compileAsync: the node
    // value is current but the cached sampled binding is still null. Explicit
    // texture ownership avoids that stale reference without skipping compilation.
    const material = new MeshBasicNodeMaterial({ side: DoubleSide });
    material.colorNode = textureNode(texture);
    const panel = new Mesh(new PlaneGeometry(w, h), material); group.add(panel);
    const back = this.mesh(this.geometries.box!, '#587773'); back.scale.set(w + 0.3, h + 0.3, 0.28); back.position.z = -0.18; group.add(back);
    for (const x of [-w * 0.34, w * 0.34]) { const leg = this.mesh(this.geometries.box!, '#59736c'); leg.scale.set(0.22, 4.8, 0.22); leg.position.set(x, -h / 2 - 2, 0); group.add(leg); }
    group.position.copy(position); group.rotation.y = yaw; this.root.add(group);
  }
  private addFinish(): void {
    const f = this.route.goal, d = this.route.checkpoints[this.route.checkpoints.length - 1]!.direction;
    this.billboard(add(add(f, d, 3.5), v3(0, 8.5, 0)), Math.atan2(-d.x, -d.z), 'ABOVE|IT ALL.', true);
    for (const roof of this.route.roofs) if (roof.id % 9 === 3) this.billboard(add(roof.center, v3(-19, 6.5, -19)), Math.PI * 0.1, ['STAY|CURIOUS.', 'FIND YOUR|HIGH LINE.', 'MORE SKY.|LESS LIMIT.'][Math.floor(roof.id / 9) % 3]!);
    const beam = this.mesh(this.geometries.cylinder!, '#e1ffab', true); beam.scale.set(0.09, 65, 0.09); beam.position.y = 32; this.goalBeam.add(beam);
    const ring = this.mesh(new TorusGeometry(2.3, 0.09, 6, 48), '#e1ffab', true); ring.rotation.x = Math.PI / 2; this.goalBeam.add(ring); this.goalBeam.position.copy(f); this.root.add(this.goalBeam);
    const pointer = this.mesh(new ConeGeometry(0.75, 1.5, 4), '#e1ff9e', true); pointer.rotation.z = Math.PI; this.carArrow.add(pointer); this.carArrow.position.copy(this.route.carPosition); this.carArrow.position.y = 5; this.carArrow.visible = false; this.root.add(this.carArrow);
    // Recycled first-party particles: deterministic fireworks without textures, audio files or per-frame allocation.
    const random = seededRandom(this.route.seed ^ 137);
    for (let i = 0; i < 90; i++) { const particle = this.mesh(this.geometries.sphere!, ['#e7ffad', '#ffc090', '#b6edee'][i % 3]!, true); particle.scale.setScalar(0.1 + random() * 0.09); particle.userData = { vx: (random() - 0.5) * 22, vy: (random() - 0.2) * 20, vz: (random() - 0.5) * 22, delay: Math.floor(i / 30) * 0.7 }; particle.visible = false; this.fireworks.push(particle); }
    this.fireworkBatch = new StableInstances(this.geometries.sphere!, new MeshBasicNodeMaterial({color:'#ffffff'}),90); const tint=new Color(); this.fireworks.forEach((p,i)=>this.fireworkBatch!.setColorAt(i,tint.copy((p.material as MeshBasicNodeMaterial).color)));this.fireworkBatch.frustumCulled=false;this.fireworkBatch.visible=false;this.root.add(this.fireworkBatch);
  }
  private async loadCar(): Promise<void> {
    try { const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/test-car.glb'); this.car.add(gltf.scene); gltf.scene.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } }); }
    catch { const chassis = this.mesh(new BoxGeometry(1.8, 0.6, 4.1), '#eaa27c'); chassis.position.y = 0.7; this.car.add(chassis); const cabin = this.mesh(new BoxGeometry(1.55, 0.7, 1.9), '#b7d0c1'); cabin.position.y = 1.25; this.car.add(cabin); for (const x of [-0.9, 0.9]) for (const z of [-1.2, 1.2]) { const wheel = this.mesh(new CylinderGeometry(0.34, 0.34, 0.2, 12), '#425958'); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.36, z); this.car.add(wheel); } }
    this.car.position.copy(this.route.carPosition); this.root.add(this.car);
  }
  private groupStaticExtras(): void {
    const groups=new Map<string,Group>();for(const o of [...this.root.children]) { if(!(o instanceof Mesh)||o===this.coarse||o===this.pickupRings||o===this.pickupCores||o===this.fireworkBatch)continue;const key=`${Math.floor(o.position.x/124)},${Math.floor(o.position.z/124)}`;let group=groups.get(key);if(!group){group=new Group();groups.set(key,group);this.root.add(group);}group.add(o);o.updateMatrix();o.matrixAutoUpdate=false; }
    for(const[key,root]of groups){const[x,z]=key.split(',').map(Number);this.staticExtras.push({root,center:new Vector3(x!*124+62,20,z!*124+62)});}
  }
  applyDay(night: number): void { for(const key of ['glass','bakedGlass']) { const mat=this.materials[key] as MeshStandardNodeMaterial|undefined;if(mat){mat.emissive.set('#efcc8a');mat.emissiveIntensity=0.08+night*1.3;} } }
  setNight(night: boolean): void {
    if (this.night === night) return; this.night = night;
    this.scene.backgroundNode = night ? mix(color('#121f43'), color('#775773'), smoothstep(0, 0.9, screenUV.y)) : mix(color('#87c7e5'), color('#ecf0d9'), smoothstep(0, 0.86, screenUV.y));
    this.scene.fog = new FogExp2(night ? '#38445f' : '#c9dfd9', night ? 0.0025 : 0.0018);
    this.ambient.intensity = night ? 1.1 : 1.7; this.sun.intensity = night ? 0.75 : 2.9; this.sun.color.set(night ? '#b4c7ef' : '#ffe6b2');
    (this.materials.glass as MeshStandardNodeMaterial).emissive.set(night ? '#f2cb87' : '#5e8479'); (this.materials.glass as MeshStandardNodeMaterial).emissiveIntensity = night ? 1.5 : 0.12;
  }
  update(run: ParkourRun, time: number, reducedMotion = false, anchor: V3 = run.player.position): void {
    const p = anchor;
    for (const chunk of this.chunks) chunk.root.visible = !Number.isFinite(chunk.center.x) || horizontal(p, chunk.center) < this.viewDistance;
    for (const chunk of this.staticExtras) chunk.root.visible = horizontal(p,chunk.center) < this.viewDistance + 45;
    if (this.coarse) { const temp=this.tempObject; for(let i=0;i<this.route.roofs.length;i++){const r=this.route.roofs[i]!,cx=Math.floor(r.center.x/124)*124+62,cz=Math.floor(r.center.z/124)*124+62,show=Math.hypot(p.x-cx,p.z-cz)>=this.viewDistance;temp.position.set(r.center.x,r.center.y/2,r.center.z);temp.rotation.set(0,0,0);temp.scale.set(show?r.width:0,show?r.center.y:0,show?r.depth:0);temp.updateMatrix();this.coarse.setMatrixAt(i,temp.matrix);}this.coarse.instanceMatrix.needsUpdate=true; }
    if (run.checkpoint !== this.lastCheckpoint) { this.lastCheckpoint = run.checkpoint; const cp = this.route.checkpoints[run.checkpoint + 1]; this.nextCheckpoint.visible = !!cp; if (cp) this.nextCheckpoint.position.copy(add(cp.position, v3(0, 0.12, 0))); }
    this.nextCheckpoint.rotation.y = time * 0.2;
    if (!this.externalLighting) { this.sun.position.set(p.x - 45, p.y + 75, p.z - 32); this.sun.target.position.set(p.x, p.y, p.z); }
    for (const [id, group] of this.dynamicMeshes) { const pose = run.stage.poses.get(id); if (pose) { group.position.copy(pose.position); group.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ'); } group.visible = horizontal(p, group.position) < this.viewDistance; }
    if (this.pickupRings && this.pickupCores) { const temp=this.tempObject; for(let i=0;i<this.route.pickups.length;i++) { const pickup=this.route.pickups[i]!,visible=!run.collected.has(pickup.id)&&horizontal(p,pickup.position)<85,point=run.pickupPositions.get(pickup.id)??pickup.position,scale=visible?(pickup.type==='coin'?0.25:0.42):0;temp.position.set(point.x,point.y+1.05+Math.sin(time*2.2+i)*0.12,point.z);temp.rotation.set(0,time*1.5,0);temp.scale.setScalar(scale);temp.updateMatrix();this.pickupRings.setMatrixAt(i,temp.matrix);temp.scale.set(scale*0.6,scale*0.15,scale*0.6);temp.updateMatrix();this.pickupCores.setMatrixAt(i,temp.matrix); } this.pickupRings.instanceMatrix.needsUpdate=this.pickupCores.instanceMatrix.needsUpdate=true; }

    for (const h of this.route.hazards) { const mesh = this.hazardMeshes.get(h.id)!; mesh.position.copy(hazardPosition(h, run.stage.time)); mesh.visible = horizontal(p, h.center) < 110; mesh.rotation.y = Math.atan2(h.direction.x, h.direction.z); if (h.type === 'rolling') mesh.rotation.x = run.stage.time * 3; if (h.type === 'drone') mesh.rotation.z = Math.sin(run.stage.time * 3) * 0.15; if (h.type === 'wind') { mesh.scale.x = 1 + Math.max(0, Math.sin(run.stage.time * h.speed + h.phase)); mesh.visible &&= Math.sin(run.stage.time * h.speed + h.phase) > 0; } }
    this.carArrow.visible = run.store.data.car; this.carArrow.position.set(this.route.carPosition.x, this.route.carPosition.y + 5.5 + Math.sin(time * 2) * 0.5, this.route.carPosition.z); this.carArrow.rotation.y = time * 0.6;
    if (!this.externalLighting) this.setNight(run.night);
    let anyFireworks=false; let particleIndex=0; for (const particle of this.fireworks) { const t = (run.finishTime - particle.userData.delay) % 3.3; particle.visible = run.state === 'finished' && run.finishTime < 9 && (!reducedMotion || particle.id % 4 === 0) && t > 0 && t < 2.7; if (particle.visible) particle.position.set(this.route.goal.x + particle.userData.vx * t, this.route.goal.y + 19 + particle.userData.vy * t - 4 * t * t, this.route.goal.z + particle.userData.vz * t); anyFireworks ||= particle.visible; const temp=this.tempObject;temp.position.copy(particle.position);temp.rotation.set(0,0,0);temp.scale.copy(particle.scale).multiplyScalar(particle.visible?1:0);temp.updateMatrix();this.fireworkBatch?.setMatrixAt(particleIndex++,temp.matrix); } if(this.fireworkBatch){this.fireworkBatch.visible=anyFireworks;this.fireworkBatch.instanceMatrix.needsUpdate=anyFireworks;}
  }
  applyQuality(tier: QualityTier): void { this.viewDistance = Math.min(180, tier.viewDistance * 0.65 + 25); this.sun.castShadow = tier.shadows; if (this.sun.shadow.mapSize.x !== tier.shadowMapSize) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize); } }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    // This root owns the rooftop assets, not whatever else shares its Scene.
    // Include cached, currently unparented templates and deduplicate textures.
    const owned = new Set<{ dispose(): void }>([...Object.values(this.geometries), ...Object.values(this.materials), ...this.materialCache.values(), ...this.disposables]);
    this.root.traverse(o => { if (o instanceof Mesh) { owned.add(o.geometry); for (const material of Array.isArray(o.material) ? o.material : [o.material]) owned.add(material); } });
    for (const resource of [...owned]) if (resource instanceof MeshStandardNodeMaterial || resource instanceof MeshBasicNodeMaterial || (resource as Material).isMaterial) for (const value of Object.values(resource)) if (value instanceof Texture) owned.add(value);
    for (const resource of owned) resource.dispose(); this.sun.dispose();
    this.root.removeFromParent(); this.root.clear(); this.disposables = []; this.materialCache.clear(); this.built = false;
  }
}
