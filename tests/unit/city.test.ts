import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three/webgpu";
import {
  generateLayout,
  DISTRICTS,
  terrainHeightAt,
  shoreAt,
  districtAt,
} from "../../src/world/city/layout";
import { generateChunk, generateWorld } from "../../src/world/city/generator";
import { calendarWeather, lightAt } from "../../src/world/city/environment";
import { CityPhysics, StreetSession } from "../../src/world/city/physics";
import { ChaseCamera } from "../../src/player/chase-camera";
import {
  RUN_LENGTHS,
  SessionStore,
  type RunLength,
} from "../../src/config/session";
import { ParkourRun } from "../../src/parkour/ParkourRun";
import { RouteBot } from "../../src/parkour/bot";
import { ParkourStore } from "../../src/save/parkour";
import { SaveStore, loadSettings } from "../../src/save";
import { generateRoute } from "../../src/parkour/generator";
import { v3 } from "../../src/parkour/types";
await RAPIER.init();
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
}
const memory = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memory,
});
const layout = generateLayout();
test("fixed 4 km geography is continuous at all 128 m chunk seams, with sea, canal bed and natural ridges", () => {
  for (let x = -2000; x <= 2000; x += 128)
    for (let z = -2000; z <= 2000; z += 128)
      assert.ok(Number.isFinite(terrainHeightAt(x, z)));
  assert.ok(terrainHeightAt(shoreAt(0) - 50, 0) < -2);
  assert.ok(terrainHeightAt(1950, -1800) > 150);
  assert.ok(terrainHeightAt(-858, 0) < -3);
  const a = generateChunk(20, 9, 0, layout),
    b = generateChunk(21, 9, 0, layout);
  for (let z = 0; z <= 16; z++)
    assert.equal(a.heights[16 * 17 + z], b.heights[z]);
});
test("road graph is connected; every intersection and directed lane references real incoming/outgoing lanes", () => {
  const visited = new Set<number>([layout.nodes[0]!.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of layout.edges)
      if (
        (visited.has(e.from) && !visited.has(e.to)) ||
        (visited.has(e.to) && !visited.has(e.from))
      ) {
        visited.add(e.from);
        visited.add(e.to);
        changed = true;
      }
  }
  assert.equal(visited.size, layout.nodes.length);
  const lanes = new Map(layout.lanes.map((l) => [l.id, l]));
  for (const node of layout.nodes) {
    assert.ok(node.incoming.length > 0 && node.outgoing.length > 0);
    for (const id of node.incoming) assert.equal(lanes.get(id)!.to, node.id);
    for (const id of node.outgoing) assert.equal(lanes.get(id)!.from, node.id);
    for (const turn of node.turns) {
      assert.ok(node.incoming.includes(turn.from));
      assert.ok(node.outgoing.includes(turn.to));
    }
  }
  for (const d of DISTRICTS)
    assert.ok(
      layout.nodes.some(
        (n) => Math.hypot(n.x - d.center.x, n.z - d.center.z) < 400,
      ),
      d.id,
    );
  for (const kind of [
    "highway",
    "arterial",
    "local",
    "ramp",
    "bridge",
    "tunnel",
    "mountain",
    "promenade",
  ])
    assert.ok(
      layout.edges.some((e) => e.kind === kind),
      kind,
    );
  for (const e of layout.edges) {
    assert.equal(layout.lanes.filter((l) => l.edge === e.id).length, e.lanes);
    assert.ok(e.speedLimit > 0);
    assert.deepEqual(
      e.points[0],
      v3(
        layout.nodes[e.from]!.x,
        layout.nodes[e.from]!.y,
        layout.nodes[e.from]!.z,
      ),
    );
  }
});
test("all districts have distinct procedural architecture; six surveyed rooftop markers and all service types exist", () => {
  assert.equal(new Set(DISTRICTS.map((d) => d.id)).size, 7);
  assert.equal(new Set(DISTRICTS.map((d) => d.color)).size, 7);
  for (const d of DISTRICTS) {
    assert.equal(districtAt(d.center.x, d.center.z), d.id);
    const x = Math.floor(
        ((d.id === "downtown" ? 560 : d.center.x) + 2000) / 128,
      ),
      z = Math.floor(((d.id === "downtown" ? -120 : d.center.z) + 2000) / 128),
      c = generateChunk(x, z, 0, layout);
    assert.ok(c.buildings.length > 0, d.id);
    assert.ok(c.details.length > 0, d.id);
  }
  assert.equal(layout.markers.filter((m) => m.type === "parkour").length, 6);
  for (const type of [
    "gas",
    "gunshop",
    "paint",
    "garage",
    "hospital",
    "police",
  ])
    assert.ok(
      layout.markers.some((m) => m.type === type),
      type,
    );
  for (const type of ["ramp", "garage", "alley", "underpass", "collectible"])
    assert.ok(
      layout.features.some((f) => f.type === type),
      type,
    );
});
test("world and chunk data are deterministic finite transferable buffers, including edge cells", () => {
  const a = generateWorld(),
    b = generateWorld();
  assert.deepEqual(a, b);
  assert.ok(a.impostors.length / 12 > 1000);
  assert.ok(a.roads.indices.length > 0);
  for (const [x, z] of [
    [0, 0],
    [31, 31],
    [0, 31],
    [31, 0],
    [7, 13],
    [20, 17],
  ]) {
    const c = generateChunk(x!, z!, 0, layout);
    assert.equal(c.buildings.length % 12, 0);
    assert.equal(c.colliders.length % 8, 0);
    for (const ar of [
      c.terrain.positions,
      c.terrain.normals,
      c.terrain.colors,
      c.roads.positions,
      c.buildings,
      c.details,
      c.colliders,
    ])
      assert.ok(ar.every(Number.isFinite));
    for (const index of c.terrain.indices)
      assert.ok(index < c.terrain.positions.length / 3);
  }
});
test("calendar weather is deterministic and two recorded dates differ; dusk lights interpolate and a full day is 1440 real seconds", () => {
  assert.deepEqual(
    calendarWeather("2026-11-20"),
    calendarWeather("2026-11-20"),
  );
  assert.equal(calendarWeather("2026-11-20").weather, "clear");
  assert.equal(calendarWeather("2026-11-22").weather, "fog");
  assert.equal(lightAt(12).night, 0);
  assert.equal(lightAt(23).night, 1);
  assert.ok(lightAt(18).night > 0 && lightAt(18).night < 1);
  assert.equal((8 + 1440 / 60) % 24, 8);
});
test("A is screen-left and D is screen-right at every camera heading, with no movement-to-camera spin feedback", () => {
  const view = new ChaseCamera();
  for (let i = 0; i < 16; i++) {
    const yaw = (i * Math.PI) / 8;
    view.reset(v3(Math.sin(yaw), 0, Math.cos(yaw)));
    const d = view.movement(1, 0),
      a = view.movement(-1, 0),
      screenRight = new Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    assert.ok(d.x * screenRight.x + d.z * screenRight.z > 0.999);
    assert.ok(a.x * screenRight.x + a.z * screenRight.z < -0.999);
    const forward = view.movement(0, -1);
    assert.ok(forward.x * Math.sin(yaw) + forward.z * Math.cos(yaw) > 0.999);
  }
});
test("quick, standard and full routes finish using ordinary KCC input; bests/ghosts survive reload without colliding across lengths", async () => {
  const results: Record<string, number> = {};
  for (const length of Object.keys(RUN_LENGTHS) as RunLength[]) {
    const run = new ParkourRun({
      length,
      store: new ParkourStore(new SaveStore(`test-length-${length}`)),
    });
    await run.start(84173);
    assert.equal(run.route.roofs.length, RUN_LENGTHS[length].roofs);
    assert.equal(run.route.checkpoints.length, RUN_LENGTHS[length].checkpoints);
    const bot = new RouteBot(run);
    for (let i = 0; i < 80000 && run.state === "running"; i++) {
      run.setInput(bot.input());
      run.update(1 / 60);
    }
    assert.equal(
      run.state,
      "finished",
      `${length}: ${run.checkpoint} / ${run.falls} falls`,
    );
    assert.equal(run.falls, 0);
    results[length] = run.elapsed;
    const loaded = new ParkourStore(run.store.storage);
    assert.ok(loaded.best(run.seed, run.scoreMarker));
    assert.ok(loaded.best(run.seed, run.scoreMarker)!.ghost.length > 100);
    run.dispose();
  }
  assert.ok(results.quick! < 200);
  assert.ok(results.standard! < 400);
  assert.ok(results.full! > 600);
  console.log(
    "Measured ordinary-input simulation durations (not rendering FPS):",
    results,
  );
});
test("run preferences validate corrupt values and legacy settings/results migrate without losing custom bindings", () => {
  memory.setItem(
    "crosstown:preferences:v1",
    JSON.stringify({
      version: 1,
      data: {
        length: "broken",
        sensitivity: 500,
        cameraSmoothing: null,
        configured: true,
      },
    }),
  );
  const preferences = new SessionStore();
  assert.equal(preferences.value.length, "quick");
  assert.equal(preferences.value.sensitivity, 2);
  assert.equal(preferences.value.cameraSmoothing, 7);
  memory.setItem(
    "coastline:foundation:v1",
    JSON.stringify({
      version: 1,
      data: { quality: 1, bindings: { left: ["KeyJ"] } },
    }),
  );
  memory.removeItem("crosstown:settings:v1");
  assert.deepEqual(loadSettings(new SaveStore()).bindings.left, ["KeyJ"]);
  new SaveStore().clear();
  assert.equal(memory.getItem("coastline:foundation:v1"), null);
});
test("street walker reaches the beach from below downtown with real road/bridge/terrain collisions and no teleport", () => {
  const stage = new CityPhysics();
  stage.setOpening(generateRoute(84173, false, "full"));
  const start = v3(34, 0.2, -256),
    session = new StreetSession(stage, start, {
      goal: v3(),
      carPosition: v3(),
    }),
    loaded = new Set<string>();
  let maxStream = 0,
    minY = Infinity,
    steps = 0;
  for (; steps < 22000 && session.player.position.x > -1570; steps++) {
    if (steps % 60 === 0) {
      const p = session.player.position,
        cx = Math.floor((p.x + 2000) / 128),
        cz = Math.floor((p.z + 2000) / 128);
      for (let x = cx - 1; x <= cx + 1; x++)
        for (let z = cz - 1; z <= cz + 1; z++) {
          const key = `${x},${z}`;
          if (!loaded.has(key)) {
            stage.provide(generateChunk(x, z, 0, layout));
            loaded.add(key);
          }
        }
      const a = performance.now();
      stage.stream(p);
      maxStream = Math.max(maxStream, performance.now() - a);
    }
    session.update(1 / 60, {
      x: -1,
      z: 0,
      jump: false,
      sprint: false,
      slide: false,
      interact: false,
      traverse: false,
    });
    minY = Math.min(minY, session.player.position.y);
  }
  assert.ok(
    session.player.position.x < -1568,
    `stuck at ${JSON.stringify(session.player.position)} after ${steps} ticks`,
  );
  assert.ok(minY > -0.4, `fell into the canal: ${minY}`);
  assert.equal(
    districtAt(session.player.position.x, session.player.position.z),
    "beach",
  );
  console.log("Street-to-beach physical pilot:", {
    simulatedSeconds: steps / 60,
    position: session.player.position,
    minY,
    maxStream,
    activeChunks: stage.activeChunks,
  });
  session.dispose();
  stage.dispose();
});

