// Acceptance driver: ordinary throttle/brake/steering only. Never teleports, edits RPM, or applies helper forces.
import type { V3 } from '../parkour/types';
import { steeringLock, clamp } from './cars';
import { neutralDrive, type DriveInput } from './engine';
import type { RaycastCar } from './physics';
export class CircuitPilot {
  index: number; maximumError = 0; visited = new Set<number>();
  constructor(readonly path: readonly V3[], readonly digital = false) { this.index = path.length - 1; }
  input(car: RaycastCar): DriveInput {
    const path = this.path, p = car.position; let nearest = Infinity, index = this.index;
    for (let j = -2; j <= 4; j++) {
      const i = (this.index + j + path.length) % path.length, a = path[i]!, b = path[(i + 1) % path.length]!, dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)), distance = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
      if (distance < nearest) { nearest = distance; index = i; }
    }
    this.index = index; this.visited.add(index); this.maximumError = Math.max(this.maximumError, nearest);
    const a = path[index]!, b = path[(index + 1) % path.length]!, dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    let ahead = Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length) + Math.max(6, Math.abs(car.speed) * .65), targetIndex = index;
    let section = length;
    while (ahead > section) { ahead -= section; targetIndex = (targetIndex + 1) % path.length; section = Math.hypot(path[(targetIndex + 1) % path.length]!.x - path[targetIndex]!.x, path[(targetIndex + 1) % path.length]!.z - path[targetIndex]!.z); }
    const from = path[targetIndex]!, to = path[(targetIndex + 1) % path.length]!, target = { x: from.x + (to.x - from.x) * ahead / section, z: from.z + (to.z - from.z) * ahead / section };
    const q = car.rotation, yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x)), bearing = Math.atan2(target.x - p.x, target.z - p.z), error = Math.atan2(Math.sin(bearing - yaw), Math.cos(bearing - yaw));
    const steer = clamp(-error * 1.5 / steeringLock(car.definition, car.speed), -1, 1), desired = Math.abs(error) > .18 ? 10 : 13;
    return { ...neutralDrive(), steering: this.digital ? Math.abs(steer) < .13 ? 0 : Math.sign(steer) : steer, throttle: this.digital ? car.speed < desired - .3 ? 1 : 0 : clamp((desired - car.speed) * .24, 0, .8), brake: clamp((car.speed - desired) * .15, 0, .6) };
  }
}
