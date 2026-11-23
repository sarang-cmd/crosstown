# Parkour integration API

`src/parkour/ParkourRun.ts` owns simulation and progress, not the renderer, HUD or audio. `src/game.ts` is the first host. The six city start markers now create runs without importing the rooftop UI.

```ts
import RAPIER from '@dimforge/rapier3d-compat';
import { ParkourRun } from './src/parkour/ParkourRun';
import { RouteWorker } from './src/world/route-worker';

await RAPIER.init(); // Once per host; all prepared assets are already included.
const worker = new RouteWorker();
const run = new ParkourRun({
  marker: 'parkour-2', length: 'quick',
  origin: { x: -698, y: 18, z: 1340 }, // surveyed South Port start
  routeFactory: worker.generate,
});
const offFinish = run.on('finish', event => {
  // event.result contains seconds, rank, falls, collectibles, cash, seed, marker and night.
  // run.store now contains the result, best/ghost and car/night unlocks.
  console.log(event.result);
});
await run.start(84173);

// At the host's fixed 1/60 s step; x/z are WORLD-space horizontal movement in [-1,1].
run.setInput({ x: 0, z: 1, jump: false, sprint: false, slide: false, interact: false, traverse: false });
run.update(1 / 60);
// Read run.player, run.stage, run.route and run.powers to render/interpolate externally.

run.reset();        // Same seed, same marker/day-night; clears current-run penalties/powers.
await run.newSeed();
offFinish();
run.dispose();     // Idempotent; frees KCC/physics/listeners and invalidates in-flight generation.
worker.dispose();  // The host owns and disposes its worker.
```

The import paths in this example are relative to the project root; adjust them to the host module. `RouteWorker.generate` is already a bound callback. Omitting `routeFactory` uses the synchronous generator, useful for tests; the shipped browser host supplies the worker.

## Lifecycle

- `start(seed): Promise<void>` — normalize to uint32, generate/validate route, replace the old physics/controller and start immediately. A later start/dispose invalidates a stale async result.
- `reset(): void` — reset physics, pickups, countdown, falls, powers and recording on the same route. Load the saved best ghost for this marker/seed/day-night.
- `newSeed(): Promise<void>` — choose another uint32 with `crypto.getRandomValues` (safe timestamp fallback) and call `start`.
- `setInput(PlayerInput): void` — copy movement/held input; jump/interact pressed edges are consumed once.
- `update(dt): void` — step physics, powers, hazards, pickups, checkpoints, timeout and finish. Call at 60 Hz; pause by not calling. Invalid/nonpositive values are ignored and individual values are clamped to 0.1 s. Finished runs only advance `finishTime`, for host celebration playback.
- `respawn(): void` — last checkpoint, five-second penalty and brief hazard immunity; no health/death mechanic.
- `setNight(value): boolean` — requires the saved night unlock when enabling; resets the same route with a tighter clock and faster hazards. False means locked.
- `ghostAt(time?): GhostFrame | null` — interpolate the best recorded position/yaw/motion at elapsed time, respecting `ghostEnabled`.
- `on(type, callback): () => void` — subscribe and return an unsubscribe function. `'*'` receives every event.
- `dispose(): void` — idempotent cleanup. Start a fresh instance for another owned session after disposal.

## Events

`route` (route data), `start` (seed/night), `reset`, `movement` (action), `checkpoint`, `pickup`, `hazard`, `wind`, `fall`, `timeout`, `finish` (result/best), `locked`, `night` and `dispose`.

Events are synchronous and include their `type`. The run performs its own save before emitting `finish`. City code must avoid double-awarding the same cash/unlock if it mirrors this into another store. UI/audio listeners can unsubscribe independently.

## Route/data and persistence

- `generator.ts` returns serializable route data, including roofs, safe/risky slabs, hazards, interactions, pickups, checkpoints, navigation, goal/car positions and ballistic validation.
- Training uses eight fixed checkpoints. Quick / Standard / Full have 16/32/64 roofs and 8/16/28 checkpoints. Full retains all 17 encounter families; Quick includes the first 15 shuffled families. Six city markers set both `run.marker` and `run.origin`: all route positions/directions are translated/quarter-turned in the worker so the physical spawn matches the marker. Scenic footprint blending at every seed/length remains open.
- `physics.ts` keeps only nearby rooftop/slab/prop colliders active. Never position render-only props on the safe navigation corridor without an ordinary-input pilot regression.
- `save/parkour.ts` guards every storage access and validates records. Keys: `crosstown:parkour:v1`, `crosstown:settings:v1`, `crosstown:preferences:v1` and `crosstown:city:v1` for hidden caches. Legacy Coastline result/settings keys are read as a migration fallback and removed by confirmed reset. Best keys include **marker + length + day/night + seed** (full keeps the legacy marker form); `markerBest` separately records each start marker's best. Up to 100 results/eight ghost tracks and 15,000 frames per recording are bounded; quota failure degrades safely.
- The waiting sedan unlock is retained by this module. The host now composes `src/vehicles/` for actual entry/driving/reward use; `ParkourRun` itself still does not own vehicle physics or the later fleet/NPC/police/radio systems.

## Testing boundary

`window.__parkour` is installed only in development or with explicit `?test`. It exposes diagnostics, fixture positions and accelerated acceptance helpers; ordinary production has no global test API. `botRun` uses ordinary 6.5 m/s movement and every 60 Hz KCC step, but suspends rendering during accelerated simulation and is not a hardware benchmark. See [TESTING.md](TESTING.md).

## Host/city modes

`B` enters the street and holds the parkour timer. `V` enters the debug fly camera. Returning to Rooftops resumes the same run. Fly → street uses nearby loaded Rapier surfaces, not an arbitrary airborne spawn. `M` opens the full city map and routes a waypoint along the connected road graph. Hidden city caches are separate one-shot +50-cash awards through the host.

Development/explicit-`?test` city instrumentation exposes `snapshot`, `mode`, `layout`, `date`, `hour`, `fly`, `street`, `step`, `setup`, `flush`, `movement`, `startMarker`, `collect` and `clearCitySave`. These helpers are absent from ordinary production. `startMarker` is the same worker/host path used by actual E/F interaction. Test `collect` bypasses physical access only to verify the one-shot storage ledger; it does not prove all hidden access paths are walkable.

## Steps 06–07 host integration

The host composes `Vehicles` with the city Rapier world, not the rooftop KCC world. On-foot street stepping calls `vehicles.preStep`, one world step, then `vehicles.postStep`; driving calls the same sequence. The −24 character gravity remains unchanged while vehicle gravity is compensated. Never step the same city world twice in a fixed tick.

`Vehicles.configure` installs the parked/reward sedan and safe physical parking pads, updates `run.route.carPosition` to the real parked reward, and keeps its lock synchronized with parkour completion. The glowing arrow follows this position; the earlier goal-orbit finish camera remains. The original hidden reward glTF is the visual source, not an extra playable vehicle. New host save namespaces are `crosstown:driving:v1` and `crosstown:audio:v1`; confirmed project reset clears them too.

Development/explicit-`?test` `window.__vehicles` exposes snapshot, lab/find/enter/exit, camera/cabin, input/step/teleport/recover, ignition/manual/gear, quality and mirror/audio acceptance probes. These diagnostics suspend or accelerate actual simulation and are **not ordinary live FPS, physical hardware or human audio/handling proof**. See the actual keyboard/browser checks in `tests/browser/vehicles.spec.ts` and the boundaries in TESTING.
