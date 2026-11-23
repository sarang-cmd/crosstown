import RAPIER from '@dimforge/rapier3d-compat';
import { v3, type RouteData, type V3 } from '../parkour/types';
import type { CityLayout } from '../world/city/types';

export interface ParkingSpot { position: V3; yaw: number; road: number | null }
/** A rooftop may fold back over the naive "next to the first roof" position.
 * Prefer a real road lane; inside the reserved central course block (which has
 * no through roads), use a small paved forecourt instead. Both doors and the
 * whole 10 x 14 m forecourt must clear all solid course-building footprints.
 */
export function findParking(route: RouteData, layout: CityLayout, preferred: V3, avoid?: V3): ParkingSpot {
  let best: ParkingSpot | undefined, bestScore = Infinity;
  for (const edge of layout.edges) {
    if (!['local', 'arterial'].includes(edge.kind)) continue;
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1]!, b = edge.points[i]!, dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (length < 1) continue;
      const projection = Math.max(0, Math.min(1, ((preferred.x - a.x) * dx + (preferred.z - a.z) * dz) / (length * length)));
      const fractions = new Set([projection, ...Array.from({ length: Math.ceil(length / 6) + 1 }, (_, k) => Math.min(1, k * 6 / length))]);
      for (const t of fractions) for (const side of [1, -1]) {
        const along = t * length;
        // Keep the waiting cars clear of crossings, signals and intersection seams.
        if ((i === 1 && along < 13) || (i === edge.points.length - 1 && length - along < 13)) continue;
        const offset = edge.width * .23 * side;
        const p = v3(a.x + t * dx + dz / length * offset, a.y + t * (b.y - a.y) + .72, a.z + t * dz - dx / length * offset);
        if (route.roofs.some(r => Math.abs(p.x - r.center.x) < r.width / 2 + 5.5 && Math.abs(p.z - r.center.z) < r.depth / 2 + 5.5)) continue;
        if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < 14) continue;
        const score = (p.x - preferred.x) ** 2 + (p.z - preferred.z) ** 2;
        if (score >= bestScore) continue;
        bestScore = score; best = { position: p, yaw: Math.atan2(dx, dz) + (side < 0 ? Math.PI : 0), road: edge.id };
      }
    }
  }
  // The opening course reserves the centre of the fixed city. Do not move its
  // reward half a kilometre away merely because that area has no graph edges.
  for (let radius = 0; radius <= 240 && radius * radius + 64 < bestScore; radius += 2) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
      const x = preferred.x + Math.sin(angle) * radius, z = preferred.z + Math.cos(angle) * radius;
      if (Math.abs(x) > 480 || Math.abs(z) > 480) continue;
      if (route.roofs.some(r => Math.abs(x - r.center.x) < r.width / 2 + 8 && Math.abs(z - r.center.z) < r.depth / 2 + 8)) continue;
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 20) continue;
      const nearest = [...route.roofs].sort((a, b) => (a.center.x - x) ** 2 + (a.center.z - z) ** 2 - (b.center.x - x) ** 2 - (b.center.z - z) ** 2)[0]!;
      const dx = x - nearest.center.x, dz = z - nearest.center.z;
      // Axis-aligned pads keep the footprint proof exact; point out of the court.
      const yaw = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
      bestScore = radius * radius + 64;
      best = { position: v3(x, .815, z), yaw, road: null };
    }
  }
  if (!best) throw new Error('No clear city parking space outside the course footprint');
  return best;
}

/** Same physical forecourt used by the scene and headless city-entry tests. */
export function installForecourt(world: RAPIER.World, spot: ParkingSpot): RAPIER.RigidBody {
  const p = spot.position, body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, .055, p.z).setRotation({ x: 0, y: Math.sin(spot.yaw / 2), z: 0, w: Math.cos(spot.yaw / 2) }));
  body.userData = { surface: 'asphalt', material: 'asphalt' };
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, .04, 7).setFriction(.9), body);
  return body;
}
