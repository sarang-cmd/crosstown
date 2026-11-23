import { RUN_LENGTHS, type RunLength } from "../config/session";
// Pure deterministic generation, run in a Web Worker in the browser. No render/physics objects cross the boundary.
import {
  maximumJumpDistance,
  maximumJumpHeight,
  jumpFlightTime,
  windDrift,
  MOVEMENT,
} from "../config/movement";
import {
  SEGMENT_TYPES,
  add,
  direction,
  distance,
  horizontal,
  seededRandom,
  v3,
  type V3,
  type Roof,
  type RouteData,
  type Slab,
  type SegmentType,
  type JumpProof,
} from "./types";

const SPACING = 62,
  WIDTH = 59.5;
const NAMES = [
  "Sunthread",
  "Tideglass",
  "Apricot Works",
  "Saltline",
  "Sundial",
  "Paloma Yard",
  "Cloud Nine",
  "Blue Hour",
];
function hilbert(index: number, n = 8): [number, number] {
  let x = 0,
    y = 0,
    t = index;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t >> 1),
      ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += s * rx;
    y += s * ry;
    t >>= 2;
  }
  return [x, y];
}
export function checkJump(jump: JumpProof): string | null {
  const height = jump.to.y - jump.from.y;
  const required = Math.hypot(horizontal(jump.from, jump.to), jump.wind);
  // Reserve the real motor's worst-case lateral gust drift inside the ballistic envelope.
  const budget = maximumJumpDistance(height, jump.sprint);
  if (height > maximumJumpHeight)
    return `${jump.segment}: rise ${height.toFixed(2)} > ${maximumJumpHeight.toFixed(2)} m`;
  if (required > budget || budget <= 0)
    return `${jump.segment}: ${required.toFixed(2)} > safe ${budget.toFixed(2)} m`;
  if (jump.landingWidth < MOVEMENT.radius * 2 + 0.3)
    return `${jump.segment}: landing too narrow`;
  return null;
}
export function validateRoute(route: RouteData): RouteData["validation"] {
  const errors = route.jumps
    .map(checkJump)
    .filter((s): s is string => s !== null);
  if (
    route.checkpoints.length !==
    (route.training ? 8 : RUN_LENGTHS[route.length].checkpoints)
  )
    errors.push("Checkpoint count");
  if (!route.training && new Set(route.encounters.map((e) => e.type)).size < 14)
    errors.push("Segment variety");
  for (const n of route.nav)
    if (![n.position.x, n.position.y, n.position.z].every(Number.isFinite))
      errors.push("Non-finite waypoint");
  return {
    possible: errors.length === 0,
    errors,
    maxGap: Math.max(0, ...route.jumps.map((j) => horizontal(j.from, j.to))),
    maxHeight: Math.max(0, ...route.jumps.map((j) => j.to.y - j.from.y)),
  };
}
export function generateRoute(
  seed: number,
  training = false,
  length: RunLength = "full",
  cityOrigin?: V3,
): RouteData {
  const random = seededRandom(seed),
    turn = Math.floor(random() * 4),
    mirror = random() > 0.5;
  const grid: [number, number][] = training
    ? [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [2, 0],
        [2, 1],
        [3, 1],
        [3, 0],
      ]
    : Array.from({ length: RUN_LENGTHS[length].roofs }, (_, i) => hilbert(i));
  const transform = ([x, z]: [number, number]): [number, number] => {
    if (training) return [x, z];
    if (mirror) x = 7 - x;
    for (let t = 0; t < turn; t++) [x, z] = [7 - z, x];
    return [x, z];
  };
  const coordinates = grid.map(transform),
    origin = coordinates[0]!;
  const roofs: Roof[] = coordinates.map(([x, z], i) => ({
    id: i,
    center: v3(
      (x - origin[0]) * SPACING + (x >= 4 ? 18 : 0) - (origin[0] >= 4 ? 18 : 0),
      i < 2
        ? 27 + i * 0.12
        : 27 + Math.sin(i * 0.37) * 3.6 + Math.sin(i * 0.12) * 1.8,
      (z - origin[1]) * SPACING + (z >= 4 ? 18 : 0) - (origin[1] >= 4 ? 18 : 0),
    ),
    width: WIDTH,
    depth: WIDTH,
    tint: random(),
    style: i % 4,
  }));
  const route: RouteData = {
    seed: seed >>> 0,
    training,
    length,
    roofs,
    slabs: [],
    nav: [],
    checkpoints: [],
    jumps: [],
    interactions: [],
    hazards: [],
    pickups: [],
    encounters: [],
    spawn: v3(),
    spawnDirection: direction(roofs[0]!.center, roofs[1]!.center),
    goal: v3(),
    carPosition: v3(),
    distance: 0,
    expectedSeconds: 0,
    validation: { possible: false, errors: [], maxGap: 0, maxHeight: 0 },
  };
  const push = (
    position: V3,
    extras: Partial<RouteData["nav"][number]> = {},
  ) => {
    route.nav.push({ position: { ...position }, ...extras });
  };
  const beam = (
    id: string,
    a: V3,
    b: V3,
    width = 2.8,
    kind: Slab["kind"] = "bridge",
    extras: Partial<Slab> = {},
  ) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > 0.25) {
      // Attach the high end at its facade, not a metre inside the solid roof (which would create an unclimbable lip).
      const forward = direction(a, b);
      a = add(a, forward, dy > 0 ? -5 : 1);
      b = add(b, forward, dy > 0 ? -1 : 5);
    }
    const length = horizontal(a, b);
    const slab: Slab = {
      id,
      center: v3((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.2, (a.z + b.z) / 2),
      size: v3(width, 0.4, Math.hypot(length, dy) + 0.6),
      yaw: Math.atan2(b.x - a.x, b.z - a.z),
      pitch: -Math.atan2(dy, length),
      roll: 0,
      kind,
      ...extras,
    };
    route.slabs.push(slab);
    return slab;
  };
  // Shuffle once, then cycle: every complete district has all seventeen authored encounter families.
  const types: SegmentType[] = [...SEGMENT_TYPES];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [types[i], types[j]] = [types[j]!, types[i]!];
  }
  types.splice(types.indexOf("gap"), 1);
  types.unshift("gap");
  const checkpointRoofs = new Set(
    training
      ? roofs.map((r) => r.id)
      : Array.from({ length: RUN_LENGTHS[length].checkpoints }, (_, c) =>
          Math.round(
            (c * (roofs.length - 1)) / (RUN_LENGTHS[length].checkpoints - 1),
          ),
        ),
  );
  route.spawn = add(roofs[0]!.center, route.spawnDirection, 17);
  route.spawn.y += 0.045;
  push(route.spawn);
  for (let i = 0; i < roofs.length; i++) {
    const roof = roofs[i]!,
      center = { ...roof.center, y: roof.center.y + 0.045 };
    const next = roofs[Math.min(roofs.length - 1, i + 1)]!;
    const forward =
      i === roofs.length - 1
        ? direction(roofs[i - 1]!.center, center)
        : direction(center, next.center);
    const side = v3(forward.z, 0, -forward.x);
    if (i > 0) {
      // Rooftop doglegs deliberately prevent a string of straight centre-to-centre sprints.
      push(add(center, side, (i % 2 ? 1 : -1) * (training ? 6 : 5)));
    }
    if (i > 0) push(center);
    if (checkpointRoofs.has(i)) {
      const id = route.checkpoints.length;
      route.checkpoints.push({
        id,
        position: i === 0 ? route.spawn : center,
        direction: forward,
        navIndex: route.nav.length - 1,
        roofId: i,
        name: NAMES[id % NAMES.length]!,
      });
      route.nav[route.nav.length - 1]!.checkpoint = id;
    }
    if (i === roofs.length - 1) {
      route.goal = add(center, forward, 21);
      push(route.goal);
      break;
    }
    const type = training
      ? SEGMENT_TYPES[[0, 8, 2, 3, 4, 7, 6][i]!]!
      : types[i % types.length]!;
    const id = `s${i}-${type}`,
      difficulty = i / (roofs.length - 1);
    const near = add(center, forward, WIDTH / 2 - 1.2);
    const far = add(
      { ...next.center, y: next.center.y + 0.045 },
      forward,
      -WIDTH / 2 + 1.2,
    );
    const branch =
      i > 0 &&
      (i % 3 === 1 ||
        [
          "wallrun",
          "crane",
          "moving",
          "tilting",
          "crumbling",
          "laser",
          "rolling",
          "drone",
          "wind",
        ].includes(type));
    route.encounters.push({
      id,
      type,
      position: near,
      direction: forward,
      roofA: i,
      roofB: i + 1,
      safeBranch: branch,
      difficulty,
    });
    // The safe branch is wider, rigid, and takes an extra dogleg. Risky branches always rejoin the same roof.
    if (branch) {
      const offset = 7 + difficulty * 4;
      const a = add(near, side, offset),
        b = add(far, side, offset);
      push(a);
      beam(`${id}-safe`, a, b, 3.2 - difficulty * 0.5, "bridge", {
        safe: true,
      });
      push(b);
      route.pickups.push({
        id: `${id}-cash`,
        type: "coin",
        position: add(near, forward, 1.1),
        value: 10,
        risk: true,
      });
    } else if (type === "gap" || type === "wind") {
      const launch = add(near, forward, 0.55),
        landing = add(far, forward, -0.55);
      const proof: JumpProof = {
        from: launch,
        to: landing,
        sprint: false,
        landingWidth: 8,
        wind:
          type === "wind"
            ? windDrift(
                5 + difficulty * 3,
                jumpFlightTime(landing.y - launch.y),
              )
            : 0,
        segment: id,
        branch: "safe",
      };
      // Reject and replace an impossible connector; never publish an untraversable seed.
      if (checkJump(proof)) {
        beam(`${id}-rejected-fallback`, near, far);
        push(near);
        push(far);
      } else {
        route.jumps.push(proof);
        push(launch, { action: "jump" });
        push(landing, { action: "land" });
      }
    } else {
      beam(
        `${id}-main`,
        near,
        far,
        type === "billboard" || type === "ledge" ? 1.7 : 2.9,
      );
      push(near);
      push(far);
    }
    if (branch || !["gap", "wind"].includes(type)) {
      if (type === "wallrun") {
        const wall = add(add(near, forward, 2.4), side, 1.15);
        wall.y += 1.35;
        route.slabs.push({
          id: `${id}-wall`,
          center: wall,
          size: v3(0.35, 3.1, 10),
          yaw: Math.atan2(forward.x, forward.z),
          pitch: 0,
          roll: 0,
          kind: "wall",
        });
      }
      const kind: Slab["kind"] = [
        "moving",
        "tilting",
        "crumbling",
        "crane",
      ].includes(type)
        ? (type as Slab["kind"])
        : "ledge";
      if (branch)
        beam(`${id}-risk`, near, far, Math.max(1, 2.4 - difficulty), kind, {
          dynamic: ["moving", "tilting", "crumbling", "crane"].includes(type),
          axis: side,
          amplitude: type === "moving" ? 0.8 + difficulty * 0.4 : 0.15,
          speed: 0.8 + difficulty * 0.6,
          phase: random() * Math.PI * 2,
        });
      if (branch) {
        const a = add(near, forward, 0.55),
          b = add(far, forward, -0.55);
        const proof: JumpProof = {
          from: a,
          to: b,
          sprint: true,
          landingWidth: type === "wind" ? 8 : 1.4,
          wind:
            type === "wind"
              ? windDrift(5 + difficulty * 3, jumpFlightTime(b.y - a.y))
              : 0,
          segment: id,
          branch: "risk",
        };
        if (!checkJump(proof)) route.jumps.push(proof);
      }
    }
    if (["zipline", "clothesline", "fireescape"].includes(type)) {
      const start = add(near, forward, -9),
        end = add(far, forward, 9);
      route.interactions.push({
        id: `${id}-traverse`,
        type:
          type === "zipline"
            ? "zipline"
            : type === "clothesline"
              ? "swing"
              : "ladder",
        start,
        end,
        duration: type === "fireescape" ? 2 : horizontal(start, end) / 11,
        label:
          type === "zipline"
            ? "Ride zipline"
            : type === "clothesline"
              ? "Swing across"
              : "Climb fire escape",
      });
    }
    if (["vents", "watertower", "ledge", "fireescape"].includes(type)) {
      // Skill line beside, never across, the broad safety line. Three steps support a genuine climb/roll/vault.
      const p = add(add(center, forward, 12), side, -7);
      route.slabs.push({
        id: `${id}-vault`,
        center: add(p, v3(0, 1, 0), 0.4),
        size: v3(3.4, 0.8, 1.4),
        yaw: Math.atan2(forward.x, forward.z),
        pitch: 0,
        roll: 0,
        kind: "vent",
      });
      route.slabs.push({
        id: `${id}-climb`,
        center: add(add(p, forward, 6), v3(0, 1, 0), 0.8),
        size: v3(3.4, 1.6, 3.8),
        yaw: Math.atan2(forward.x, forward.z),
        pitch: 0,
        roll: 0,
        kind: type === "watertower" ? "tower" : "ledge",
      });
      if (type === "vents")
        route.slabs.push({
          id: `${id}-slide`,
          center: add(add(p, forward, -5), v3(0, 1, 0), 1.28),
          size: v3(4, 0.35, 2.8),
          yaw: Math.atan2(forward.x, forward.z),
          pitch: 0,
          roll: 0,
          kind: "vent",
        });
    }
    if (["rolling", "laser", "wind", "drone"].includes(type))
      route.hazards.push({
        id: `${id}-hazard`,
        type: type as "rolling" | "laser" | "wind" | "drone",
        center: add(near, forward, -6),
        direction: forward,
        radius: type === "wind" ? 8 : 1.05,
        phase: random() * 6.28,
        speed: 0.9 + difficulty,
        strength: 5 + difficulty * 3,
      });
    if (i % 4 === 0)
      route.pickups.push({
        id: `${id}-time`,
        type: "time",
        position: add(center, forward, 10),
        value: 20,
        risk: false,
      });
    if (i % 5 === 2)
      route.pickups.push({
        id: `${id}-power`,
        type: (["double", "slow", "speed", "magnet"] as const)[
          Math.floor(i / 5) % 4
        ]!,
        position: add(center, side, 1.2),
        value: 10,
        risk: false,
      });
    for (let c = 0; c < 3; c++)
      route.pickups.push({
        id: `${id}-coin-${c}`,
        type: "coin",
        position: add(add(near, forward, -6 - c * 2), side, -1.7),
        value: 5,
        risk: true,
      });
  }
  route.carPosition = add(
    roofs[roofs.length - 1]!.center,
    route.checkpoints[route.checkpoints.length - 1]!.direction,
    WIDTH / 2 + 8,
  );
  route.carPosition.y = 0.18;
  route.distance = route.nav.reduce(
    (sum, n, i) =>
      sum + (i ? distance(route.nav[i - 1]!.position, n.position) : 0),
    0,
  );
  route.expectedSeconds = Math.round(
    route.distance / MOVEMENT.runSpeed +
      route.jumps.filter((j) => j.branch === "safe").length * 0.45,
  );
  route.validation = validateRoute(route);
  if (!route.validation.possible)
    throw new Error(
      `Rejected seed ${seed}: ${route.validation.errors.join("; ")}`,
    );
  return cityOrigin ? positionRoute(route, cityOrigin) : route;
}

