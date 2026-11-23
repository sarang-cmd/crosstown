import RAPIER from "@dimforge/rapier3d-compat";
import {
  emptyInput,
  PlayerController,
  type PlayerInput,
  type CharacterStage,
} from "../../player/controller";
import { v3, type V3, type RouteData } from "../../parkour/types";
import { type ChunkData } from "./types";
import { terrainHeightAt } from "./layout";
import { rotation } from "../../parkour/physics";
export class CityPhysics implements CharacterStage {
  readonly world = new RAPIER.World(v3(0, -24, 0));
  readonly route = { interactions: [] };
  private chunks = new Map<string, RAPIER.RigidBody[]>();
  private sources = new Map<string, ChunkData>();
  private center = v3(); private dirty = true;
  private opening: RAPIER.RigidBody[] = [];
  streamMs = 0;
  constructor() {
    this.world.timestep = 1 / 60;
    const heights = new Float32Array(97 * 97);
    for (let x = 0; x <= 96; x++)
      for (let z = 0; z <= 96; z++)
        heights[x * 97 + z] =
          terrainHeightAt(-2000 + (x / 96) * 4000, -2000 + (z / 96) * 4000) -
          0.06;
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    ground.userData = { surface: 'grass' };
    this.world.createCollider(
      RAPIER.ColliderDesc.heightfield(
        96,
        96,
        heights,
        v3(4000, 1, 4000),
      ).setFriction(0.9),
      ground,
    );
    this.world.step();
  }
  setOpening(route: RouteData): void {
    for (const b of this.opening) this.world.removeRigidBody(b);
    this.opening = [];
    for (const r of route.roofs) {
      const b = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(
          r.center.x,
          r.center.y / 2,
          r.center.z,
        ),
      );
      b.userData = { surface: 'concrete', courseRoof: r.id };
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(r.width / 2, r.center.y / 2, r.depth / 2),
        b,
      );
      this.opening.push(b);
    }
    this.world.step();
  }
  provide(data: ChunkData): void {
    this.sources.set(data.key, data); this.dirty = true;
  }
  forget(key: string): void {
    this.sources.delete(key); this.dirty = true;
    this.remove(key);
  }
  stream(position: V3, force = false): void {
    if(!force&&!this.dirty&&Math.hypot(position.x-this.center.x,position.z-this.center.z)<8)return;
    this.center = { ...position }; this.dirty=false;
    const start = performance.now();
    for (const [key, bodies] of this.chunks) {
      void bodies;
      const [cx, cz] = key.split(",").map(Number);
      if (
        Math.hypot(
          -2000 + cx! * 128 + 64 - position.x,
          -2000 + cz! * 128 + 64 - position.z,
        ) > 290
      )
        this.remove(key);
    }
    let installed = 0;
    for (const [key, data] of this.sources) {
      if (this.chunks.has(key)) continue;
      const x = -2000 + data.cx * 128,
        z = -2000 + data.cz * 128;
      if (Math.hypot(x + 64 - position.x, z + 64 - position.z) > 205) continue;
      const bodies: RAPIER.RigidBody[] = [],
        ground = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(
            x + Math.min(128, 2000 - x) / 2,
            0,
            z + Math.min(128, 2000 - z) / 2,
          ),
        );
      ground.userData = { surface: 'grass' };
      bodies.push(ground);
      this.world.createCollider(
        RAPIER.ColliderDesc.heightfield(
          16,
          16,
          data.heights,
          v3(Math.min(128, 2000 - x), 1, Math.min(128, 2000 - z)),
        ).setFriction(0.9),
        ground,
      );
      for (let i = 0; i < data.colliders.length; i += 8) {
        const a = data.colliders;
        const b = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(a[i]!, a[i + 1]!, a[i + 2]!)
            .setRotation(rotation(a[i + 6]!, a[i + 7]!)),
        );
        b.userData = { surface: a[i + 4]! < .6 ? 'asphalt' : 'concrete' };
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            a[i + 3]! / 2,
            a[i + 4]! / 2,
            a[i + 5]! / 2,
          ).setFriction(0.9),
          b,
        );
        bodies.push(b);
      }
      this.chunks.set(key, bodies);
      installed++;
      if (!force && (installed >= 1 || performance.now() - start > 2)) break;
    }
    this.world.propagateModifiedBodyPositionsToColliders();
    this.streamMs = Math.max(this.streamMs, performance.now() - start);
  }
  landingAt(position: V3): V3 {
    this.stream(position, true);
    // Probe from above all local roofs. This also resolves a fly camera that was inside a building.
    const start = v3(
      position.x,
      Math.max(position.y + 2, terrainHeightAt(position.x, position.z) + 220),
      position.z,
    );
    const hit = this.world.castRay(
      new RAPIER.Ray(start, v3(0, -1, 0)),
      500,
      true,
    );
    return v3(
      position.x,
      hit
        ? start.y - hit.timeOfImpact + 0.08
        : terrainHeightAt(position.x, position.z) + 0.08,
      position.z,
    );
  }
  private remove(key: string): void {
    const bodies = this.chunks.get(key);
    if (bodies) for (const b of bodies) this.world.removeRigidBody(b);
    this.chunks.delete(key);
  }
  update(position: V3): void {
    this.stream(position);
  }
  touch(): void {}
  platformDelta(): V3 {
    return v3();
  }
  get activeChunks(): number {
    return this.chunks.size;
  }
  get anchor(): V3 {
    return this.center;
  }
  dispose(): void {
    this.chunks.clear();
    this.sources.clear();
    this.world.free();
  }
}
export class StreetSession {
  readonly state = "running" as const;
  readonly finishTime = 0;
  elapsed = 0;
  readonly player: PlayerController;
  constructor(
    readonly stage: CityPhysics,
    spawn: V3,
    readonly route: { goal: V3; carPosition: V3 },
  ) {
    this.player = new PlayerController(stage, spawn);
    this.player.respawn(spawn);
  }
  update(dt: number, input: PlayerInput = emptyInput(), dynamics?: { preStep(dt: number, anchor: V3): void; postStep(dt: number): void }): void {
    this.elapsed += dt;
    this.stage.update(this.player.position);
    this.player.update(dt, input, { double: 0, speed: 0 });
    dynamics?.preStep(dt, this.player.position);
    this.stage.world.step();
    dynamics?.postStep(dt);
    this.player.afterPhysics();
    // Visible sea is a natural boundary. Deep water returns the walker to the beach, not an invisible wall.
    if (this.player.position.y < -1.5)
      this.player.respawn(
        v3(
          -1575,
          terrainHeightAt(-1575, this.player.position.z) + 0.08,
          this.player.position.z,
        ),
      );
  }
  ghostAt(): null {
    return null;
  }
  dispose(): void {
    this.player.dispose();
  }
}
