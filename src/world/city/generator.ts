import { inActivityYard } from '../../challenges/sites';
import { splitDecor } from "./mesh-bake";
import { seededRandom, v3, type V3 } from "../../parkour/types";
import {
  CITY,
  type ChunkData,
  type CityLayout,
  type MeshData,
  type WorldData,
  type DistrictId,
} from "./types";
import { districtAt, terrainHeightAt, generateLayout, shoreAt } from "./layout";
const PALETTES: Record<DistrictId, string[]> = {
  beach: ["#e8b6a3", "#b8d5c6", "#eee0b4", "#afc9d1"],
  downtown: ["#749da8", "#9bb8b8", "#bdc9be", "#59828e"],
  port: ["#989c8e", "#bc9e7f", "#647f83"],
  canals: ["#e1c5a2", "#b3c8ac", "#d9b3a2"],
  hills: ["#eee5d1", "#b5bca5", "#d0c6b0"],
  oldtown: ["#b57c66", "#c69474", "#ad8b78"],
  outskirts: ["#c4ad7b", "#9f967c", "#d5bf91"],
};
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  // Vertex and instance colors are linear in Three.js. Feeding sRGB values here washed out every city surface.
  const linear = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return [
    linear((n >> 16) / 255),
    linear(((n >> 8) & 255) / 255),
    linear((n & 255) / 255),
  ];
}
class Builder {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  i: number[] = [];
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    tint: string,
    normal: V3 = v3(0, 1, 0),
  ): void {
    const base = this.p.length / 3,
      co = rgb(tint);
    for (const q of [a, b, c, d]) {
      this.p.push(q.x, q.y, q.z);
      this.n.push(normal.x, normal.y, normal.z);
      this.c.push(...co);
    }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  data(): MeshData {
    return {
      positions: new Float32Array(this.p),
      normals: new Float32Array(this.n),
      colors: new Float32Array(this.c),
      indices: new Uint32Array(this.i),
    };
  }
}
function terrain(
  x: number,
  z: number,
  w: number,
  d: number,
  steps: number,
  offset = 0,
): { mesh: MeshData; heights: Float32Array } {
  const p: number[] = [],
    n: number[] = [],
    c: number[] = [],
    indices: number[] = [],
    heights = new Float32Array((steps + 1) ** 2);
  for (let iz = 0; iz <= steps; iz++)
    for (let ix = 0; ix <= steps; ix++) {
      const px = x + (ix / steps) * w,
        pz = z + (iz / steps) * d,
        y = terrainHeightAt(px, pz);
      heights[ix * (steps + 1) + iz] = y;
      p.push(px, y + offset, pz);
      const nx = terrainHeightAt(px - 1, pz) - terrainHeightAt(px + 1, pz),
        nz = terrainHeightAt(px, pz - 1) - terrainHeightAt(px, pz + 1),
        l = Math.hypot(nx, 2, nz);
      n.push(nx / l, 2 / l, nz / l);
      const district = districtAt(px, pz),
        co = rgb(
          px < shoreAt(pz) + 130
            ? "#d9c49c"
            : district === "outskirts"
              ? "#b4ac79"
              : district === "hills"
                ? "#8eaa86"
                : district === "port"
                  ? "#989d8f"
                  : "#9caf99",
        );
      const shade = 0.97 + Math.sin(px / 47) * Math.sin(pz / 41) * 0.03;
      c.push(...co.map((v) => v * shade));
      if (ix < steps && iz < steps) {
        const k = iz * (steps + 1) + ix;
        indices.push(
          k,
          k + steps + 1,
          k + 1,
          k + 1,
          k + steps + 1,
          k + steps + 2,
        );
      }
    }
  return {
    mesh: {
      positions: new Float32Array(p),
      normals: new Float32Array(n),
      colors: new Float32Array(c),
      indices: new Uint32Array(indices),
    },
    heights,
  };
}
function roadDistance(layout: CityLayout, x: number, z: number): number {
  let best = 1e9;
  for (const e of layout.edges) {
    const a = e.points[0]!,
      b = e.points[e.points.length - 1]!,
      dx = b.x - a.x,
      dz = b.z - a.z,
      t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
      );
    best = Math.min(
      best,
      Math.hypot(x - a.x - t * dx, z - a.z - t * dz) - e.width / 2,
    );
  }
  return best;
}
function part(
  out: number[],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  tint: string,
  shape = 0,
  yaw = 0,
  tag = 0,
) {
  out.push(x, y, z, sx, sy, sz, yaw, ...rgb(tint), shape, tag);
}
function lots(
  cx: number,
  cz: number,
  lod: number,
  layout: CityLayout,
): {
  buildings: number[];
  props: number[];
  details: number[];
  colliders: number[];
} {
  const buildings: number[] = [],
    props: number[] = [],
    details: number[] = [],
    colliders: number[] = [],
    x0 = -CITY.half + cx * CITY.chunk,
    z0 = -CITY.half + cz * CITY.chunk;
  const random = seededRandom(CITY.seed ^ (cx * 73856093) ^ (cz * 19349663));
  for (let ix = 0; ix < 2; ix++)
    for (let iz = 0; iz < 2; iz++) {
      const x = x0 + 28 + ix * 64 + random() * 8,
        z = z0 + 28 + iz * 64 + random() * 8,
        d = districtAt(x, z);
      if (
        x > 1960 ||
        z > 1960 ||
        x < shoreAt(z) + 110 ||
        (Math.abs(x) < 500 && Math.abs(z) < 500) ||
        (Math.abs(x + 858) < 50 && Math.abs(z) < 1080)
      )
        continue;
      if (
        layout.features.some(
          (f) =>
            f.type !== "collectible" &&
            Math.hypot(f.position.x - x, f.position.z - z) < 60,
        )
      )
        continue;
      if(layout.markers.some(m=>(m.type==='garage'||m.type==='paint')&&Math.hypot(m.position.x-x,m.position.z-z)<56))continue;
      if(inActivityYard(x,z))continue; // Real clear lots for drift practice and two physical jump ramps.
      const width = d === "port" ? 43 : 22 + random() * 15,
        depth = d === "port" ? 37 : 20 + random() * 16;
      if (roadDistance(layout, x, z) < Math.hypot(width, depth) * 0.52 + 5)
        continue;
      const base = terrainHeightAt(x, z),
        height =
          d === "downtown"
            ? 30 + random() ** 1.5 * 94
            : d === "beach"
              ? 10 + random() * 12
              : d === "hills"
                ? 8 + random() * 7
                : d === "port"
                  ? 8 + random() * 5
                  : d === "outskirts"
                    ? 5 + random() * 6
                    : 12 + random() * 14;
      if (base < -0.2 || base > 105 || x > 1780) continue;
      const palette = PALETTES[d],
        tint = palette[Math.floor(random() * palette.length)]!;
      part(
        buildings,
        x,
        base + height / 2,
        z,
        width,
        height,
        depth,
        tint,
        0,
        0,
        d === "downtown" ? 1 : 0,
      );
      colliders.push(x, base + height / 2, z, width, height, depth, 0, 0);
      if (lod > 0) continue;
      const b = (
        dx: number,
        dy: number,
        dz: number,
        w: number,
        h: number,
        l: number,
        c: string,
        shape = 0,
        yaw = 0,
      ) => part(details, x + dx, base + dy, z + dz, w, h, l, c, shape, yaw);
      b(0, height + 0.18, 0, width + 0.5, 0.36, depth + 0.5, "#d4d7c4");
      if (d === "downtown") {
        b(0, height + 3, 0, width * 0.64, 6, depth * 0.64, "#8eb3b7");
        b(0, height + 10, 0, 0.18, 12, 0.18, "#9caea8", 1);
        b(width * 0.25, height + 1.1, 0, 3, 2.2, 3, "#738e8b");
      }
      if(d==='downtown'||d==='beach'||d==='canals'||d==='oldtown'){
        // Original Art-Deco shop ribbons, not downloaded logos/textures. A tag
        // keeps neon outside the baked opaque decor so OFF removes its draw.
        const hue=d==='downtown'?'#f055c3':d==='beach'?'#35d6e1':d==='canals'?'#9fe55b':'#ff9266';
        for(const y of [3.4,4.25])part(details,x,base+y,z+depth/2+.18,width*.76,.11,.11,hue,0,0,2);
        for(const dx of [-width*.38,width*.38])part(details,x+dx,base+3.83,z+depth/2+.18,.11,.95,.11,hue,0,0,2);
        for(let j=0;j<3;j++)part(details,x-width*.20+j*width*.20,base+3.83,z+depth/2+.20,.55,.45,.12,hue,0,0,2);
      }
      if (d === "port") {
        b(0, height + 0.8, 0, width * 0.72, 2, depth * 0.72, "#7f9290");
        for (let j = 0; j < 3; j++)
          b(
            -width * 0.3 + j * 6,
            2,
            depth * 0.6,
            5.5,
            4,
            11,
            ["#b87056", "#5a8d91", "#d1b56d"][j]!,
          );
        if ((cx + cz) % 3 === 0) {
          b(-width * 0.65, 14, 0, 0.7, 28, 0.7, "#d2b066");
          b(-width * 0.65, 27, 8, 0.7, 0.7, 26, "#ddb970");
          b(-width * 0.65, 20, 18, 0.08, 14, 0.08, "#5a7473");
        }
      }
      if (d === "beach" || d === "canals" || d === "oldtown") {
        // First-party abstract murals and neon shop ribbons, not external brand artwork.
        b(width / 2 + 0.04, 4, 0, 0.05, 5, depth * 0.58, "#718f91");
        for (let k = 0; k < 4; k++)
          b(
            width / 2 + 0.08,
            3.3 + k * 0.55,
            -depth * 0.19 + k * 2,
            0.06,
            0.65,
            depth * 0.24,
            ["#e0ba81", "#c68d78", "#adc59c", "#d6d3ad"][k]!,
          );
        b(
          0,
          3.3,
          depth / 2 + 1.31,
          width * 0.7,
          0.15,
          0.12,
          d === "beach" ? "#eca7a1" : "#c9dca1",
        );
        for (let f = 1; f < height / 3.5; f++) {
          b(0, f * 3.4, depth / 2 + 1, width * 0.82, 0.15, 2.5, "#e1d6bb");
          b(
            0,
            f * 3.4 + 0.8,
            depth / 2 + 2,
            width * 0.82,
            0.07,
            0.07,
            "#647e76",
          );
        }
        b(
          0,
          3,
          depth / 2 + 1.3,
          width * 0.75,
          0.25,
          3.6,
          d === "oldtown" ? "#658579" : "#d69b7e",
        );
        if (d === "oldtown")
          for (let f = 1; f < height / 3.5; f++) {
            b(-width / 2 - 0.9, f * 3.4, 0, 2, 0.12, depth * 0.75, "#536c66");
            b(
              -width / 2 - 1.8,
              f * 3.4 + 0.65,
              0,
              0.06,
              1.3,
              depth * 0.75,
              "#536c66",
            );
          }
      }
      if (d === "hills") {
        b(width * 0.25, 2, depth * 0.5 + 3, width * 0.8, 4, 7, "#e1ddc9");
        b(-width * 0.28, 0.15, -depth * 0.7, 11, 0.12, 7, "#6ca9b4");
        b(0, height + 0.4, 0, width * 0.8, 0.6, depth * 0.8, "#b5997c");
      }
      if (d === "outskirts") {
        b(width / 2 + 5, 4, 0, 3, 8, 3, "#a4a895", 1);
        b(width / 2 + 5, 8.5, 0, 3, 1.2, 3, "#9da48c", 2);
      }
      // AC, water tank, solar panels: geometry exists only at near LOD, represented in the far silhouette.
      b(-width * 0.22, height + 0.65, -depth * 0.18, 3, 1.3, 2, "#b8c7b6");
      if ((cx + cz) % 3 === 0) {
        b(width * 0.24, height + 2.5, 0, 1.8, 3, 1.8, "#b9a380", 1);
        b(width * 0.24, height + 4.3, 0, 2, 1, 2, "#7d9688", 2);
      }
      const px = x - width * 0.65,
        pz = z + depth * 0.65,
        py = terrainHeightAt(px, pz);
      part(props, px, py + 4, pz, 0.22, 8, 0.22, "#a7956c", 1);
      if (d === "hills" || d === "outskirts")
        part(details, px, py + 8, pz, 2.5, 6, 2.5, "#648a70", 2);
      else
        for (let leaf = 0; leaf < 5; leaf++)
          part(
            details,
            px + Math.sin(leaf * 1.257) * 1.6,
            py + 8,
            pz + Math.cos(leaf * 1.257) * 1.6,
            1.2,
            0.2,
            5,
            "#639a7a",
            0,
            leaf * 1.257,
          );
      // Parked vehicles are now live takeable agents, never static decorative shells.
    }
  // Author six rooftop marker pavilions and services at their exact surveyed locations.
  for (const m of layout.markers) {
    if (
      Math.floor((m.position.x + 2000) / 128) !== cx ||
      Math.floor((m.position.z + 2000) / 128) !== cz ||
      (Math.abs(m.position.x) < 490 && Math.abs(m.position.z) < 490)
    )
      continue;
    if(m.type==='garage'||m.type==='paint') {
      const p=m.position,base=terrainHeightAt(p.x,p.z),tint=m.type==='garage'?'#73968a':'#d3aa7a';
      // A genuine open bay, side/back walls and driveway, not an inaccessible solid box.
      for(const dx of[-9,9]){part(details,p.x+dx,base+2.5,p.z,.45,5,18,tint);colliders.push(p.x+dx,base+2.5,p.z,.45,5,18,0,0);}
      part(details,p.x,base+2.5,p.z+9,18,5,.45,tint);colliders.push(p.x,base+2.5,p.z+9,18,5,.45,0,0);
      part(details,p.x,base+5.1,p.z,19,.35,19,'#dedbc3');colliders.push(p.x,base+5.1,p.z,19,.35,19,0,0);
      part(details,p.x,base+4.35,p.z-9,18,1.3,.4,tint);part(details,p.x,base+.04,p.z-8,28,.08,36,'#5d716c');colliders.push(p.x,base-.04,p.z-8,28,.16,36,0,0);
      part(details,p.x,base+3.55,p.z-9.23,12,.08,.05,'#e6edbb');
      for(const dx of[-3,3])part(details,p.x+dx,base+.10,p.z-12,.08,.02,17,'#e0d0a5');
      continue;
    }
    const x = m.position.x,
      z = m.position.z,
      base = terrainHeightAt(x, z),
      h =
        m.type === "parkour"
          ? m.position.y - base
          : m.type === "landmark"
            ? 24
            : m.type === "hospital"
              ? 25
              : 12;
    part(
      buildings,
      x,
      base + h / 2,
      z,
      m.type === "landmark" ? 22 : 18,
      h,
      m.type === "landmark" ? 22 : 18,
      m.type === "police"
        ? "#90acb7"
        : m.type === "hospital"
          ? "#dedcc6"
          : "#c7bc9d",
    );
    colliders.push(x, base + h / 2, z, 18, h, 18, 0, 0);
    if (lod === 0) {
      part(details, x, base + h + 0.2, z, 20, 0.35, 20, "#e3dfc4");
      if (m.type === "gas") {
        part(details, x + 22, base + 4, z, 20, 0.6, 14, "#e9c087");
        for (const dx of [-7, 7])
          part(props, x + 22 + dx, base + 2, z, 0.3, 4, 0.3, "#627d78");
      }
      if (m.type === "landmark")
        part(
          details,
          x,
          base + h + 6,
          z,
          8,
          12,
          8,
          "#b8c9b8",
          m.district === "hills" ? 2 : 1,
        );
    }
  }
  return { buildings, props, details, colliders };
}
function roadMesh(
  cx: number,
  cz: number,
  layout: CityLayout,
  lod: number,
): { mesh: MeshData; colliders: number[]; props: number[]; details: number[] } {
  const x0 = -2000 + cx * 128,
    z0 = -2000 + cz * 128,
    x1 = Math.min(2000, x0 + 128),
    z1 = Math.min(2000, z0 + 128),
    b = new Builder(),
    colliders: number[] = [],
    props: number[] = [],
    details: number[] = [];
  for (const e of layout.edges)
    for (let i = 1; i < e.points.length; i++) {
      const a = e.points[i - 1]!,
        c = e.points[i]!,
        mx = (a.x + c.x) / 2,
        mz = (a.z + c.z) / 2;
      if (mx < x0 || mx >= x1 || mz < z0 || mz >= z1) continue;
      const dx = c.x - a.x,
        dz = c.z - a.z,
        len = Math.hypot(dx, dz),
        sx = dz / len,
        sz = -dx / len;
      const strip = (
        offset: number,
        width: number,
        tint: string,
        raise = 0,
      ) => {
        const point = (p: V3, s: number) =>
          v3(p.x + sx * s, p.y + raise, p.z + sz * s);
        b.quad(
          point(a, offset - width / 2),
          point(c, offset - width / 2),
          point(c, offset + width / 2),
          point(a, offset + width / 2),
          tint,
        );
      };
      const walkWidth=Math.max(e.width,...[e.from,e.to].flatMap(id=>layout.nodes[id]!.outgoing.map(l=>layout.edges[Number(l.split(':')[0])]!.width)));
      strip(0, walkWidth + 10.2, "#c6c9b7", -0.025);
      strip(0, e.width, e.kind === "promenade" ? "#bfa985" : "#596b6d");
      strip(-e.width / 2 - 0.15, 0.3, "#dde0cb", 0.12);
      strip(e.width / 2 + 0.15, 0.3, "#dde0cb", 0.12);
      if (e.lanes === 4 && i > 1 && i < e.points.length - 1)
        strip(0, 1.2, "#8fa783", 0.13);
      strip(0, 0.15, "#e7d7a3", 0.014);
      strip(-e.width / 2 + 0.35, 0.12, "#e5e3c6", 0.018);
      strip(e.width / 2 - 0.35, 0.12, "#e5e3c6", 0.018);
      if (e.lanes === 4) {
        strip(-e.width / 4, 0.1, "#d7d9bf", 0.018);
        strip(e.width / 4, 0.1, "#d7d9bf", 0.018);
      }
      colliders.push(
        mx,
        (a.y + c.y) / 2 - 0.22,
        mz,
        e.width + 1,
        0.4,
        Math.hypot(len, c.y - a.y) + 0.3,
        Math.atan2(dx, dz),
        -Math.atan2(c.y - a.y, len),
      );
      if (
        e.kind === "bridge" ||
        e.kind === "ramp" ||
        e.kind === "mountain" ||
        e.kind === "tunnel" ||
        e.kind === "highway"
      ) {
        // Retain edge barriers only on elevated/high-speed structures.
        /* colliders.push(mx,(a.y+c.y)/2-0.22,mz,e.width+1,0.4,Math.hypot(len,c.y-a.y)+0.3,Math.atan2(dx,dz),-Math.atan2(c.y-a.y,len)); */
        for (const side of [-1, 1])
          part(
            props,
            mx + sx * (e.width / 2 + 0.25) * side,
            (a.y + c.y) / 2 + 0.6,
            mz + sz * (e.width / 2 + 0.25) * side,
            0.12,
            1.2,
            len,
            "#859b91",
            0,
            Math.atan2(dx, dz),
          );
        if (e.kind === "tunnel") {
          part(
            details,
            mx,
            (a.y + c.y) / 2 + 5,
            mz,
            e.width + 2,
            0.6,
            len + 0.2,
            "#869084",
            0,
            Math.atan2(dx, dz),
          );
          for (const side of [-1, 1])
            part(
              props,
              mx + sx * (e.width / 2 + 1) * side,
              (a.y + c.y) / 2 + 2.5,
              mz + sz * (e.width / 2 + 1) * side,
              1,
              5,
              len,
              "#859084",
              0,
              Math.atan2(dx, dz),
            );
        }
      }
      if (lod === 0 && i % 3 === 0)
        for (const side of [-1, 1]) {
          const x = mx + sx * (e.width / 2 + 1.8) * side,
            z = mz + sz * (e.width / 2 + 1.8) * side,
            y = terrainHeightAt(x, z);
          part(props, x, y + 4, z, 0.09, 8, 0.09, "#637b73", 1);
          part(
            details,
            x + sx * 1.1 * side,
            y + 8,
            z + sz * 1.1 * side,
            2.4,
            0.12,
            0.16,
            "#6d8479",
            0,
            Math.atan2(-sz, sx),
          );
          part(
            details,
            x + sx * 2 * side,
            y + 7.9,
            z + sz * 2 * side,
            0.45,
            0.12,
            0.7,
            "#e6ddb2",
            0,
            0,
            1,
          );
          part(props, x + 1, y + 0.65, z + 1, 0.35, 1.3, 0.35, "#b87c57", 1);
          part(props, x + 3, y + 0.45, z + 1, 1.8, 0.1, 0.6, "#ac9272");
          part(props, x + 4, y + 0.45, z - 2, 0.55, 0.9, 0.55, "#698a7f");
        }
    }
  for (const n of layout.nodes)
    if (n.x >= x0 && n.x < x1 && n.z >= z0 && n.z < z1) {
      const y = n.y + 0.02;
      const width=Math.max(10,...n.outgoing.map(l=>layout.edges[Number(l.split(':')[0])]!.width)),radius=width/2+3.2;
      // Four zebra crossings match the exact corner-to-corner pedestrian links.
      for(const axis of ['x','z'])for(const sign of [-1,1])for(let k=-radius+.6;k<radius;k+=1.2){
        const point=(across:number,along:number)=>axis==='x'?v3(n.x+across,y,n.z+along):v3(n.x+along,y,n.z+across);
        b.quad(point(sign*radius-1.4,k-.25),point(sign*radius+1.4,k-.25),point(sign*radius+1.4,k+.25),point(sign*radius-1.4,k+.25),'#e4e3c8');
      }
      // Signal poles/heads are owned by the synchronized traffic simulation.
    }
  return { mesh: b.data(), colliders, props, details };
}
function addFeatures(
  cx: number,
  cz: number,
  layout: CityLayout,
  out: {
    buildings: number[];
    props: number[];
    details: number[];
    colliders: number[];
  },
): void {
  for (const f of layout.features) {
    if (
      Math.floor((f.position.x + 2000) / 128) !== cx ||
      Math.floor((f.position.z + 2000) / 128) !== cz ||
      f.type === "collectible"
    )
      continue;
    const p = f.position,
      b = (
        dx: number,
        dy: number,
        dz: number,
        w: number,
        h: number,
        l: number,
        tint: string,
        solid = false,
        pitch = 0,
      ) => {
        part(
          out.details,
          p.x + dx,
          p.y + dy,
          p.z + dz,
          w,
          h,
          l,
          tint,
          0,
          f.yaw,
        );
        if (solid)
          out.colliders.push(
            p.x + dx,
            p.y + dy,
            p.z + dz,
            w,
            h,
            l,
            f.yaw,
            pitch,
          );
      };
    if (f.type === "ramp") {
      const dy = 2.6,
        len = 12;
      part(
        out.details,
        p.x,
        p.y + dy / 2,
        p.z,
        7,
        dy,
        len,
        "#d9bc7d",
        3,
        f.yaw,
      );
      out.colliders.push(
        p.x,
        p.y + dy / 2,
        p.z,
        7,
        0.32,
        Math.hypot(len, dy),
        f.yaw,
        -Math.atan2(dy, len),
      );
      for (const side of [-1, 1])
        b(side * 3.6, 0.4, 0, 0.18, 0.8, 12, "#79988d");
    }
    if (f.type === "garage") {
      for (let level = 0; level < 4; level++) {
        b(0, level * 4 - 0.1, 0, 44, 0.3, 56, "#a6b4a1", true);
        for (const x of [-18, 18])
          for (const z of [-22, 0, 22])
            b(x, level * 4 + 1.9, z, 0.7, 4, 0.7, "#a5ad99", true);
        for (const side of [-1, 1])
          b(side * 21.4, level * 4 + 0.65, 0, 0.25, 1, 56, "#c8cbb3", true);
      }
      b(0, 14, -28, 42, 2.8, 0.35, "#6e9188");
    }
    if (f.type === "alley") {
      for (const side of [-1, 1]) {
        b(side * 8, 8, 0, 8, 16, 62, side < 0 ? "#bc886f" : "#a77c69", true);
        for (let floor = 1; floor < 4; floor++)
          b(side * 4.5, floor * 4, 0, 1.4, 0.12, 42, "#668177");
      }
      b(0, 0.1, 0, 8, 0.15, 65, "#717f70");
      b(2, 0.7, 12, 1.6, 1.4, 2, "#587d6a", true);
    }
    if (f.type === "underpass") {
      for (const x of [-52, 52])
        for (const z of [-10, 10]) b(x, 2.2, z, 1, 4.4, 1, "#a5ad96", true);
    }
  }
}
export function generateChunk(
  cx: number,
  cz: number,
  lod = 0,
  layout: CityLayout = generateLayout(),
): ChunkData {
  const start = performance.now(),
    x = -2000 + cx * 128,
    z = -2000 + cz * 128,
    t = terrain(
      x,
      z,
      Math.min(128, 2000 - x),
      Math.min(128, 2000 - z),
      16,
      0.015,
    ),
    l = lots(cx, cz, lod, layout),
    r = roadMesh(cx, cz, layout, lod);
  addFeatures(cx, cz, layout, l);
  const decor = splitDecor(
    [...l.props, ...r.props],
    [...l.details, ...r.details],
  );
  return {
    ...decor,
    key: `${cx},${cz}`,
    cx,
    cz,
    lod,
    terrain: t.mesh,
    heights: t.heights,
    roads: r.mesh,
    buildings: new Float32Array(l.buildings),
    props: new Float32Array([...l.props, ...r.props]),
    details: new Float32Array([...l.details, ...r.details]),
    colliders: new Float32Array([...l.colliders, ...r.colliders]),
    generationMs: performance.now() - start,
  };
}
export function generateWorld(): WorldData {
  const layout = generateLayout(),
    impostors: number[] = [];
  for (let cz = 0; cz < 32; cz++)
    for (let cx = 0; cx < 32; cx++)
      impostors.push(...lots(cx, cz, 1, layout).buildings);
  const roads = new Builder();
  for (const e of layout.edges)
    for (let i = 1; i < e.points.length; i++) {
      const a = e.points[i - 1]!,
        b = e.points[i]!,
        dx = b.x - a.x,
        dz = b.z - a.z,
        l = Math.hypot(dx, dz),
        sx = dz / l,
        sz = -dx / l;
      for (const [width, tint] of [
        [e.width + 5, "#c6c9b7"],
        [e.width, "#596b6d"],
      ] as const) {
        const p = (q: V3, sign: number) =>
          v3(
            q.x + ((sx * width) / 2) * sign,
            q.y - (width === e.width ? 0.025 : 0.035),
            q.z + ((sz * width) / 2) * sign,
          );
        roads.quad(p(a, -1), p(b, -1), p(b, 1), p(a, 1), tint);
      }
    }
  return {
    terrain: terrain(-2000, -2000, 4000, 4000, 96, -0.04).mesh,
    roads: roads.data(),
    impostors: new Float32Array(impostors),
    layout,
  };
}
export function transferBuffers(
  value: unknown,
  out: ArrayBuffer[] = [],
): ArrayBuffer[] {
  if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer)
    out.push(value.buffer);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) transferBuffers(v, out);
  return out;
}