/** Move the whole generated course, not just its score key, to a surveyed city start.
 * Quarter-turns keep the original jump/height proofs intact and prefer staying inside the land boundaries.
 * This pure data pass runs inside the same route worker as generation in the browser.
 */
export function positionRoute(route: RouteData, origin: V3): RouteData {
  const spawn = { ...route.spawn };
  let angle = 0,
    best = Infinity;
  for (let turn = 0; turn < 4; turn++) {
    const a = (turn * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a);
    let score = 0;
    for (const roof of route.roofs) {
      const x =
          origin.x +
          (roof.center.x - spawn.x) * c +
          (roof.center.z - spawn.z) * s,
        z =
          origin.z -
          (roof.center.x - spawn.x) * s +
          (roof.center.z - spawn.z) * c;
      score +=
        Math.max(0, -1590 - x + roof.width / 2) ** 2 +
        Math.max(0, x + roof.width / 2 - 1760) ** 2 +
        Math.max(0, -1700 - z + roof.depth / 2) ** 2 +
        Math.max(0, z + roof.depth / 2 - 1740) ** 2;
    }
    if (score < best) {
      best = score;
      angle = a;
    }
  }
  const c = Math.round(Math.cos(angle)),
    s = Math.round(Math.sin(angle)),
    points = new Set<V3>(),
    vectors = new Set<V3>();
  const point = (p: V3) => {
    if (points.has(p)) return;
    points.add(p);
    const x = p.x - spawn.x,
      z = p.z - spawn.z;
    p.x = origin.x + x * c + z * s;
    p.y += origin.y - spawn.y;
    p.z = origin.z - x * s + z * c;
  };
  const vector = (p: V3) => {
    if (vectors.has(p)) return;
    vectors.add(p);
    const x = p.x,
      z = p.z;
    p.x = x * c + z * s;
    p.z = -x * s + z * c;
  };
  for (const r of route.roofs) point(r.center);
  for (const slab of route.slabs) {
    point(slab.center);
    slab.yaw += angle;
    if (slab.axis) vector(slab.axis);
  }
  for (const n of route.nav) point(n.position);
  for (const n of route.checkpoints) {
    point(n.position);
    vector(n.direction);
  }
  for (const n of route.jumps) {
    point(n.from);
    point(n.to);
  }
  for (const n of route.interactions) {
    point(n.start);
    point(n.end);
  }
  for (const n of route.hazards) {
    point(n.center);
    vector(n.direction);
  }
  for (const n of route.pickups) point(n.position);
  for (const n of route.encounters) {
    point(n.position);
    vector(n.direction);
  }
  point(route.spawn);
  point(route.goal);
  point(route.carPosition);
  vector(route.spawnDirection);
  route.validation = validateRoute(route);
  return route;
}
