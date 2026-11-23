// Metre-based on-foot motor. Every ordinary and assisted move is swept by Rapier's kinematic character controller.
import RAPIER from '@dimforge/rapier3d-compat';
import { MOVEMENT as M } from '../config/movement';
import { add, distance, horizontal, v3, type Interaction, type V3 } from '../parkour/types';
export interface CharacterStage { world: RAPIER.World; route: { interactions: Interaction[] }; stream(position: V3, force?: boolean): void; touch(handle: number): void; platformDelta(handle: number | null): V3 }
export type Motion = 'idle' | 'run' | 'sprint' | 'jump' | 'double' | 'slide' | 'climb' | 'fall' | 'land' | 'roll' | 'wallrun' | 'vault' | 'zipline' | 'swing';
export interface PlayerInput { x: number; z: number; jump: boolean; sprint: boolean; slide: boolean; interact: boolean; traverse: boolean }
export const emptyInput = (): PlayerInput => ({ x: 0, z: 0, jump: false, sprint: false, slide: false, interact: false, traverse: false });
interface Traversal { start: V3; end: V3; duration: number; elapsed: number; motion: Motion; lift: number }
export class PlayerController {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly controller: RAPIER.KinematicCharacterController;
  position: V3;
  previous: V3;
  velocity = v3();
  external = v3();
  facing = v3(0, 0, 1);
  yaw = 0;
  grounded = true;
  motion: Motion = 'run';
  height: number = M.height;
  jumps = 0;
  coyote = M.coyoteTime as number;
  buffer = 0;
  slideTime = 0;
  wallTime = 0;
  landTime = 0;
  rollTime = 0;
  groundHandle: number | null = null;
  interaction: Interaction | null = null;
  events: string[] = [];
  private traversal: Traversal | null = null;
  private impact = 0;
  private wasGrounded = true;
  private peak = 0;
  constructor(readonly stage: CharacterStage, spawn: V3, forward = v3(0, 0, 1)) {
    this.position = { ...spawn }; this.previous = { ...spawn }; this.facing = { ...forward };
    this.yaw = Math.atan2(forward.x, forward.z); this.velocity = v3(forward.x * M.runSpeed, 0, forward.z * M.runSpeed);
    this.peak = spawn.y;
    this.body = stage.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + this.height / 2, spawn.z));
    this.collider = stage.world.createCollider(RAPIER.ColliderDesc.capsule((this.height - M.radius * 2) / 2, M.radius).setFriction(0), this.body);
    this.controller = stage.world.createCharacterController(0.025);
    this.controller.enableAutostep(M.stepHeight, 0.2, true); this.controller.enableSnapToGround(M.snapDistance);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.29); this.controller.setMinSlopeSlideAngle(Math.PI * 0.34);
    this.controller.setSlideEnabled(true); this.controller.setApplyImpulsesToDynamicBodies(true);
    stage.world.step();
  }
  private ray(origin: V3, dir: V3, length: number): RAPIER.RayColliderIntersection | null {
    return this.stage.world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), length, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body);
  }
  private setHeight(height: number): void {
    if (height === this.height) return;
    const p = this.position;
    if (height > this.height && this.stage.world.intersectionWithShape(v3(p.x, p.y + height - 0.25, p.z), { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Ball(0.26), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body)) return;
    this.height = height; this.collider.setShape(new RAPIER.Capsule((height - M.radius * 2) / 2, M.radius));
    this.body.setTranslation(v3(p.x, p.y + height / 2, p.z), true);
    this.stage.world.propagateModifiedBodyPositionsToColliders();
  }
  private beginTraversal(end: V3, motion: Motion, duration: number, lift: number): void {
    this.traversal = { start: { ...this.position }, end, duration, elapsed: 0, motion, lift };
    this.velocity = v3(); this.external = v3(); this.events.push(motion); this.motion = motion;
    this.setHeight(M.slideHeight);
  }
  private tryLedge(vault: boolean): boolean {
    const p = this.position, f = this.facing;
    const wall = this.ray(add(p, v3(0, 1, 0), vault ? 0.45 : 0.8), f, vault ? 1.05 : 0.72);
    if (!wall || Math.abs(wall.normal.y) > 0.3) return false;
    const ahead = add(p, f, wall.timeOfImpact + 0.7);
    const top = this.ray(add(ahead, v3(0, 1, 0), 2.45), v3(0, -1, 0), 2.5);
    if (!top || top.normal.y < 0.6) return false;
    const y = p.y + 2.45 - top.timeOfImpact + 0.035;
    const rise = y - p.y;
    if (rise < 0.35 || rise > (vault ? 1.1 : 1.85)) return false;
    const end = v3(ahead.x, y, ahead.z);
    if (!vault) this.events.push('ledge-grab');
    this.beginTraversal(end, vault ? 'vault' : 'climb', vault ? 0.42 : 0.78, vault ? 0.35 : 0.2); return true;
  }
  private move(delta: V3): void {
    this.controller.computeColliderMovement(this.collider, delta, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const actual = this.controller.computedMovement(), center = this.body.translation();
    this.body.setNextKinematicTranslation(v3(center.x + actual.x, center.y + actual.y, center.z + actual.z));
    this.grounded = this.controller.computedGrounded(); this.groundHandle = null;
    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const hit = this.controller.computedCollision(i);
      if (hit?.collider && hit.normal1.y > 0.55) { this.groundHandle = hit.collider.handle; this.stage.touch(hit.collider.handle); }
      if (hit && hit.normal1.y < -0.5 && this.velocity.y > 0) this.velocity.y = 0;
    }
  }
  update(dt: number, input: PlayerInput, powers: { double: number; speed: number }): void {
    this.events.length = 0; this.previous = { ...this.position }; this.wasGrounded = this.grounded;
    this.slideTime = Math.max(0, this.slideTime - dt); this.landTime = Math.max(0, this.landTime - dt); this.rollTime = Math.max(0, this.rollTime - dt);
    this.buffer = input.jump ? M.jumpBuffer : Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? M.coyoteTime : Math.max(0, this.coyote - dt);
    if (this.grounded) { this.jumps = 0; this.wallTime = 0; }
    this.interaction = this.stage.route.interactions.find(i => distance(i.start, this.position) < 2.6) ?? null;
    if (this.traversal) {
      const t = this.traversal; t.elapsed += dt; const u = Math.min(1, t.elapsed / t.duration);
      let desired: V3;
      if (t.motion === 'climb' || t.motion === 'vault') {
        // Lift before crossing the lip; sweeping diagonally into the wall would otherwise block the capsule.
        const horizontalT = Math.max(0, Math.min(1, (u - 0.3) / 0.55));
        const y = u < 0.3 ? t.start.y + (t.end.y - t.start.y + t.lift) * u / 0.3 : t.end.y + t.lift * Math.max(0, 1 - (u - 0.75) / 0.25);
        desired = v3(t.start.x + (t.end.x - t.start.x) * horizontalT, y, t.start.z + (t.end.z - t.start.z) * horizontalT);
      } else desired = v3(t.start.x + (t.end.x - t.start.x) * u, t.start.y + (t.end.y - t.start.y) * u + Math.sin(u * Math.PI) * t.lift, t.start.z + (t.end.z - t.start.z) * u);
      this.move(v3(desired.x - this.position.x, desired.y - this.position.y, desired.z - this.position.z)); this.motion = t.motion;
      if (u >= 1) { this.traversal = null; this.setHeight(M.height); this.landTime = 0.2; }
      return;
    }
    if (input.interact && this.interaction) {
      const i = this.interaction;
      this.beginTraversal(i.end, i.type === 'ladder' ? 'climb' : i.type, i.duration, i.type === 'swing' ? 3.2 : 2.2);
      this.move(v3(0, 0.03, 0)); return;
    }
    if (input.interact && this.grounded && this.tryLedge(true)) { this.move(v3(0, 0.05, 0)); return; }
    if (!this.grounded && this.velocity.y < 1.5 && (input.traverse || input.interact || Math.hypot(input.x, input.z) > 0.1) && this.tryLedge(false)) { this.move(v3(0, 0.03, 0)); return; }
    if (input.slide && this.grounded && this.slideTime === 0) { this.slideTime = 0.85; this.events.push('slide'); }
    this.setHeight(this.slideTime > 0 ? M.slideHeight : M.height);
    const len = Math.hypot(input.x, input.z), factor = len > 1 ? 1 / len : 1;
    const x = input.x * factor, z = input.z * factor;
    const speed = (input.sprint ? M.sprintSpeed : M.runSpeed) * (powers.speed > 0 ? 1.35 : 1);
    const blend = Math.min(1, (this.grounded ? M.acceleration : M.airAcceleration) * dt / Math.max(speed, 1));
    const moving = len > 0.05;
    if (moving) { this.facing = v3(x / Math.max(0.001, Math.hypot(x, z)), 0, z / Math.max(0.001, Math.hypot(x, z))); this.yaw = Math.atan2(this.facing.x, this.facing.z); }
    this.velocity.x += (x * speed - this.velocity.x) * blend; this.velocity.z += (z * speed - this.velocity.z) * blend;
    if (this.slideTime > 0 || this.rollTime > 0) { this.velocity.x = this.facing.x * speed * 1.08; this.velocity.z = this.facing.z * speed * 1.08; }
    let wallNormal: V3 | null = null;
    if (!this.grounded && (input.sprint || input.traverse) && moving && this.wallTime < M.wallRunTime) {
      const side = v3(this.facing.z, 0, -this.facing.x);
      const hit = this.ray(add(this.position, v3(0, 1, 0), 0.9), side, 0.65) ?? this.ray(add(this.position, v3(0, 1, 0), 0.9), add(v3(), side, -1), 0.65);
      if (hit && Math.abs(hit.normal.y) < 0.2) {
        wallNormal = hit.normal; this.wallTime += dt;
        if (this.motion !== 'wallrun') this.events.push('wallrun');
        const dot = this.facing.x * hit.normal.x + this.facing.z * hit.normal.z;
        const tx = this.facing.x - dot * hit.normal.x, tz = this.facing.z - dot * hit.normal.z, tl = Math.hypot(tx, tz) || 1;
        this.velocity.x = tx / tl * M.wallRunSpeed; this.velocity.z = tz / tl * M.wallRunSpeed;
        this.velocity.y = Math.max(-1.5, this.velocity.y - M.wallGravity * dt); this.motion = 'wallrun';
      }
    }
    if (this.buffer > 0 && (this.coyote > 0 || wallNormal || (powers.double > 0 && this.jumps < 2))) {
      const second = this.coyote <= 0 && !wallNormal;
      this.velocity.y = second ? M.doubleJumpSpeed : M.jumpSpeed;
      if (wallNormal) { this.velocity.x += wallNormal.x * 4.5; this.velocity.z += wallNormal.z * 4.5; this.wallTime = M.wallRunTime; }
      this.jumps = second ? 2 : 1; this.buffer = this.coyote = 0; this.grounded = false;
      this.events.push(second ? 'double' : 'jump'); this.motion = second ? 'double' : 'jump';
      this.slideTime = 0; this.setHeight(M.height);
    } else if (!wallNormal) this.velocity.y = this.grounded ? -1.5 : this.velocity.y - M.gravity * dt;
    this.impact = this.velocity.y;
    const carry = this.stage.platformDelta(this.groundHandle);
    this.move(v3((this.velocity.x + this.external.x) * dt + carry.x, this.velocity.y * dt + (this.wasGrounded ? carry.y : 0), (this.velocity.z + this.external.z) * dt + carry.z));
    const decay = Math.exp(-M.externalDrag * dt); this.external.x *= decay; this.external.z *= decay;
    if (this.grounded && !this.wasGrounded) {
      this.events.push('land');
      if (this.impact < -12 || this.peak - this.position.y > 3.4) { this.rollTime = 0.55; this.events.push('roll'); }
      else this.landTime = 0.16;
      this.velocity.y = -1.5; this.peak = this.position.y;
    }
    if (this.grounded) this.motion = this.rollTime > 0 ? 'roll' : this.slideTime > 0 || this.height < M.height ? 'slide' : this.landTime > 0 ? 'land' : moving ? input.sprint || powers.speed > 0 ? 'sprint' : 'run' : 'idle';
    else if (!wallNormal) this.motion = this.velocity.y < -0.5 ? 'fall' : this.jumps >= 2 ? 'double' : 'jump';
  }
  afterPhysics(): void {
    const p = this.body.translation(); this.position = v3(p.x, p.y - this.height / 2, p.z);
    this.peak = Math.max(this.peak, this.position.y);
  }
  respawn(foot: V3, forward = this.facing): void {
    this.traversal = null; this.height = M.height; this.collider.setShape(new RAPIER.Capsule((M.height - M.radius * 2) / 2, M.radius));
    this.body.setTranslation(v3(foot.x, foot.y + this.height / 2, foot.z), true); this.body.setNextKinematicTranslation(v3(foot.x, foot.y + this.height / 2, foot.z));
    this.position = { ...foot }; this.previous = { ...foot }; this.velocity = v3(); this.external = v3();
    this.facing = { ...forward }; this.yaw = Math.atan2(forward.x, forward.z); this.grounded = true; this.groundHandle = null;
    this.jumps = this.slideTime = this.wallTime = this.rollTime = this.landTime = this.buffer = 0; this.coyote = M.coyoteTime; this.peak = foot.y;
    this.stage.stream(foot, true); this.stage.world.propagateModifiedBodyPositionsToColliders();
  }
  knock(direction: V3, strength: number): void { this.external.x += direction.x * strength; this.external.z += direction.z * strength; this.velocity.y = Math.max(this.velocity.y, 2.2); this.grounded = false; }
  get speed(): number { return Math.hypot(this.velocity.x, this.velocity.z); }
  get traversing(): boolean { return this.traversal !== null; }
  nearestInteraction(): Interaction | null { return this.interaction; }
  distanceTo(p: V3): number { return horizontal(this.position, p); }
  dispose(): void { this.stage.world.removeCharacterController(this.controller); this.stage.world.removeRigidBody(this.body); }
}
