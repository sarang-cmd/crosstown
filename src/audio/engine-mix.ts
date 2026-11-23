// Pure mixer functions are also tested without a browser or an audio output device.
import { clamp, type EngineType } from '../vehicles/cars';
export const ENGINE_TIMBRES: Record<EngineType, { cylinders: number; roughness: number; brightness: number; sub: number; turbo: number }> = {
  i4: { cylinders: 4, roughness: .13, brightness: 1550, sub: .22, turbo: .12 },
  v6: { cylinders: 6, roughness: .10, brightness: 1350, sub: .32, turbo: .05 },
  v8: { cylinders: 8, roughness: .32, brightness: 1050, sub: .62, turbo: 0 },
  flat6: { cylinders: 6, roughness: .07, brightness: 2200, sub: .26, turbo: .20 },
  diesel: { cylinders: 4, roughness: .48, brightness: 800, sub: .60, turbo: .20 },
  twin: { cylinders: 2, roughness: .35, brightness: 2100, sub: .38, turbo: 0 },
  v10: { cylinders: 10, roughness: .09, brightness: 2450, sub: .3, turbo: .08 },
  single: { cylinders: 1, roughness: .58, brightness: 1900, sub: .30, turbo: 0 },
};
export function loopWeights(rpm: number, load: number, anchors: readonly number[]): number[] {
  const out = Array(anchors.length * 2).fill(0) as number[];
  if (!anchors.length) return out;
  const r = Math.max(1, rpm); let lower = 0, upper = 0, blend = 0;
  if (r >= anchors[anchors.length - 1]!) lower = upper = anchors.length - 1;
  else if (r > anchors[0]!) {
    for (let i = 1; i < anchors.length; i++) if (r <= anchors[i]!) { lower = i - 1; upper = i; blend = clamp((Math.log(r) - Math.log(anchors[lower]!)) / (Math.log(anchors[upper]!) - Math.log(anchors[lower]!))); break; }
  }
  const band = Array(anchors.length).fill(0) as number[]; band[lower] = 1 - blend; band[upper] = (band[upper] ?? 0) + blend;
  const pedal = clamp(load);
  for (let i = 0; i < anchors.length; i++) { out[i * 2] = Math.sqrt(band[i]! * (1 - pedal)); out[i * 2 + 1] = Math.sqrt(band[i]! * pedal); }
  return out;
}
export function nearestEmitters<T extends { id: string; position: { x: number; y: number; z: number }; priority?: number }>(items: readonly T[], listener: { x: number; y: number; z: number }, max = 16): T[] {
  return [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || ((a.position.x - listener.x) ** 2 + (a.position.y - listener.y) ** 2 + (a.position.z - listener.z) ** 2) - ((b.position.x - listener.x) ** 2 + (b.position.y - listener.y) ** 2 + (b.position.z - listener.z) ** 2) || a.id.localeCompare(b.id)).slice(0, Math.max(0, Math.min(16, max)));
}
export function firingHz(rpm: number, type: EngineType): number { return Math.max(2, rpm / 120 * ENGINE_TIMBRES[type].cylinders); }
