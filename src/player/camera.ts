// Foundation inspection camera. On-foot gameplay is intentionally not implemented in Step 01.
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three/webgpu';
import type { InputFrame } from '../core/input';
export class InspectionCamera {
  readonly camera = new PerspectiveCamera(43, 1, 0.1, 350);
  readonly target = new Vector3(0.25, 0.85, 0);
  private desired = new Spherical(18, 1.37, 0.42);
  private current = this.desired.clone();
  private offset = new Vector3();
  constructor() { this.place(); }
  reset(): void { this.target.set(0.25, 0.85, 0); this.desired.set(18, 1.37, 0.42); }
  update(input: InputFrame, dt: number, reducedMotion: boolean): void {
    this.desired.theta -= input.lookX * 0.005 + input.padLookX * dt * 1.8;
    this.desired.phi = MathUtils.clamp(this.desired.phi - input.lookY * 0.004 - input.padLookY * dt * 1.5, 0.25, 1.47);
    this.desired.radius = MathUtils.clamp(this.desired.radius + input.zoom * 1.1, 7, 44);
    const speed = (input.sprint ? 9 : 4) * dt;
    const sin = Math.sin(this.desired.theta), cos = Math.cos(this.desired.theta);
    this.target.x += (input.moveX * cos + input.moveY * sin) * speed;
    this.target.z += (-input.moveX * sin + input.moveY * cos) * speed;
    this.target.x = MathUtils.clamp(this.target.x, -24, 24);
    this.target.z = MathUtils.clamp(this.target.z, -24, 24);
    const factor = reducedMotion ? 1 : 1 - Math.exp(-12 * dt);
    this.current.radius = MathUtils.lerp(this.current.radius, this.desired.radius, factor);
    this.current.phi = MathUtils.lerp(this.current.phi, this.desired.phi, factor);
    this.current.theta = MathUtils.lerp(this.current.theta, this.desired.theta, factor);
    this.place();
  }
  private place(): void {
    this.offset.setFromSpherical(this.current);
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.fov = width < 650 ? 58 : 43;
    this.camera.updateProjectionMatrix();
  }
}
