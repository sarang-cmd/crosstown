import RAPIER from '@dimforge/rapier3d-compat';
import { PerspectiveCamera, Vector3, Quaternion } from 'three/webgpu';
import type { InputFrame } from '../core/input';
import type { RaycastCar } from './physics';
export const CAR_VIEWS = ['Cockpit', 'Hood', 'Close chase', 'Far chase'] as const;
export class VehicleCameras {
  readonly camera = new PerspectiveCamera(67, 1, .035, 6500); view = 0;
  yaw = 0; pitch = -.035; private snap = true; private lookTimer = 0;
  private position = new Vector3(); private q = new Quaternion(); private offset = new Vector3(); private aim = new Vector3(); private desired = new Vector3(); private direction = new Vector3();
  cycle(): string { this.view = (this.view + 1) % 4; this.snap = true; this.yaw = 0; this.pitch = -.035; return CAR_VIEWS[this.view]!; }
  reset(view = this.view): void { this.view = Math.max(0, Math.min(3, Math.round(view))); this.snap = true; this.yaw = 0; this.pitch = -.035; }
  resize(w: number, h: number): void { this.camera.aspect = Math.max(1, w) / Math.max(1, h); this.camera.updateProjectionMatrix(); }
  look(frame: InputFrame, dt: number, mouseSteering: boolean): void {
    const x = (mouseSteering ? 0 : frame.lookX * .003) + frame.padLookX * dt * 1.6, y = (mouseSteering ? 0 : frame.lookY * .002) + frame.padLookY * dt;
    if (Math.abs(x) + Math.abs(y) > .0001) { this.yaw = Math.max(-1.4, Math.min(1.4, this.yaw - x)); this.pitch = Math.max(-.35, Math.min(.35, this.pitch - y)); this.lookTimer = 2; }
    else { this.lookTimer = Math.max(0, this.lookTimer - dt); if (this.lookTimer === 0) { this.yaw *= Math.exp(-dt * 2.5); this.pitch += (-.035 - this.pitch) * (1 - Math.exp(-dt * 2.5)); } }
  }
  update(car: RaycastCar, eye: Vector3, dt: number, alpha: number, reducedMotion = false): void {
    const a = Math.max(0, Math.min(1, alpha));
    this.position.set(car.previous.x + (car.position.x - car.previous.x) * a, car.previous.y + (car.position.y - car.previous.y) * a, car.previous.z + (car.position.z - car.previous.z) * a); this.q.slerpQuaternions(car.previousRotation, car.rotation, a);
    const inside = this.view <= 1;
    this.camera.near = inside ? .035 : .15; this.camera.fov = this.view === 0 ? 67 : this.view === 1 ? 69 : 61 + Math.min(6, Math.abs(car.speed) * .09); this.camera.updateProjectionMatrix();
    if (inside) {
      this.offset.copy(this.view === 0 ? eye : new Vector3(0, .78, 1.75)); this.desired.copy(this.offset).applyQuaternion(this.q).add(this.position);
      this.direction.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).applyQuaternion(this.q);
      this.camera.position.copy(this.desired); this.camera.up.set(0, 1, 0).applyQuaternion(this.q); this.camera.lookAt(this.desired.add(this.direction));
    } else {
      const yaw = Math.atan2(2 * (this.q.w * this.q.y + this.q.x * this.q.z), 1 - 2 * (this.q.y ** 2 + this.q.x ** 2)) + this.yaw, distance = this.view === 2 ? 5.9 : 10.4, height = this.view === 2 ? 2.15 : 3.7;
      this.aim.copy(this.position).add(new Vector3(0, .62, 0)); this.desired.copy(this.aim).add(new Vector3(-Math.sin(yaw) * distance, height + this.pitch * 4, -Math.cos(yaw) * distance));
      this.direction.subVectors(this.desired, this.aim); const length = this.direction.length(); this.direction.normalize();
      const hit = car.world.castShape(this.aim, { x: 0, y: 0, z: 0, w: 1 }, this.direction, new RAPIER.Ball(.22), 0, length, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, car.collider, car.body);
      if (hit) this.desired.copy(this.aim).addScaledVector(this.direction, Math.max(.35, hit.time_of_impact - .15));
      if (this.snap || reducedMotion || this.camera.position.distanceToSquared(this.desired) > 1600) this.camera.position.copy(this.desired); else this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * 6.2));
      this.aim.add(new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(Math.min(3.5, Math.abs(car.speed) * .08))); this.camera.up.set(0, 1, 0); this.camera.lookAt(this.aim);
    }
    this.camera.updateMatrixWorld(); this.snap = false;
  }
  snapshot() { return { index: this.view, name: CAR_VIEWS[this.view], position: this.camera.position.toArray(), direction: this.camera.getWorldDirection(new Vector3()).toArray(), near: this.camera.near }; }
}
