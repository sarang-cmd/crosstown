// Fixed geography and navigable lane graph. No Three.js or Rapier allocations in worker data generation.
import { v3, type V3 } from "../../parkour/types";
import {
  CITY,
  type CityLayout,
  type DistrictId,
  type RoadEdge,
  type RoadNode,
  type Lane,
  type District,
  type CityFeature,
} from "./types";
export const DISTRICTS: District[] = [
  {
    id: "beach",
    name: "West Beach",
    center: v3(-1500, 0, -650),
    color: "#e2c59e",
    description: "Pastel Art Deco, palms and the boardwalk.",
  },
  {
    id: "downtown",
    name: "Downtown",
    center: v3(100, 0, 150),
    color: "#8bb8c4",
    description: "Glass towers, plazas and the rooftop circuit.",
  },
  {
    id: "port",
    name: "South Port",
    center: v3(-850, 0, 1200),
    color: "#b78d68",
    description: "Freight sheds, containers and dock cranes.",
  },
  {
    id: "canals",
    name: "Canal Ward",
    center: v3(-850, 0, 20),
    color: "#b8d0bb",
    description: "Quays, arched bridges and waterside homes.",
  },
  {
    id: "hills",
    name: "North Hills",
    center: v3(1080, 0, -950),
    color: "#9ba786",
    description: "Terraced villas, pines and the overlook.",
  },
  {
    id: "oldtown",
    name: "Old Town",
    center: v3(950, 0, 680),
    color: "#bd8c78",
    description: "Brick blocks, awnings, alleys and fire escapes.",
  },
  {
    id: "outskirts",
    name: "County Line",
    center: v3(1100, 0, 1550),
    color: "#c5ad75",
    description: "Dry fields, roadside stops and rocky ridges.",
  },
];
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
export function districtAt(x: number, z: number): DistrictId {
  if (x < -1300) return "beach";
  if (z > 750 && x < -350) return "port";
  if (x < -600 && Math.abs(z) < 800) return "canals";
  if (x > 630 && z < -450) return "hills";
  if ((x > 650 && z > 1200) || Math.abs(z) > 1640 || x > 1600)
    return "outskirts";
  if (x > 580 && z > -350) return "oldtown";
  return "downtown";
}
export const shoreAt = (z: number) => -1655 + Math.sin(z / 390) * 24;
export const canalAt = (z: number) => -858 + Math.sin(z / 210) * 18;
export function baseHeightAt(x: number, z: number): number {
  const coast = shoreAt(z),
    inland = smooth((x - coast) / 90);
  const hills =
    smooth((x - 650) / 1050) *
    smooth((-z + 350) / 1000) *
    (48 + 24 * Math.sin(x / 310) * Math.cos(z / 360));
  const ridge =
    smooth((x - 1650) / 280) * 240 +
    smooth((-z - 1700) / 240) * 170 +
    smooth((z - 1760) / 200) * (75 + Math.sin(x / 120) * 22);
  const sand = x < -1420 ? 0.2 + Math.sin(z / 130) * 0.12 : 0;
  return -6 * (1 - inland) + (hills + ridge + sand) * inland;
}
export function terrainHeightAt(x: number, z: number): number {
  let y = baseHeightAt(x, z);
  // Continuous canal bed; bridge decks are separate geometry and colliders, never painted-on water.
  if (z > -1040 && z < 1080) {
    const bank = Math.abs(x - canalAt(z)),
      cut =
        smooth((36 - bank) / 9) *
        smooth((z + 1040) / 80) *
        smooth((1080 - z) / 80);
    y = y * (1 - cut) + -3.3 * cut;
  }
  return y;
}
export function roadHeightAt(x: number, z: number, bridge = false): number {
  return baseHeightAt(x, z) + (bridge ? 2.5 : 0.095);
}
export function generateLayout(seed: number = CITY.seed): CityLayout {
  const nodes: RoadNode[] = [],
    edges: RoadEdge[] = [],
    lanes: Lane[] = [],
    nodeAt = new Map<string, number>();
  const node = (x: number, z: number) => {
    const key = `${x},${z}`;
    const found = nodeAt.get(key);
    if (found !== undefined) return found;
    const id = nodes.length;
    nodes.push({
      id,
      x,
      y: roadHeightAt(x, z),
      z,
      incoming: [],
      outgoing: [],
      turns: [],
    });
    nodeAt.set(key, id);
    return id;
  };
  const connect = (
    from: number,
    to: number,
    kind: RoadEdge["kind"] = "local",
    width = 10,
  ) => {
    const a = nodes[from]!,
      b = nodes[to]!,
      id = edges.length;
    const bridge =
      ((a.x < -830 && b.x > -890) || (b.x < -830 && a.x > -890)) &&
      Math.abs(a.z) < 1040 &&
      Math.abs(b.z) < 1040 &&
      Math.abs(a.x - b.x) > 100;
    if (bridge && kind !== "highway") kind = "bridge";
    const points = Array.from(
      { length: Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 24) + 1 },
      () => v3(),
    );
    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1),
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      points[i] = v3(
        x,
        roadHeightAt(x, z) +
          (bridge
            ? Math.sin(Math.PI * t) * 2.5
            : kind === "highway" &&
                a.z === 1536 &&
                b.z === 1536 &&
                Math.min(a.x, b.x) === 1280
              ? Math.sin(Math.PI * t) * 8
              : 0),
        z,
      );
    }
    const count = kind === "highway" ? 4 : kind === "arterial" ? 4 : 2,
      speedLimit =
        kind === "highway"
          ? 100
          : kind === "arterial"
            ? 60
            : kind === "promenade"
              ? 15
              : kind === "mountain"
                ? 35
                : 40;
    edges.push({
      id,
      from,
      to,
      width,
      lanes: count,
      speedLimit,
      kind,
      name:
        kind === "highway"
          ? "Crosstown Beltway"
          : kind === "mountain"
            ? "Ridge Road"
            : `${["Grand", "Market", "Harbor", "Bay", "Union", "Oak", "Hill", "Broad"][id % 8]} ${id % 2 ? "Street" : "Avenue"}`,
      points,
    });
    for (let l = 0; l < count; l++) {
      const reverse = l >= count / 2,
        start = reverse ? to : from,
        end = reverse ? from : to,
        lane: Lane = {
          id: `${id}:${l}`,
          edge: id,
          from: start,
          to: end,
          offset: ((l - (count - 1) / 2) * width) / count,
          width: width / count,
          speedLimit,
        };
      lanes.push(lane);
      nodes[start]!.outgoing.push(lane.id);
      nodes[end]!.incoming.push(lane.id);
    }
  };
  for (let x = -1536; x <= 1792; x += 256)
    for (let z = -1536; z <= 1792; z += 256)
      if (!(Math.abs(x) < 512 && Math.abs(z) < 512)) node(x, z);
  for (const a of [...nodes])
    for (const [dx, dz] of [
      [256, 0],
      [0, 256],
    ]) {
      const to = nodeAt.get(`${a.x + dx!},${a.z + dz!}`);
      if (to === undefined) continue;
      const highway =
          (Math.abs(a.z) === 1536 && !dz) || (Math.abs(a.x) === 1536 && !dx),
        arterial = (a.x % 768 === 0 && !dx) || (a.z % 768 === 0 && !dz);
      connect(
        a.id,
        to,
        highway ? "highway" : arterial ? "arterial" : "local",
        highway ? 26 : arterial ? 18 : 10,
      );
    }
  connect(node(-1536, 0), node(-1660, 0), "promenade", 6);
  // Explicit ramps attach the beltway to local lanes; the road graph remains fully navigable.
  connect(node(1536, -1280), node(1400, -1400), "ramp", 9);
  connect(node(1400, -1400), node(1280, -1536), "ramp", 9);
  const mountain: [number, number][] = [
    [1536, -768],
    [1700, -850],
    [1810, -1020],
    [1600, -1120],
    [1760, -1270],
    [1850, -1420],
    [1670, -1510],
    [1536, -1536],
  ];
  for (let i = 1; i < mountain.length; i++)
    connect(
      node(...mountain[i - 1]!),
      node(...mountain[i]!),
      i === 3 ? "tunnel" : "mountain",
      9,
    );
  connect(node(1280, 1280), node(1408, 1408), "local", 9);
  connect(node(1408, 1408), node(1408, 1664), "local", 9);
  connect(node(1408, 1664), node(1280, 1792), "local", 9);
  for (const n of nodes)
    for (const from of n.incoming)
      for (const to of n.outgoing)
        if (from.split(":")[0] !== to.split(":")[0]) n.turns.push({ from, to });
  const markers: CityLayout["markers"] = [
    {id:'garage-central',type:'garage',district:'downtown',name:'Crosstown Motor House',position:v3(544,terrainHeightAt(544,544),544)},
    {id:'paint-central',type:'paint',district:'downtown',name:'Daybreak Colour Works',position:v3(544,terrainHeightAt(544,800),800)},
  ];
  DISTRICTS.forEach((d, i) => {
    const n = nodes.reduce(
      (best, n) =>
        Math.hypot(n.x - d.center.x, n.z - d.center.z) <
        Math.hypot(best.x - d.center.x, best.z - d.center.z)
          ? n
          : best,
      nodes[0]!,
    );
    const kinds = [
      "gas",
      "gunshop",
      "paint",
      "garage",
      "hospital",
      "police",
    ] as const;
    const type = kinds[i % kinds.length]!;
    markers.push({
      id: `service-${d.id}`,
      type,
      district: d.id,
      name: [
        "Bay Fuel",
        "Union Sporting",
        "Fresh Coat",
        "Public Garage",
        "County Hospital",
        "West Precinct",
      ][i % 6]!,
      position: v3(n.x + 32, terrainHeightAt(n.x + 32, n.z + 32), n.z + 32),
    });
    markers.push({
      id: `landmark-${d.id}`,
      type: "landmark",
      district: d.id,
      name: [
        "The Boardwalk",
        "Central Plaza",
        "Dock Nine",
        "Canal Bridge",
        "Ridge Lookout",
        "Market Hall",
        "The Water Tank",
      ][i]!,
      position: { ...d.center, y: terrainHeightAt(d.center.x, d.center.z) },
    });
    if (i < 6)
      markers.push({
        id: `parkour-${i}`,
        type: "parkour",
        district: d.id,
        name: `${d.name} Rooftops`,
        position:
          i === 1
            ? v3(0, 27.045, 17)
            : v3(
                n.x + 70,
                terrainHeightAt(n.x + 70, n.z + 60) +
                  (d.id === "hills" ? 12 : 18),
                n.z + 60,
              ),
      });
  });
  const features: CityFeature[] = [
    {
      id: "dock-ramp",
      type: "ramp",
      district: "port",
      position: v3(-1120, 0, 1280),
      yaw: Math.PI / 2,
    },
    {
      id: "county-ramp",
      type: "ramp",
      district: "outskirts",
      position: v3(1280, 0, 1680),
      yaw: 0,
    },
    {
      id: "market-garage",
      type: "garage",
      district: "oldtown",
      position: v3(704, 0, 256),
      yaw: 0,
    },
    {
      id: "market-alley",
      type: "alley",
      district: "oldtown",
      position: v3(832, 0, 704),
      yaw: 0,
    },
    {
      id: "beltway-underpass",
      type: "underpass",
      district: "outskirts",
      position: v3(1408, 0, 1536),
      yaw: 0,
    },
  ];
  for (const f of features)
    f.position.y = terrainHeightAt(f.position.x, f.position.z);
  for (const m of markers.filter(
    (m) => m.type === "parkour" && m.id !== "parkour-1",
  ))
    features.push({
      id: `cache-${m.district}`,
      type: "collectible",
      district: m.district,
      position: v3(m.position.x - 5, m.position.y + 1.3, m.position.z - 5),
      yaw: 0,
    });
  features.push({
    id: "cache-garage",
    type: "collectible",
    district: "oldtown",
    position: v3(704, 13.3, 256),
    yaw: 0,
  });
  return { seed, districts: DISTRICTS, nodes, edges, lanes, markers, features };
}
export function nearestRoad(layout: CityLayout, p: V3): RoadNode {
  return layout.nodes.reduce((a, b) =>
    Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b,
  );
}

