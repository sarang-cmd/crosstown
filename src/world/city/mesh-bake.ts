// Pure worker-side static mesh baking. Keeps every decorative part without a WebGL draw per prop.
import type { MeshData } from "./types";
type Vertex = [number, number, number];
interface Shape {
  p: number[];
  n: number[];
  i: number[];
}
const shapes: Shape[] = [];
function face(
  s: Shape,
  a: Vertex,
  b: Vertex,
  c: Vertex,
  d: Vertex,
  n: Vertex,
): void {
  const k = s.p.length / 3;
  for (const p of [a, b, c, d]) {
    s.p.push(...p);
    s.n.push(...n);
  }
  s.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
}
function box(ramp = false): Shape {
  const s: Shape = { p: [], n: [], i: [] };
  face(
    s,
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
    [0, 0, 1],
  );
  face(
    s,
    [0.5, -0.5, -0.5],
    [-0.5, -0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [0.5, 0.5, -0.5],
    [0, 0, -1],
  );
  face(
    s,
    [0.5, -0.5, 0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [0.5, 0.5, 0.5],
    [1, 0, 0],
  );
  face(
    s,
    [-0.5, -0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [-0.5, 0.5, 0.5],
    [-0.5, 0.5, -0.5],
    [-1, 0, 0],
  );
  face(
    s,
    [-0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [0, 1, 0],
  );
  face(
    s,
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, -0.5, 0.5],
    [-0.5, -0.5, 0.5],
    [0, -1, 0],
  );
  if (ramp) {
    for (let k = 0; k < s.p.length; k += 3)
      s.p[k + 1] = s.p[k + 2]! + s.p[k + 1]! * 0.12;
    for (let k = 0; k < s.n.length; k += 3) {
      if (Math.abs(s.n[k + 1]!) > 0.5) s.n[k + 2] = -s.n[k + 1]!;
    }
  }
  return s;
}
function radial(cone = false): Shape {
  const s: Shape = { p: [], n: [], i: [] },
    segments = 8;
  for (let j = 0; j < segments; j++) {
    const a = (j / segments) * Math.PI * 2,
      b = ((j + 1) / segments) * Math.PI * 2,
      x = Math.sin(a),
      z = Math.cos(a),
      u = Math.sin(b),
      v = Math.cos(b),
      k = s.p.length / 3;
    if (cone) {
      s.p.push(x, -0.5, z, u, -0.5, v, 0, 0.5, 0);
      const nx = Math.sin((a + b) / 2),
        nz = Math.cos((a + b) / 2);
      for (let i = 0; i < 3; i++) s.n.push(nx, 0.9, nz);
      s.i.push(k, k + 1, k + 2);
    } else
      face(
        s,
        [x, -0.5, z],
        [u, -0.5, v],
        [u, 0.5, v],
        [x, 0.5, z],
        [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
      );
    const q = s.p.length / 3;
    s.p.push(0, -0.5, 0, u, -0.5, v, x, -0.5, z);
    for (let i = 0; i < 3; i++) s.n.push(0, -1, 0);
    s.i.push(q, q + 1, q + 2);
    if (!cone) {
      const q = s.p.length / 3;
      s.p.push(0, 0.5, 0, x, 0.5, z, u, 0.5, v);
      for (let i = 0; i < 3; i++) s.n.push(0, 1, 0);
      s.i.push(q, q + 1, q + 2);
    }
  }
  return s;
}
shapes.push(box(), radial(), radial(true), box(true));
export function bakeRecords(a: Float32Array): MeshData {
  let vertices = 0,
    indices = 0;
  for (let k = 0; k < a.length; k += 12) {
    const s = shapes[a[k + 10]!]!;
    vertices += s.p.length / 3;
    indices += s.i.length;
  }
  const p = new Float32Array(vertices * 3),
    n = new Float32Array(vertices * 3),
    c = new Float32Array(vertices * 3),
    ix = new Uint32Array(indices);
  let offset = 0,
    cursor = 0;
  for (let k = 0; k < a.length; k += 12) {
    const s = shapes[a[k + 10]!]!,
      cos = Math.cos(a[k + 6]!),
      sin = Math.sin(a[k + 6]!),
      sx = a[k + 3]!,
      sy = a[k + 4]!,
      sz = a[k + 5]!;
    for (let j = 0; j < s.p.length; j += 3) {
      const x = s.p[j]! * sx,
        y = s.p[j + 1]! * sy,
        z = s.p[j + 2]! * sz,
        t = offset * 3 + j;
      p[t] = a[k]! + x * cos + z * sin;
      p[t + 1] = a[k + 1]! + y;
      p[t + 2] = a[k + 2]! - x * sin + z * cos;
      const nx = s.n[j]! / sx,
        ny = s.n[j + 1]! / sy,
        nz = s.n[j + 2]! / sz,
        len = Math.hypot(nx, ny, nz) || 1;
      n[t] = (nx * cos + nz * sin) / len;
      n[t + 1] = ny / len;
      n[t + 2] = (-nx * sin + nz * cos) / len;
      c[t] = a[k + 7]!;
      c[t + 1] = a[k + 8]!;
      c[t + 2] = a[k + 9]!;
    }
    for (const index of s.i) ix[cursor++] = offset + index;
    offset += s.p.length / 3;
  }
  return { positions: p, normals: n, colors: c, indices: ix };
}
export function splitDecor(
  props: number[],
  details: number[],
): { decor: MeshData; batch: Float32Array; lights: Float32Array } {
  const all = [...props, ...details],
    plain: number[] = [],
    lights: number[] = [];
  for (let k = 0; k < all.length; k += 12)
    for (let j = 0; j < 12; j++)
      (all[k + 11]! > 0 ? lights : plain).push(all[k + j]!);
  return {
    decor: bakeRecords(new Float32Array(plain)),
    batch: new Float32Array(),
    lights: new Float32Array(lights),
  };
}