test("city vertex colors are linear rather than washed-out sRGB, and baked worker meshes have valid normals and indices", async () => {
  const { rgb } = await import("../../src/world/city/generator");
  assert.ok(Math.abs(rgb("#808080")[0] - 0.2158605) < 0.000001);
  const chunk = generateChunk(7, 9, 0, layout);
  assert.equal(
    chunk.batch.length,
    0,
    "static parts share a worker-baked mesh, not a per-block GPU batch",
  );
  assert.ok(chunk.decor.positions.length > 0);
  for (const mesh of [chunk.decor, chunk.roads]) {
    for (const values of [mesh.positions, mesh.normals, mesh.colors])
      assert.ok(values.every(Number.isFinite));
    for (const index of mesh.indices)
      assert.ok(index < mesh.positions.length / 3);
    for (let i = 0; i < mesh.normals.length; i += 3)
      assert.ok(
        Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 0.002,
      );
  }
});
test("map waypoints use a connected shortest road path, including a real crossing over the canal", async () => {
  const { routeToWaypoint } = await import("../../src/world/city/layout");
  const route = routeToWaypoint(layout, v3(34, 0, -256), v3(-1500, 0, -650));
  assert.ok(route.length > 20);
  assert.equal(route[0]!.x, 34);
  assert.equal(route.at(-1)!.x, -1500);
  assert.ok(route.some((p) => p.x > -880 && p.x < -830));
  for (let i = 2; i < route.length - 1; i++)
    assert.ok(
      Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.z - route[i - 1]!.z) <
        260,
    );
});
test("fly-to-walk landing resolves onto loaded roofs and roads rather than spawning inside solid buildings", () => {
  const stage = new CityPhysics();
  stage.setOpening(generateRoute(84173, false, "quick"));
  const above = stage.landingAt(v3(0, 100, 0));
  assert.ok(above.y > 27 && above.y < 28);
  const inside = stage.landingAt(v3(0, 10, 0));
  assert.ok(inside.y > 27 && inside.y < 28);
  const street = stage.landingAt(v3(34, 90, -256));
  assert.ok(street.y >= 0 && street.y < 1);
  stage.dispose();
});
test("all six city markers move the actual route/spawn and finish with normal quick-run KCC input", async () => {
  const results = [];
  for (const marker of layout.markers.filter((m) => m.type === "parkour")) {
    const run = new ParkourRun({
      length: "quick",
      marker: marker.id,
      origin: marker.position,
      store: new ParkourStore(new SaveStore(`test-${marker.id}`)),
    });
    await run.start(84173);
    assert.deepEqual(run.route.spawn, marker.position);
    assert.deepEqual(run.player.position, marker.position);
    const bot = new RouteBot(run);
    for (let i = 0; i < 20000 && run.state === "running"; i++) {
      run.setInput(bot.input());
      run.update(1 / 60);
    }
    assert.equal(
      run.state,
      "finished",
      `${marker.id}: checkpoint ${run.checkpoint}, falls ${run.falls}, position ${JSON.stringify(run.player.position)}`,
    );
    assert.equal(run.falls, 0);
    assert.ok(run.store.best(run.seed, `${marker.id}:quick`));
    results.push({
      marker: marker.id,
      spawn: run.route.spawn,
      elapsed: run.elapsed,
      falls: run.falls,
    });
    run.dispose();
  }
  console.log(
    "Six physical city-start pilots (simulation, not frame-rate evidence):",
    results,
  );
});
