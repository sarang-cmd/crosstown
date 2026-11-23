import RAPIER from "@dimforge/rapier3d-compat";
import { MathUtils, PerspectiveCamera, Vector3 } from "three/webgpu";
import type { InputFrame } from "../core/input";
import type { PlayerController } from "./controller";
export interface CameraSubject {
  player: PlayerController;
  stage: { world: RAPIER.World };
  state: string;
  finishTime: number;
  route: { goal: V3; carPosition: V3 };
}
import type { V3 } from "../parkour/types";
export class ChaseCamera {
  readonly camera = new PerspectiveCamera(64, 1, 0.08, 5000);
  yaw = 0;
  sensitivity = 0.75;
  smoothing = 7;
  invertX = false;
  private desiredYaw = 0;
  private pitch = 0.24;
  private desiredPitch = 0.24;
  private distance = 5.8;
  private initialized = false;
  private target = new Vector3();
  private lookAhead = new Vector3();
  private head = new Vector3();
  private ideal = new Vector3();
  private safe = new Vector3();
  private delta = new Vector3();
  private sphere = new RAPIER.Ball(0.24);
  collisionLimited = false;
  clearance = 0;
  reset(direction?: V3): void {
    if (direction)
      this.yaw = this.desiredYaw = Math.atan2(direction.x, direction.z);
    this.pitch = this.desiredPitch = 0.24;
    this.initialized = false;
  }
  look(input: InputFrame, dt: number): void {
    // Pointer displacement is already frame-integrated. Do not multiply it by dt or accelerate it at low FPS.
    const x =
      MathUtils.clamp(input.lookX, -120, 120) * 0.0025 +
      input.padLookX * Math.min(dt, 0.05) * 1.5;
    const y =
      MathUtils.clamp(input.lookY, -100, 100) * 0.002 +
      input.padLookY * Math.min(dt, 0.05);
    this.desiredYaw -= x * this.sensitivity * (this.invertX ? -1 : 1);
    this.desiredPitch = MathUtils.clamp(
      this.desiredPitch + y * this.sensitivity,
      -0.12,
      0.8,
    );
    this.distance = MathUtils.clamp(
      this.distance + input.zoom * 0.35,
      3.8,
      8.2,
    );
  }
  // A +Z-facing camera's SCREEN right is WORLD -X. The old basis inverted A/D.
  movement(x: number, y: number): { x: number; z: number } {
    return {
      x: -Math.cos(this.yaw) * x - Math.sin(this.yaw) * y,
      z: Math.sin(this.yaw) * x - Math.cos(this.yaw) * y,
    };
  }
  private cast(run: CameraSubject, origin: Vector3, desired: Vector3): Vector3 {
    this.delta.copy(desired).sub(origin);
    const length = this.delta.length();
    if (length < 0.001) return desired;
    const hit = run.stage.world.castShape(
      origin,
      { x: 0, y: 0, z: 0, w: 1 },
      this.delta,
      this.sphere,
      0.02,
      1,
      false,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      run.player.collider,
      run.player.body,
    );
    const fraction = hit ? Math.max(0, hit.time_of_impact - 0.07 / length) : 1;
    this.collisionLimited ||= fraction < 1;
    this.clearance = length * fraction;
    return this.safe.copy(origin).addScaledVector(this.delta, fraction);
  }
  update(run: CameraSubject, dt: number, reduced = false, alpha = 1): void {
    const p = run.player,
      foot = p.position;
    dt = Math.min(0.05, Math.max(0, dt));
    this.collisionLimited = false;
    const rotate = 1 - Math.exp(-this.smoothing * dt);
    this.yaw +=
      Math.atan2(
        Math.sin(this.desiredYaw - this.yaw),
        Math.cos(this.desiredYaw - this.yaw),
      ) * rotate;
    this.pitch += (this.desiredPitch - this.pitch) * rotate;
    // No direction->camera->movement feedback: strafing/backpedalling never spins the camera.
    const x = p.previous.x + (foot.x - p.previous.x) * alpha,
      y = p.previous.y + (foot.y - p.previous.y) * alpha,
      z = p.previous.z + (foot.z - p.previous.z) * alpha;
    this.lookAhead.lerp(
      this.delta.set(p.velocity.x * 0.16, 0, p.velocity.z * 0.16),
      1 - Math.exp(-4 * dt),
    );
    this.head.set(x, y + Math.min(1.25, p.height * 0.8), z);
    this.delta.copy(this.head).add(this.lookAhead);
    this.delta.y += 0.15;
    if (!this.initialized) this.target.copy(this.delta);
    else this.target.lerp(this.delta, 1 - Math.exp(-9 * dt));
    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw);
    this.ideal.set(
      x - sin * this.distance + cos * 0.35,
      y + 2.55 + this.pitch * this.distance,
      z - cos * this.distance - sin * 0.35,
    );
    if (run.state === "finished" && !reduced) {
      const u = Math.min(1, run.finishTime / 7),
        radius = 6 + Math.sin(u * Math.PI * 0.75) * 42,
        angle = this.yaw + u * 1.9;
      this.ideal.set(
        run.route.goal.x - Math.sin(angle) * radius,
        run.route.goal.y + 3 + Math.sin((u * Math.PI) / 2) * 38,
        run.route.goal.z - Math.cos(angle) * radius,
      );
      this.target.set(run.route.goal.x, run.route.goal.y + 2, run.route.goal.z);
    }
    this.ideal.copy(this.cast(run, this.head, this.ideal));
    if (
      !this.initialized ||
      this.camera.position.distanceToSquared(this.ideal) > 45 * 45
    ) {
      this.camera.position.copy(this.ideal);
      this.initialized = true;
    } else
      this.camera.position.lerp(
        this.ideal,
        1 - Math.exp(-(reduced ? 12 : 8) * dt),
      );
    this.camera.position.copy(this.cast(run, this.head, this.camera.position));
    this.camera.lookAt(this.target);
    const fov = 64 + MathUtils.clamp((p.speed - 6.5) * 1.3, 0, 4);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * rotate;
      this.camera.updateProjectionMatrix();
    }
  }
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
