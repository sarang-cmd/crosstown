import type { RunLength } from '../config/session';
// Serializable parkour data shared unchanged by the world worker, simulation, renderer, bot and validator.
export interface V3 { x: number; y: number; z: number }
export const SEGMENT_TYPES = ['gap', 'ledge', 'wallrun', 'zipline', 'fireescape', 'watertower', 'billboard', 'clothesline', 'vents', 'crane', 'moving', 'tilting', 'crumbling', 'rolling', 'laser', 'wind', 'drone'] as const;
export type SegmentType = typeof SEGMENT_TYPES[number];
export type PowerType = 'double' | 'slow' | 'speed' | 'magnet';
export type HazardType = 'rolling' | 'laser' | 'wind' | 'drone';
export interface Roof { id: number; center: V3; width: number; depth: number; tint: number; style: number }
export interface Slab {
  id: string; center: V3; size: V3; yaw: number; pitch: number; roll: number;
  kind: 'roof' | 'bridge' | 'ledge' | 'vent' | 'wall' | 'moving' | 'tilting' | 'crumbling' | 'crane' | 'tower';
  dynamic?: boolean; axis?: V3; amplitude?: number; speed?: number; phase?: number; safe?: boolean;
}
export interface Waypoint { position: V3; action?: 'jump' | 'land' | 'interact'; sprint?: boolean; interactionId?: string; checkpoint?: number }
export interface JumpProof { from: V3; to: V3; sprint: boolean; landingWidth: number; wind: number; segment: string; branch: 'safe' | 'risk' }
export interface Interaction { id: string; type: 'zipline' | 'swing' | 'ladder'; start: V3; end: V3; duration: number; label: string }
export interface Hazard { id: string; type: HazardType; center: V3; direction: V3; radius: number; phase: number; speed: number; strength: number }
export interface Pickup { id: string; type: PowerType | 'time' | 'coin'; position: V3; value: number; risk: boolean }
export interface Checkpoint { id: number; position: V3; direction: V3; navIndex: number; roofId: number; name: string }
export interface Encounter { id: string; type: SegmentType; position: V3; direction: V3; roofA: number; roofB: number; safeBranch: boolean; difficulty: number }
export interface RouteData {
  seed: number; training: boolean; length: RunLength; roofs: Roof[]; slabs: Slab[]; nav: Waypoint[];
  checkpoints: Checkpoint[]; jumps: JumpProof[]; interactions: Interaction[]; hazards: Hazard[]; pickups: Pickup[];
  encounters: Encounter[]; spawn: V3; spawnDirection: V3; goal: V3; carPosition: V3;
  distance: number; expectedSeconds: number; validation: { possible: boolean; errors: string[]; maxGap: number; maxHeight: number };
}
export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const add = (a: V3, b: V3, scale = 1): V3 => v3(a.x + b.x * scale, a.y + b.y * scale, a.z + b.z * scale);
export const distance = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const horizontal = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.z - b.z);
export function direction(a: V3, b: V3): V3 { const d = Math.hypot(b.x - a.x, b.z - a.z) || 1; return v3((b.x - a.x) / d, 0, (b.z - a.z) / d); }
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; };
}
