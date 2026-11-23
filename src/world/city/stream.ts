import {CityLights} from '../../rendering/city-lights';
import type {EffectFlags}from'../../config/quality';
import { StableInstances } from '../../rendering/instances';
// Worker generation + small, measured installation slices. Far terrain/impostors always cover the complete 4 km map.
import {
  Scene,
  Group,
  Mesh,
  InstancedMesh,
  BatchedMesh,
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  BufferGeometry,
  BufferAttribute,
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  Color,
  Object3D,
  CanvasTexture,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three/webgpu";
import {
  uniform,
  fwidth,
  positionWorld,
  fract,
  smoothstep,
  abs,
  normalWorld,
  color,
  mix,
  float,
} from "three/tsl";
import { CITY, type ChunkData, type MeshData, type CityLayout } from "./types";
import { CityWorker } from "./worker";
import type { CityEnvironment } from "./environment";
import type { QualityTier } from "../../config/quality";
import { CityPhysics } from "./physics";
import { districtAt, terrainHeightAt } from "./layout";
import { type V3 } from "../../parkour/types";
import { SaveStore } from "../../save";
import { bakeParts, type BakePart } from "../bake";
interface LiveChunk {
  data: ChunkData;
  root: Group;
  distance: number;
}
export class CityStream {
  readonly root = new Group();
  readonly chunks = new Map<string, LiveChunk>();
  readonly worker = new CityWorker();
  readonly physics = new CityPhysics();
  layout!: CityLayout;
  readonly anchor = uniform(new Vector3());
  ready = false;
  maxInstallMs = 0;
  maximumChunkCpuMs = 0;
  maximumUpdateMs = 0;
  coldPrimeMs = 0;
  private job?: {
    data: ChunkData;
    steps: Generator<string, void, unknown>;
    cpuMs: number;
  };
  installSamples: number[] = [];
  private phases: Record<string, { maximumMs: number; slices: number }> = {};
  private outliers: { chunk: string; phase: string; ms: number }[] = [];
  private disposed = false;
  private queue: ChunkData[] = [];
  private pending = new Set<string>();
  private cache = new Map<string, ChunkData>();
  private retired = new Map<string, LiveChunk>();
  private impostors?: InstancedMesh;
  private impostorData: Float32Array = new Float32Array();
  private impostorChunks = new Map<string, number[]>();
  private materials: Material[] = [];
  private buildingMaterial: MeshStandardNodeMaterial;
  private solidMaterial: MeshStandardNodeMaterial;
  private terrainMaterial: MeshStandardNodeMaterial;
  private detailMaterial: MeshStandardNodeMaterial;
  private farMaterial: MeshStandardNodeMaterial;
  private box = new BoxGeometry(1, 1, 1);
  private cylinder = new CylinderGeometry(1, 1, 1, 8);
  private cone = new ConeGeometry(1, 1, 6);
  private ramp = makeRamp();
  private luminaires:CityLights;private windowsEnabled=true;private windowMask: ReturnType<typeof float>;
  private caches?: InstancedMesh;
  private citySave = new SaveStore("crosstown:city:v1");
  private collected: Set<string>;
  private temp = new Object3D();
  private tint = new Color();
  private radius = 2; private shadows = true;
  private lastRequest = 0;
  private movers: BatchedMesh;
  private trafficIds: number[] = [];
  private boatIds: number[] = [];
  private aircraftIds: number[] = [];
  private rain: InstancedMesh;
  private moverTime = 0;
  private skySigns: Group = new Group();
  constructor(
    readonly scene: Scene,
    readonly environment: CityEnvironment,
  ) {
    const stored = this.citySave.read<unknown>([]);
    this.collected = new Set(
      Array.isArray(stored)
        ? stored.filter((id) => typeof id === "string").slice(0, 100)
        : [],
    );
    scene.add(this.root);
    this.root.name = "Crosstown streamed city";
    this.solidMaterial = new MeshStandardNodeMaterial({ roughness: 0.86 });
    this.terrainMaterial = new MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: 0.96,
    });
    // One facade program replaces thousands of separate window meshes. Actual building volumes remain intact.
    const vertical = abs(normalWorld.y).lessThan(0.35),
      columns = smoothstep(
        0.16,
        0.21,
        fract(positionWorld.x.add(positionWorld.z).div(3.4)),
      ).mul(
        float(1).sub(
          smoothstep(
            0.76,
            0.82,
            fract(positionWorld.x.add(positionWorld.z).div(3.4)),
          ),
        ),
      );
    const rows = smoothstep(0.18, 0.24, fract(positionWorld.y.div(3.4))).mul(
        float(1).sub(smoothstep(0.67, 0.73, fract(positionWorld.y.div(3.4)))),
      ),
      windows = columns.mul(rows).mul(vertical).mul(smoothstep(.65,.12,fwidth(positionWorld.y.div(3.4))));
    this.windowMask=windows;
    this.buildingMaterial = new MeshStandardNodeMaterial({
      roughness: 0.65,
      metalness: 0.1,
    });
    this.buildingMaterial.colorNode = mix(
      color("#ffffff"),
      mix(color("#4c7581"), color("#e2cc92"), environment.night),
      windows.mul(0.8),
    );
    this.buildingMaterial.emissiveNode = color("#edce8e")
      .mul(windows)
      .mul(environment.night)
      .mul(1.15);
    this.detailMaterial = new MeshStandardNodeMaterial({
      roughness: 0.72,
      vertexColors: true,
      alphaHash: true,
    });
    this.detailMaterial.opacityNode = smoothstep(
      335,
      200,
      positionWorld.xz.sub(this.anchor.xz).length(),
    );
    this.detailMaterial.emissiveNode = color("#baa66b")
      .mul(environment.night)
      .mul(0.12);
    this.farMaterial = new MeshStandardNodeMaterial({
      roughness: 0.85,
      metalness: 0.03,
    });
    this.farMaterial.colorNode = mix(
      color("#ffffff"),
      mix(color("#4f7480"), color("#e2cc92"), environment.night),
      windows.mul(0.8),
    );
    this.farMaterial.emissiveNode = color("#e2c98e")
      .mul(windows)
      .mul(environment.night)
      .mul(0.65);
    this.luminaires=new CityLights(environment.night,this.box);
    this.materials.push(
      this.solidMaterial,
      this.terrainMaterial,
      this.buildingMaterial,
      this.detailMaterial,
      this.farMaterial,
    );
    const moverMat = new MeshStandardNodeMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.75,
    });
    this.materials.push(moverMat);
    // One shared mixed-geometry batch, not one texture-backed BatchedMesh for every streamed block.
    // Static street decorations are baked in the worker; these moving meshes retain per-object transforms.
    const carGeometry = moverGeometry(
        "car",
        this.box,
        this.cylinder,
        this.cone,
      ),
      boatGeometry = moverGeometry("boat", this.box, this.cylinder, this.cone),
      planeGeometry = moverGeometry(
        "plane",
        this.box,
        this.cylinder,
        this.cone,
      );
    this.movers = new BatchedMesh(15, 1500, 5000, moverMat);
    this.movers.sortObjects = false;this.movers.frustumCulled=false;
    const car = this.movers.addGeometry(carGeometry),
      boat = this.movers.addGeometry(boatGeometry),
      plane = this.movers.addGeometry(planeGeometry);
    carGeometry.dispose();
    boatGeometry.dispose();
    planeGeometry.dispose();
    void car; // Road cars now belong exclusively to the takeable road-graph population.
    for (let i = 0; i < 12; i++)
      this.boatIds.push(this.movers.addInstance(boat));
    for (let i = 0; i < 3; i++)
      this.aircraftIds.push(this.movers.addInstance(plane));
    this.root.add(this.movers);
    const rainMaterial = new MeshBasicNodeMaterial({
      color: "#d2e2da",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.materials.push(rainMaterial);
    this.rain = new StableInstances(this.box, rainMaterial, 180);
    for (const mesh of [this.rain]) {
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
  }
  async initialize(): Promise<void> {
    const data = await this.worker.world();
    if (this.disposed) return;
    this.layout = data.layout;
    const terrain = new Mesh(geometry(data.terrain), this.terrainMaterial);
    terrain.name = "Continuous full-map terrain coverage";
    terrain.matrixAutoUpdate = false;
    this.root.add(terrain);
    const farRoads = new Mesh(geometry(data.roads), this.terrainMaterial);
    farRoads.matrixAutoUpdate = false;
    this.root.add(farRoads);
    // Volumetric impostors retain the complete silhouette from every angle (12 triangles per distant building).
    const cardGeometry = new BoxGeometry(1, 1, 1);
    this.impostorData = data.impostors;
    this.impostors = new StableInstances(
      cardGeometry,
      this.farMaterial,
      data.impostors.length / 12,
    );
    for (let i = 0; i < data.impostors.length; i += 12) {
      this.transform(this.impostors, i / 12, data.impostors, i);
      const key = `${Math.floor((data.impostors[i]! + 2000) / 128)},${Math.floor((data.impostors[i + 2]! + 2000) / 128)}`;
      let list = this.impostorChunks.get(key);
      if (!list) this.impostorChunks.set(key, (list = []));
      list.push(i / 12);
    }
    this.impostors.computeBoundingSphere();
    this.root.add(this.impostors);
    this.addMarkers();
    const spots = this.layout.features.filter((f) => f.type === "collectible");
    this.caches = new StableInstances(
      new BoxGeometry(0.55, 0.55, 0.55),
      new MeshBasicNodeMaterial({ color: "#e8da95" }),
      spots.length,
    );
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i]!;
      this.temp.position.copy(spot.position);
      this.temp.rotation.set(0, Math.PI / 4, Math.PI / 4);
      this.temp.scale.setScalar(this.collected.has(spot.id) ? 0 : 1);
      this.temp.updateMatrix();
      this.caches.setMatrixAt(i, this.temp.matrix);
    }
    this.root.add(this.caches);
    this.materials.push(this.caches.material as Material);
    const markerGeo = new TorusGeometry(2.5, 0.055, 4, 32),
      markerMat = new MeshBasicNodeMaterial({ color: "#d5ec9b" }),
      starts = this.layout.markers.filter((m) => m.type === "parkour"),
      rings = new StableInstances(markerGeo, markerMat, starts.length);
    this.materials.push(markerMat);
    starts.forEach((m, i) => {
      this.temp.position.copy(m.position);
      this.temp.position.y += 0.06;
      this.temp.rotation.set(-Math.PI / 2, 0, 0);
      this.temp.scale.setScalar(1);
      this.temp.updateMatrix();
      rings.setMatrixAt(i, this.temp.matrix);
    });
    rings.computeBoundingSphere();
    this.root.add(rings);
    this.ready = true;
  }
  async prime(p: V3): Promise<void> {
    const begin = performance.now(),
      cx = Math.floor((p.x + 2000) / 128),
      cz = Math.floor((p.z + 2000) / 128);
    const coordinates: [[number, number], ...[number, number][]] = [
      [7, 9],
      [cx, cz],
      [cx - 1, cz],
      [cx, cz + 1],
    ];
    for (const [x, z] of coordinates) {
      const data = await this.worker.chunk(x, z, 0);
      this.cache.set(data.key, data);
      const job = this.assemble(data);
      let result = job.next();
      while (!result.done) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        result = job.next();
      }
    }
    this.coldPrimeMs = performance.now() - begin;
  }
  private transform(
    mesh: InstancedMesh,
    index: number,
    a: Float32Array,
    i: number,
    visible = true,
  ): void {
    this.temp.position.set(a[i]!, a[i + 1]!, a[i + 2]!);
    this.temp.rotation.set(0, a[i + 6]!, 0);
    this.temp.scale.set(
      visible ? a[i + 3]! : 0,
      visible ? a[i + 4]! : 0,
      visible ? a[i + 5]! : 0,
    );
    this.temp.updateMatrix();
    mesh.setMatrixAt(index, this.temp.matrix);
    mesh.setColorAt(index, this.tint.setRGB(a[i + 7]!, a[i + 8]!, a[i + 9]!));
  }
  private hideImpostors(key: string, hide: boolean): void {
    if (!this.impostors) return;
    for (const index of this.impostorChunks.get(key) ?? [])
      this.transform(
        this.impostors,
        index,
        this.impostorData,
        index * 12,
        !hide,
      );
    this.impostors.instanceMatrix.needsUpdate = true;
  }
  private *assemble(data: ChunkData): Generator<string, void, unknown> {
    const reusable = this.retired.get(data.key);
    if (reusable) {
      this.retired.delete(data.key);
      this.root.add(reusable.root);
      this.chunks.set(data.key, reusable);
      this.hideImpostors(data.key, true);
      this.physics.provide(data);
      return;
    }
    this.remove(data.key);
    const root = new Group();
    root.name = `city:${data.key}`;
    const ground = new Mesh(geometry(data.terrain), this.terrainMaterial);
    root.add(ground);
    yield "terrain";
    if (data.roads.positions.length) {
      const road = new Mesh(geometry(data.roads), this.terrainMaterial);
      road.receiveShadow = true;
      root.add(road);
    }
    yield "roads";
    const buildings = new StableInstances(
      this.box,
      this.buildingMaterial,
      128,
    );
    // r180 InstanceNode emits a UBO array sized by instanceMatrix.count for counts <=1000.
    // Fixed capacities keep every block on the same shader program; draw count remains the actual number.
    buildings.count = data.buildings.length / 12;
    buildings.setColorAt(0, this.tint.setRGB(1, 1, 1));
    for (let i = 0; i < data.buildings.length; i += 12)
      this.transform(buildings, i / 12, data.buildings, i);
    buildings.computeBoundingSphere();
    buildings.castShadow = this.shadows;
    buildings.receiveShadow = true;
    root.add(buildings);
    yield "building-instances";
    if (data.decor.positions.length) {
      const decor = new Mesh(geometry(data.decor), this.detailMaterial);
      root.add(decor);
    }
    yield "worker-baked-decor";
    this.luminaires.register(root,data.lights);
    yield "light-instances";
    root.traverse((o) => {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
    });
    this.root.add(root);
    this.chunks.set(data.key, { data, root, distance: 0 });
    this.hideImpostors(data.key, true);
    this.physics.provide(data);
  }
  private remove(key: string): void {
    const c = this.chunks.get(key);
    if (!c) return;
    this.root.remove(c.root);
    this.retired.set(key, c);
    // Keep a small GPU-ready LRU: crossing a block boundary must not synchronously delete live GPU buffers.
    if (this.retired.size > 48) {
      const old = this.retired.keys().next().value!,
        entry = this.retired.get(old)!;
      this.retired.delete(old);
      this.disposeChunk(entry.root);
    }
    this.chunks.delete(key);
    this.hideImpostors(key, false);
    this.physics.forget(key);
  }
  private disposeChunk(root: Group): void {
    this.luminaires.forget(root);
    root.traverse((o) => {
      if (o instanceof BatchedMesh) o.dispose();
      else if (o instanceof InstancedMesh) o.dispose();
      else if (o instanceof Mesh && o.geometry !== this.box)
        o.geometry.dispose();
    });
  }
  update(p: V3, dt: number, street: boolean): void {
    if (!this.ready || this.disposed) return;
    const updateStart = performance.now();
    this.anchor.value.set(p.x, p.y, p.z);
    this.moverTime += dt;
    if (updateStart - this.lastRequest > 80) {
      this.lastRequest = updateStart;
      const cx = Math.floor((p.x + 2000) / 128),
        cz = Math.floor((p.z + 2000) / 128),
        wanted: { cx: number; cz: number; distance: number }[] = [];
      for (let x = cx - this.radius; x <= cx + this.radius; x++)
        for (let z = cz - this.radius; z <= cz + this.radius; z++)
          if (x >= 0 && z >= 0 && x < 32 && z < 32)
            wanted.push({ cx: x, cz: z, distance: Math.hypot(x - cx, z - cz) });
      wanted.sort((a, b) => a.distance - b.distance);
      for (const w of wanted) {
        const key = `${w.cx},${w.cz}`;
        if (
          this.chunks.has(key) ||
          this.job?.data.key === key ||
          this.pending.has(key) ||
          this.queue.some((q) => q.key === key)
        )
          continue;
        if (this.pending.size >= 4) break;
        const cached = this.cache.get(key);
        if (cached) {
          this.queue.push(cached);
          continue;
        }
        this.pending.add(key);
        void this.worker
          .chunk(w.cx, w.cz, 0)
          .then((data) => {
            this.pending.delete(key);
            if (this.disposed) return;
            this.cache.set(key, data);
            while (this.cache.size > 56)
              this.cache.delete(this.cache.keys().next().value!);
            this.queue.push(data);
          })
          .catch((error) => {
            this.pending.delete(key);
            if (!this.disposed)
              console.error("City chunk generation failed", error);
          });
      }
      for (const [key, c] of this.chunks) {
        c.distance = Math.hypot(c.data.cx - cx, c.data.cz - cz);
        if (Math.max(Math.abs(c.data.cx-cx),Math.abs(c.data.cz-cz)) > this.radius + .6) {
          this.remove(key);
          break;
        }
      }
    }
    const budgetStart = performance.now();
    if (!this.job && this.queue.length) {
      this.queue.sort(
        (a, b) =>
          Math.hypot(
            -2000 + a.cx * 128 + 64 - p.x,
            -2000 + a.cz * 128 + 64 - p.z,
          ) -
          Math.hypot(
            -2000 + b.cx * 128 + 64 - p.x,
            -2000 + b.cz * 128 + 64 - p.z,
          ),
      );
      const data = this.queue.shift()!;
      if (
        !this.chunks.has(data.key) &&
        Math.hypot(
          -2000 + data.cx * 128 + 64 - p.x,
          -2000 + data.cz * 128 + 64 - p.z,
        ) <
          (this.radius + 1.5) * 128
      )
        this.job = { data, steps: this.assemble(data), cpuMs: 0 };
    }
    while (this.job && performance.now() - budgetStart < 1.5) {
      const start = performance.now(),
        job = this.job,
        result = job.steps.next(),
        ms = performance.now() - start;
      const phase = result.value ?? "commit-or-gpu-reuse",
        previous = this.phases[phase] ?? { maximumMs: 0, slices: 0 };
      previous.maximumMs = Math.max(previous.maximumMs, ms);
      previous.slices++;
      this.phases[phase] = previous;
      if (ms > 8 && this.outliers.length < 60)
        this.outliers.push({ chunk: job.data.key, phase, ms });
      job.cpuMs += ms;
      this.maxInstallMs = Math.max(this.maxInstallMs, ms);
      if (this.installSamples.length < 12000) this.installSamples.push(ms);
      if (result.done) {
        this.maximumChunkCpuMs = Math.max(this.maximumChunkCpuMs, job.cpuMs);
        this.job = undefined;
      }
    }
    if (street) this.physics.stream(p);
    this.updateMovers(p);
    this.maximumUpdateMs = Math.max(
      this.maximumUpdateMs,
      performance.now() - updateStart,
    );
  }
  private updateMovers(p: V3): void {
    const t = this.moverTime;
    for (let i = 0; i < 12; i++) {
      this.temp.position.set(
        -1750 - (i % 3) * 65,
        -0.05,
        -1550 + ((t * (1 + (i % 3)) + i * 310) % 3100),
      );
      this.temp.rotation.set(
        0,
        0.1 * Math.sin(i + t * 0.1),
        0.05 * Math.sin(t + i),
      );
      this.temp.scale.setScalar(1);
      this.temp.updateMatrix();
      this.movers.setMatrixAt(this.boatIds[i]!, this.temp.matrix);
    }
    for (let i = 0; i < 3; i++) {
      this.temp.position.set(
        -2100 + ((t * (38 + i * 6) + i * 1300) % 4200),
        280 + i * 75,
        Math.sin(t * 0.025 + i * 2) * 900,
      );
      this.temp.rotation.set(0, Math.PI / 2, 0);
      this.temp.scale.setScalar(1);
      this.temp.updateMatrix();
      this.movers.setMatrixAt(this.aircraftIds[i]!, this.temp.matrix);
    }
    this.rain.visible = this.environment.weather === "rain";
    if (this.rain.visible) {
      for (let i = 0; i < 180; i++) {
        this.temp.position.set(
          p.x + ((i * 17.3) % 42) - 21,
          p.y + 16 - ((t * 18 + i * 1.7) % 20),
          p.z + ((i * 23.7) % 42) - 21,
        );
        this.temp.rotation.set(0, 0, -0.12);
        this.temp.scale.set(0.012, 1.1, 0.012);
        this.temp.updateMatrix();
        this.rain.setMatrixAt(i, this.temp.matrix);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
  }
  private addMarkers(): void {
    const group = this.skySigns,
      canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#23443e";
    c.fillRect(0, 0, 1024, 1024);
    const geo = new BufferGeometry(),
      positions: number[] = [],
      uvs: number[] = [],
      normals: number[] = [],
      indices: number[] = [];
    this.layout.markers.forEach((m, i) => {
      const x = (i % 4) * 256,
        y = Math.floor(i / 4) * 128;
      c.fillStyle = "#badea0";
      c.font = "bold 17px sans-serif";
      c.fillText(m.type.toUpperCase(), x + 14, y + 30);
      c.fillStyle = "#f2e6cc";
      c.font = "bold 22px sans-serif";
      c.fillText(m.name, x + 14, y + 65, 230);
      const p = m.position,
        w = m.type === "landmark" ? 10 : 8,
        py = m.type === "parkour" ? p.y + 4 : terrainHeightAt(p.x, p.z) + 7,
        px = p.x + (m.id === "parkour-1" ? -22 : 0),
        pz = p.z + (m.id === "parkour-1" ? -15 : 10),
        u = x / 1024,
        v = 1 - y / 1024;
      for (const side of [-1, 1]) {
        const base = positions.length / 3;
        positions.push(
          px - (w / 2) * side,
          py,
          pz,
          px + (w / 2) * side,
          py,
          pz,
          px + (w / 2) * side,
          py + 3,
          pz,
          px - (w / 2) * side,
          py + 3,
          pz,
        );
        normals.push(0, 0, side, 0, 0, side, 0, 0, side, 0, 0, side);
        uvs.push(u, v - 0.125, u + 0.25, v - 0.125, u + 0.25, v, u, v);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    });
    geo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(positions), 3),
    );
    geo.setAttribute(
      "normal",
      new BufferAttribute(new Float32Array(normals), 3),
    );
    geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(indices);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const mat = new MeshBasicNodeMaterial({ map: tex });
    this.materials.push(mat);
    group.add(new Mesh(geo, mat));
    this.root.add(group);
  }
  collectAt(p: V3): string[] {
    const found: string[] = [],
      spots = this.layout.features.filter((f) => f.type === "collectible");
    spots.forEach((spot, i) => {
      if (
        !this.collected.has(spot.id) &&
        Math.hypot(
          p.x - spot.position.x,
          p.y + 0.8 - spot.position.y,
          p.z - spot.position.z,
        ) < 2
      ) {
        this.collected.add(spot.id);
        found.push(spot.id);
        this.temp.position.copy(spot.position);
        this.temp.scale.setScalar(0);
        this.temp.updateMatrix();
        this.caches?.setMatrixAt(i, this.temp.matrix);
      }
    });
    if (found.length) {
      this.citySave.write([...this.collected]);
      if (this.caches) this.caches.instanceMatrix.needsUpdate = true;
    }
    return found;
  }
  clearSave(): void {
    this.citySave.clear();
    this.collected.clear();
  }
  configureEffects(flags:EffectFlags):void {
    this.luminaires.configure(flags);
    if(this.windowsEnabled===flags.litWindows)return;this.windowsEnabled=flags.litWindows;
    const night=flags.litWindows?this.environment.night:float(0),windows=this.windowMask;
    for(const material of [this.buildingMaterial,this.farMaterial]){
      material.colorNode=mix(color('#ffffff'),mix(color('#4c7581'),color('#e2cc92'),night),windows.mul(.8));
      material.emissiveNode=flags.litWindows?color('#edce8e').mul(windows).mul(night).mul(material===this.buildingMaterial?1.15:.65):null;
      material.needsUpdate=true;
    }
  }
  applyQuality(tier: QualityTier): void {
    this.shadows=tier.shadows;
    const dissolve=tier.name==='High'||tier.name==='Ultra';if(this.detailMaterial.alphaHash!==dissolve){this.detailMaterial.alphaHash=dissolve;this.detailMaterial.needsUpdate=true;}
    this.radius = tier.name === "Ultra" ? 3 : tier.name === "Low" ? 1 : 2;
    this.trafficIds.forEach((id, i) =>
      this.movers.setVisibleAt(
        id,
        i < Math.min(56, Math.round(56 * tier.trafficDensity)),
      ),
    );
    this.root.traverse((o) => {
      if (o instanceof InstancedMesh && o.material === this.buildingMaterial)
        o.castShadow = tier.shadows;
    });
  }
  snapshot() {
    return {
      ready: this.ready,worker:this.worker.snapshot(),
      lighting:{...this.luminaires.snapshot(),litWindows:this.windowsEnabled},
      sizeMetres: CITY.size,
      chunkMetres: CITY.chunk,
      loaded: this.chunks.size,detailRadius:this.radius,
      anchor: {
        x: this.anchor.value.x,
        y: this.anchor.value.y,
        z: this.anchor.value.z,
      },
      centerLoaded: this.chunks.has(
        `${Math.floor((this.anchor.value.x + 2000) / 128)},${Math.floor((this.anchor.value.z + 2000) / 128)}`,
      ),
      nearbyLoaded: [...this.chunks.values()].filter(
        (c) =>
          Math.abs(
            c.data.cx - Math.floor((this.anchor.value.x + 2000) / 128),
          ) <= 1 &&
          Math.abs(
            c.data.cz - Math.floor((this.anchor.value.z + 2000) / 128),
          ) <= 1,
      ).length,
      installing: !!this.job,
      pending: this.pending.size,
      queued: this.queue.length,
      cached: this.cache.size,
      gpuCached: this.retired.size,
      farImpostors: this.impostorData.length / 12,
      maximumInstallMs: this.maxInstallMs,
      maximumChunkCpuMs: this.maximumChunkCpuMs,
      maximumUpdateMs: this.maximumUpdateMs,
      installPhases: structuredClone(this.phases),
      streamingOutliers: this.outliers.map((v) => ({ ...v })),
      coldPrimeWallMs: this.coldPrimeMs,
      installP95: percentile(this.installSamples, 0.95),
      physicsChunks: this.physics.activeChunks,
      physicsColliders: this.physics.world.colliders.len(),
      physicsStreamMs: this.physics.streamMs,
      graph: {
        nodes: this.layout?.nodes.length ?? 0,
        edges: this.layout?.edges.length ?? 0,
        lanes: this.layout?.lanes.length ?? 0,
      },
      district: districtAt(this.anchor.value.x, this.anchor.value.z),
      hiddenCachesFound: this.collected.size,
      continuousFarCoverage: true,
    };
  }
  dispose(): void {
    this.disposed = true;
    this.worker.dispose();
    for (const key of [...this.chunks.keys()]) this.remove(key);
    for (const c of this.retired.values()) this.disposeChunk(c.root);
    this.retired.clear();this.luminaires.dispose();
    this.physics.dispose();
    this.movers.dispose();
    this.root.traverse((o) => {
      if (
        o instanceof Mesh &&
        o.geometry !== this.box &&
        o.geometry !== this.cylinder &&
        o.geometry !== this.cone &&
        o.geometry !== this.ramp
      )
        o.geometry.dispose();
    });
    for (const m of this.materials) {
      (m as MeshBasicNodeMaterial).map?.dispose();
      m.dispose();
    }
    this.box.dispose();
    this.cylinder.dispose();
    this.cone.dispose();
    this.ramp.dispose();
    this.scene.remove(this.root);
  }
}
function geometry(data: MeshData): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(data.positions, 3));
  geo.setAttribute("normal", new BufferAttribute(data.normals, 3));
  geo.setAttribute("color", new BufferAttribute(data.colors, 3));
  geo.setIndex(new BufferAttribute(data.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}
function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))]!;
}

