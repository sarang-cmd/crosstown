// Streamed, disposable Rapier district. Only nearby roofs and traversal colliders exist in the physics world.
import RAPIER from '@dimforge/rapier3d-compat';
import { horizontal, v3, type RouteData, type Slab, type V3 } from './types';
export function rotation(yaw = 0, pitch = 0, roll = 0): RAPIER.Rotation {
  const a = yaw / 2, b = pitch / 2, c = roll / 2;
  return { x: Math.sin(b) * Math.cos(a) * Math.cos(c) + Math.cos(b) * Math.sin(a) * Math.sin(c), y: Math.cos(b) * Math.sin(a) * Math.cos(c) - Math.sin(b) * Math.cos(a) * Math.sin(c), z: Math.cos(b) * Math.cos(a) * Math.sin(c) - Math.sin(b) * Math.sin(a) * Math.cos(c), w: Math.cos(b) * Math.cos(a) * Math.cos(c) + Math.sin(b) * Math.sin(a) * Math.sin(c) };
}
interface Active { body: RAPIER.RigidBody; collider: RAPIER.Collider; slab?: Slab; previous: V3; delta: V3 }
export class RooftopPhysics {
  readonly world = new RAPIER.World(v3(0, -24, 0));
  readonly active = new Map<string, Active>();
  readonly handles = new Map<number, string>();
  readonly crumble = new Map<string, number>();
  readonly poses = new Map<string, { position: V3; yaw: number; pitch: number; roll: number }>();
  time = 0;
  private streamedAt = v3(1e9, 0, 1e9);
  streamMs = 0;
  initialStreamMs = 0;
  constructor(readonly route: RouteData) { this.world.timestep = 1 / 60; this.stream(route.spawn, true); this.initialStreamMs = this.streamMs; this.streamMs = 0; this.world.step(); }
  stream(position: V3, force = false): void {
    if (!force && horizontal(position, this.streamedAt) < 26) return;
    const start = performance.now(); this.streamedAt = { ...position };
    const wanted = new Set<string>();
    for (const roof of this.route.roofs) {
      if (horizontal(position, roof.center) > 132) continue;
      const id = `roof-${roof.id}`; wanted.add(id);
      if (this.active.has(id)) continue;
      this.create(id, v3(roof.center.x, roof.center.y / 2, roof.center.z), v3(roof.width, roof.center.y, roof.depth));
      const body = this.active.get(id)!.body, half = roof.center.y / 2;
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(3.1, 1.6, 2.7).setTranslation(-21, half + 1.6, 22), body);
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(1.35, 1.85).setTranslation(19.5, half + 4.35, 18.5), body);
      this.world.createCollider(RAPIER.ColliderDesc.cone(0.55, 2.1).setTranslation(19.5, half + 6.1, 18.5), body);
      for (let k = 0; k < 3; k++) this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.8, 0.6, 1.15).setTranslation(-19 + k * 5.6, half + 0.6, -17.5), body);
    }
    for (const slab of this.route.slabs) {
      if (horizontal(position, slab.center) > 118) continue;
      wanted.add(slab.id);
      if (!this.active.has(slab.id)) this.create(slab.id, slab.center, slab.size, slab);
    }
    for (const [id, a] of this.active) if (!wanted.has(id)) { this.handles.delete(a.collider.handle); this.world.removeRigidBody(a.body); this.active.delete(id); }
    this.world.propagateModifiedBodyPositionsToColliders();
    this.streamMs = Math.max(this.streamMs, performance.now() - start);
  }
  private create(id: string, p: V3, size: V3, slab?: Slab): void {
    const desc = slab?.dynamic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(p.x, p.y, p.z).setRotation(rotation(slab?.yaw, slab?.pitch, slab?.roll));
    const body = this.world.createRigidBody(desc);
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setFriction(0.9), body);
    this.active.set(id, { body, collider, slab, previous: { ...p }, delta: v3() }); this.handles.set(collider.handle, id);
  }
  update(dt: number, position: V3): void {
    this.time += dt;
    const recovered = new Set<string>();
    for (const [id, activation] of this.crumble) if (this.time - activation > 5.5) { this.crumble.delete(id); recovered.add(id); }
    this.stream(position);
    for (const [id, a] of this.active) {
      const s = a.slab; if (!s?.dynamic) continue;
      const p = { ...s.center }; let yaw = s.yaw, pitch = s.pitch, roll = s.roll;
      const t = this.time * (s.speed ?? 1) + (s.phase ?? 0);
      if (s.kind === 'moving') { p.x += (s.axis?.x ?? 1) * Math.sin(t) * (s.amplitude ?? 1); p.z += (s.axis?.z ?? 0) * Math.sin(t) * (s.amplitude ?? 1); }
      if (s.kind === 'tilting') roll += Math.sin(t) * 0.19;
      if (s.kind === 'crane') yaw += Math.sin(t * 0.6) * 0.17;
      if (s.kind === 'crumbling') {
        const activation = this.crumble.get(id);
        if (activation !== undefined) {
          const elapsed = this.time - activation;
          if (elapsed > 5.5) this.crumble.delete(id);
          else if (elapsed > 0.75) { p.y -= Math.min(42, (elapsed - 0.75) ** 2 * 5); roll += Math.min(0.8, elapsed * 0.13); }
        }
      }
      a.delta = recovered.has(id) ? v3() : v3(p.x - a.previous.x, p.y - a.previous.y, p.z - a.previous.z); a.previous = p;
      // A resetting ledge is teleported, not a 42 m/tick elevator; never launch its rider into the sky.
      if (recovered.has(id)) a.body.setTranslation(p, true);
      a.body.setNextKinematicTranslation(p); a.body.setNextKinematicRotation(rotation(yaw, pitch, roll));
      this.poses.set(id, { position: p, yaw, pitch, roll });
    }
  }
  touch(handle: number): void {
    const id = this.handles.get(handle), s = id ? this.active.get(id)?.slab : undefined;
    if (id && s?.kind === 'crumbling' && !this.crumble.has(id)) this.crumble.set(id, this.time);
  }
  platformDelta(handle: number | null): V3 { return handle === null ? v3() : this.active.get(this.handles.get(handle) ?? '')?.delta ?? v3(); }
  reset(): void { this.crumble.clear(); this.time = 0; this.poses.clear(); }
  dispose(): void { this.active.clear(); this.handles.clear(); this.world.free(); }
}