/** Shortest connected road route for map waypoints. No straight-line claim through buildings. */
export function routeToWaypoint(layout: CityLayout, from: V3, to: V3): V3[] {
  const nearest = (p: V3) =>
    layout.nodes.reduce((a, b) =>
      Math.hypot(a.x - p.x, a.z - p.z) <= Math.hypot(b.x - p.x, b.z - p.z)
        ? a
        : b,
    ).id;
  const start = nearest(from),
    goal = nearest(to),
    distance = new Map<number, number>([[start, 0]]),
    previous = new Map<number, { node: number; edge: RoadEdge }>(),
    open = new Set(layout.nodes.map((n) => n.id));
  while (open.size) {
    let current = -1,
      best = Infinity;
    for (const n of open) {
      const d = distance.get(n) ?? Infinity;
      if (d < best) {
        current = n;
        best = d;
      }
    }
    if (current === -1 || current === goal) break;
    open.delete(current);
    for (const edge of layout.edges) {
      if (edge.from !== current && edge.to !== current) continue;
      const next = edge.from === current ? edge.to : edge.from;
      if (!open.has(next)) continue;
      let length = 0;
      for (let i = 1; i < edge.points.length; i++)
        length += Math.hypot(
          edge.points[i]!.x - edge.points[i - 1]!.x,
          edge.points[i]!.z - edge.points[i - 1]!.z,
        );
      const alternative = best + length;
      if (alternative < (distance.get(next) ?? Infinity)) {
        distance.set(next, alternative);
        previous.set(next, { node: current, edge });
      }
    }
  }
  const legs: V3[][] = [];
  let node = goal;
  while (node !== start) {
    const p = previous.get(node);
    if (!p) return [];
    legs.unshift(
      p.edge.from === p.node ? p.edge.points : [...p.edge.points].reverse(),
    );
    node = p.node;
  }
  return [{ ...from }, ...legs.flat(), { ...to }];
}