function makeRamp(): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1),
    p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getZ(i) + p.getY(i) * 0.12);
  g.computeVertexNormals();
  return g;
}

function moverGeometry(
  kind: "car" | "boat" | "plane",
  box: BufferGeometry,
  cylinder: BufferGeometry,
  cone: BufferGeometry,
): BufferGeometry {
  const parts: BakePart[] = [],
    b = (p: V3, s: V3, color: string, geometry = "box", pitch = 0) =>
      parts.push({ p, s, color, geometry, yaw: 0, pitch, roll: 0 });
  if (kind === "car") {
    b({ x: 0, y: 0, z: 0 }, { x: 1.8, y: 0.75, z: 4.2 }, "#a07858");
    b({ x: 0, y: 0.65, z: -0.25 }, { x: 1.5, y: 0.65, z: 1.8 }, "#2d545f");
    b({ x: 0, y: 0.99, z: -0.3 }, { x: 1.6, y: 0.1, z: 1.9 }, "#d5bb7f");
    for (const x of [-0.88, 0.88])
      for (const z of [-1.35, 1.35])
        b({ x, y: -0.35, z }, { x: 0.2, y: 0.65, z: 0.65 }, "#293e3a");
    for (const x of [-0.65, 0.65])
      b({ x, y: 0.1, z: 2.11 }, { x: 0.4, y: 0.2, z: 0.05 }, "#ebdeb0");
  } else if (kind === "boat") {
    b({ x: 0, y: 0, z: 0 }, { x: 2.8, y: 0.9, z: 6.8 }, "#e0d8b8");
    b(
      { x: 0, y: 0.15, z: 3.3 },
      { x: 1.4, y: 2.6, z: 0.7 },
      "#e0d8b8",
      "cone",
      Math.PI / 2,
    );
    b({ x: 0, y: 0.95, z: -0.9 }, { x: 1.7, y: 1.3, z: 2.4 }, "#739da0");
    b({ x: 0, y: 1.67, z: -0.9 }, { x: 2, y: 0.12, z: 2.8 }, "#efdfb5");
    b(
      { x: 0, y: 2.2, z: -1.4 },
      { x: 0.05, y: 1.2, z: 0.05 },
      "#728b80",
      "cylinder",
    );
  } else {
    b(
      { x: 0, y: 0, z: 0 },
      { x: 0.7, y: 13, z: 0.7 },
      "#d6d8c4",
      "cylinder",
      Math.PI / 2,
    );
    b({ x: 0, y: 0, z: 0.4 }, { x: 15, y: 0.15, z: 2.4 }, "#c2cbb7");
    b({ x: 0, y: 0.2, z: -5 }, { x: 5.5, y: 0.12, z: 1.6 }, "#c2cbb7");
    b({ x: 0, y: 1, z: -5.3 }, { x: 0.12, y: 1.8, z: 1.5 }, "#759b8c");
    b({ x: 0, y: 0.42, z: 4.5 }, { x: 0.7, y: 0.35, z: 1.7 }, "#618b92");
  }
  return bakeParts(parts, { box, cylinder, cone });
}
