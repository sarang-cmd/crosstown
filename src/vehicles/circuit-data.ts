// Handling-lab data is generated in a worker; kept outside the fixed city as a dedicated test scene.
import { bakeRecords } from '../world/city/mesh-bake';
import { v3, type V3 } from '../parkour/types';
import type { MeshData } from '../world/city/types';
import type { Surface } from './cars';
export const CIRCUIT_ORIGIN = v3(5200, 0, 5200);
export interface CircuitCollider { position: V3; half: V3; yaw: number; pitch: number; surface: Surface }
export interface CircuitData { mesh: MeshData; colliders: CircuitCollider[]; path: V3[]; spawn: V3; yaw: number; features: { type: string; position: V3 }[] }
const rgb = (hex: string): number[] => [1, 3, 5].map(i => { const s = parseInt(hex.slice(i, i + 2), 16) / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
export function generateCircuit(): CircuitData {
  const records: number[] = [], colliders: CircuitCollider[] = [], path: V3[] = [], features: CircuitData['features'] = [];
  const origin = CIRCUIT_ORIGIN;
  const part = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tint: string, yaw = 0, solid = false, surface: Surface = 'asphalt', ramp = false, visible = true) => {
    if (visible) records.push(origin.x + x, y, origin.z + z, sx, sy, sz, yaw, ...rgb(tint), ramp ? 3 : 0, 0);
    if (solid) colliders.push({ position: v3(origin.x + x, y, origin.z + z), half: v3(sx / 2, ramp ? 0.10 : sy / 2, ramp ? Math.hypot(sz, sy) / 2 : sz / 2), yaw, pitch: ramp ? -Math.atan2(sy, sz) : 0, surface });
  };
  part(0, -0.22, 0, 440, 0.4, 320, '#8d9b75', 0, true, 'grass');
  // Rounded rectangular loop: clockwise, 12 m asphalt, four real 40 m-radius bends.
  for (const [cx, cz, start] of [[90, -50, -Math.PI / 2], [90, 50, 0], [-90, 50, Math.PI / 2], [-90, -50, Math.PI]]) {
    for (let i = 0; i <= 10; i++) { const a = start! + i / 10 * Math.PI / 2; path.push(v3(origin.x + cx! + Math.cos(a) * 40, 0.1, origin.z + cz! + Math.sin(a) * 40)); }
  }
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!, b = path[(i + 1) % path.length]!, length = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z), x = (a.x + b.x) / 2 - origin.x, z = (a.z + b.z) / 2 - origin.z;
    part(x, 0.02, z, 12, 0.16, length + 0.35, '#425a59', yaw, true, 'asphalt', false, false);
    for (let along = 3; along < length - 1; along += 9) part(a.x - origin.x + (b.x - a.x) * along / length, .125, a.z - origin.z + (b.z - a.z) * along / length, .16, .012, Math.min(3.4, length - along), '#f2e3ad', yaw);
    for (const side of [-1, 1]) part(x + Math.cos(yaw) * side * 5.7, 0.12, z - Math.sin(yaw) * side * 5.7, 0.13, 0.02, length, '#dde3c9', yaw);
  }
  // A separate marked test straight prevents optional jump/slope fixtures from obstructing the normal loop.
  part(0, 0.02, 0, 85, 0.16, 140, '#51635e', 0, true);
  part(0, 1.38, -7, 8, 2.6, 14, '#cda474', 0, true, 'concrete', true); features.push({ type: 'jump-ramp', position: v3(origin.x, 0.1, origin.z - 14) });
  part(28, 1.38, -7, 10, 2.6, 24, '#a7b5a0', 0, true, 'concrete', true);
  part(28, 2.72, 9, 10, 0.18, 8, '#a7b5a0', 0, true, 'concrete');
  part(28, 1.38, 25, 10, 2.6, 24, '#a7b5a0', Math.PI, true, 'concrete', true); features.push({ type: 'slope', position: v3(origin.x + 28, 0.1, origin.z - 19) });
  part(-50, 0.14, -90, 52, 0.06, 11, '#bca37b', 0, true, 'gravel'); features.push({ type: 'gravel', position: v3(origin.x - 50, 0.18, origin.z - 90) });
  part(-27, 1.6, 44, 28, 3.2, 0.7, '#976d5e', 0, true, 'concrete'); features.push({ type: 'impact-wall', position: v3(origin.x - 27, 0.1, origin.z + 44) });
  for (let i = -6; i <= 6; i++) part(-27 + i * 2, 1.55, 43.62, 0.9, 0.28, 0.03, i % 2 ? '#efdba0' : '#405651');
  for (const side of [-1, 1]) for (let i = 0; i < 15; i++) { const x = -140 + i * 20; part(x, 0.55, side * 111, 12, 1.1, 0.7, i % 2 ? '#c9d5bd' : '#bd8e72', 0, true, 'concrete'); }
  // Start gantry and a physical wall/curbs instead of an invisible perimeter fence.
  for (const x of [-106, -94]) part(x, 2.3, -98, 0.22, 4.6, 0.22, '#54766a');
  part(-100, 4.7, -98, 13, 0.8, 0.3, '#25483d');
  const base = bakeRecords(new Float32Array(records));
  // A continuous mitered road ribbon eliminates coplanar overlapping box tops at bends.
  const rp: number[] = [], rn: number[] = [], rc: number[] = [], ri: number[] = [], asphalt = rgb('#425a59');
  for (let i = 0; i < path.length; i++) {
    const a = path[(i + path.length - 1) % path.length]!, p = path[i]!, b = path[(i + 1) % path.length]!;
    const before = Math.hypot(p.x - a.x, p.z - a.z), after = Math.hypot(b.x - p.x, b.z - p.z);
    const tx = (p.x - a.x) / before + (b.x - p.x) / after, tz = (p.z - a.z) / before + (b.z - p.z) / after, t = Math.hypot(tx, tz);
    const nx = tz / t, nz = -tx / t, miter = 6 / Math.max(.85, nx * (b.z - p.z) / after - nz * (b.x - p.x) / after);
    for (const side of [-1, 1]) { rp.push(p.x + nx * miter * side, .106, p.z + nz * miter * side); rn.push(0, 1, 0); rc.push(...asphalt); }
    const j = i * 2, k = ((i + 1) % path.length) * 2; ri.push(j, k, j + 1, j + 1, k, k + 1);
  }
  const positions = new Float32Array(base.positions.length + rp.length); positions.set(base.positions); positions.set(rp, base.positions.length);
  const normals = new Float32Array(base.normals.length + rn.length); normals.set(base.normals); normals.set(rn, base.normals.length);
  const colors = new Float32Array(base.colors.length + rc.length); colors.set(base.colors); colors.set(rc, base.colors.length);
  const indices = new Uint32Array(base.indices.length + ri.length); indices.set(base.indices); indices.set(ri.map(i => i + base.positions.length / 3), base.indices.length);
  return { mesh: { positions, normals, colors, indices }, colliders, path, spawn: v3(origin.x - 75, 0.85, origin.z - 90), yaw: Math.PI / 2, features };
}
