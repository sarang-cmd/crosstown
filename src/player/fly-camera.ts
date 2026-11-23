import { PerspectiveCamera, Vector3, MathUtils } from "three/webgpu";
import type { InputFrame } from "../core/input";
import type { V3 } from "../parkour/types";
export class FlyCamera {
  readonly camera = new PerspectiveCamera(65, 1, 0.1, 12000);
  readonly direction = new Vector3();
  private yaw = 0;
  private pitch = -0.28;
  enter(position: V3, yaw: number): void {
    this.camera.position.set(
      position.x,
      Math.max(position.y + 8, 38),
      position.z - 8,
    );
    this.yaw = yaw;
    this.pitch = -0.28;
    this.rotate();
  }
  update(frame: InputFrame, dt: number, up: boolean, down: boolean): void {
    dt = Math.min(0.05, Math.max(0, dt));
    this.yaw -=
      MathUtils.clamp(frame.lookX, -120, 120) * 0.002 +
      frame.padLookX * dt * 1.4;
    this.pitch = MathUtils.clamp(
      this.pitch -
        MathUtils.clamp(frame.lookY, -100, 100) * 0.002 -
        frame.padLookY * dt,
      -1.45,
      1.45,
    );
    this.rotate();
    const speed = frame.sprint ? 230 : 75,
      forward = this.direction
        .set(0, 0, -1)
        .applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(forward, -frame.moveY * speed * dt);
    this.direction.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(
      this.direction,
      frame.moveX * speed * dt,
    );
    this.camera.position.y += ((up ? 1 : 0) - (down ? 1 : 0)) * speed * dt;
  }
  private rotate(): void {
    this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, "YXZ");
  }
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  teleport(p: V3, target?: V3): void {
    this.camera.position.copy(p);
    if (target) {
      this.camera.lookAt(target.x, target.y, target.z);
      this.yaw = this.camera.rotation.y - Math.PI;
      this.pitch = this.camera.rotation.x;
    }
  }
}
