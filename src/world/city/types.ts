import type { V3 } from "../../parkour/types";
export const CITY = {
  seed: 12219,
  size: 4000,
  half: 2000,
  chunk: 128,
  cells: 32,
  water: -0.35,
} as const;
export type DistrictId =
  | "beach"
  | "downtown"
  | "port"
  | "canals"
  | "hills"
  | "oldtown"
  | "outskirts";
export interface District {
  id: DistrictId;
  name: string;
  center: V3;
  color: string;
  description: string;
}
export interface RoadNode extends V3 {
  id: number;
  incoming: string[];
  outgoing: string[];
  turns: { from: string; to: string }[];
}
export interface RoadEdge {
  id: number;
  from: number;
  to: number;
  width: number;
  lanes: number;
  speedLimit: number;
  kind:
    | "arterial"
    | "local"
    | "highway"
    | "ramp"
    | "bridge"
    | "tunnel"
    | "mountain"
    | "promenade";
  name: string;
  points: V3[];
}
export interface Lane {
  id: string;
  edge: number;
  from: number;
  to: number;
  offset: number;
  width: number;
  speedLimit: number;
}
export interface CityMarker {
  id: string;
  name: string;
  type:
    | "parkour"
    | "gas"
    | "gunshop"
    | "paint"
    | "garage"
    | "hospital"
    | "police"
    | "landmark";
  district: DistrictId;
  position: V3;
}
export interface CityFeature {
  id: string;
  type: "ramp" | "garage" | "alley" | "underpass" | "collectible";
  district: DistrictId;
  position: V3;
  yaw: number;
}
export interface CityLayout {
  features: CityFeature[];
  seed: number;
  districts: District[];
  nodes: RoadNode[];
  edges: RoadEdge[];
  lanes: Lane[];
  markers: CityMarker[];
}
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}
// 12 floats: x,y,z, sx,sy,sz, yaw, r,g,b, shape (0 box/1 cylinder/2 cone), detail tag.
export interface ChunkData {
  key: string;
  cx: number;
  cz: number;
  lod: number;
  terrain: MeshData;
  decor: MeshData;
  batch: Float32Array;
  lights: Float32Array;
  heights: Float32Array;
  roads: MeshData;
  buildings: Float32Array;
  props: Float32Array;
  details: Float32Array;
  colliders: Float32Array;
  generationMs: number;
}
export interface WorldData {
  terrain: MeshData;
  roads: MeshData;
  impostors: Float32Array;
  layout: CityLayout;
}
