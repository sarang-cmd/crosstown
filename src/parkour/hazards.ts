import { add, v3, type Hazard, type V3 } from './types';
export function hazardPosition(h: Hazard, time: number): V3 {
  const t = time * h.speed + h.phase, side = v3(h.direction.z, 0, -h.direction.x);
  if (h.type === 'rolling') return add(add(h.center, h.direction, Math.sin(t) * 6), v3(0, 0.85, 0));
  if (h.type === 'laser') return add(add(h.center, h.direction, Math.sin(t * 0.8) * 2.2), v3(0, 1.04, 0));
  if (h.type === 'drone') return add(add(add(h.center, side, Math.cos(t) * 3), h.direction, Math.sin(t) * 3), v3(0, 1.5 + Math.sin(t * 1.7) * 0.65, 0));
  return { ...h.center };
}
