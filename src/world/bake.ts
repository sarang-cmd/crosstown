import {
  BufferGeometry,
  Float32BufferAttribute,
  BufferAttribute,
  Object3D,
  Matrix3,
  Vector3,
  Color,
} from "three/webgpu";
import type { V3 } from "../parkour/types";
export interface BakePart {
  p: V3;
  s: V3;
  color: string;
  yaw: number;
  pitch: number;
  roll: number;
  geometry: string;
}
// Preserve every static part but submit one colored mesh per material/chunk instead of a draw per primitive kind.
export function bakeParts(
  parts: BakePart[],
  geometries: Record<string, BufferGeometry>,
): BufferGeometry {
  let vertices = 0,
    indices = 0;
  for (const p of parts) {
    const g = geometries[p.geometry]!;
    vertices += g.attributes.position!.count;
    indices += g.index?.count ?? g.attributes.position!.count;
  }
  const positions = new Float32Array(vertices * 3),
    normals = new Float32Array(vertices * 3),
    colors = new Float32Array(vertices * 3),
    ix = new Uint32Array(indices),
    temp = new Object3D(),
    normalMatrix = new Matrix3(),
    v = new Vector3(),
    n = new Vector3(),
    tint = new Color();
  let offset = 0,
    cursor = 0;
  for (const p of parts) {
    const g = geometries[p.geometry]!,
      pos = g.attributes.position!,
      nor = g.attributes.normal!;
    temp.position.copy(p.p);
    temp.scale.copy(p.s);
    temp.rotation.set(p.pitch, p.yaw, p.roll, "YXZ");
    temp.updateMatrix();
    normalMatrix.getNormalMatrix(temp.matrix);
    tint.set(p.color);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(temp.matrix);
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      const k = (offset + i) * 3;
      positions.set([v.x, v.y, v.z], k);
      normals.set([n.x, n.y, n.z], k);
      colors.set([tint.r, tint.g, tint.b], k);
    }
    for (let i = 0; i < (g.index?.count ?? pos.count); i++)
      ix[cursor++] = offset + (g.index ? g.index.getX(i) : i);
    offset += pos.count;
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  out.setAttribute("color", new Float32BufferAttribute(colors, 3));
  out.setIndex(new BufferAttribute(ix, 1));
  out.computeBoundingSphere();
  return out;
}
