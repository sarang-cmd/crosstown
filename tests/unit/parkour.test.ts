// Acceptance-level deterministic physics, not mocks of the motor. Graphics/hardware are tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { generateRoute, checkJump } from '../../src/parkour/generator';
import { MOVEMENT, maximumJumpDistance, maximumJumpHeight } from '../../src/config/movement';
import { RooftopPhysics } from '../../src/parkour/physics';
import { PlayerController, emptyInput, type PlayerInput } from '../../src/player/controller';
import { ChaseCamera } from '../../src/player/chase-camera';
import { ParkourRun } from '../../src/parkour/ParkourRun';
import { RouteBot } from '../../src/parkour/bot';
import { ParkourStore } from '../../src/save/parkour';
import { hazardPosition } from '../../src/parkour/hazards';
import { add, horizontal, v3, type V3, type Slab } from '../../src/parkour/types';
await RAPIER.init();
class MemoryStorage { values = new Map<string, string>(); getItem(k: string) { return this.values.get(k) ?? null; } setItem(k: string, v: string) { this.values.set(k, v); } removeItem(k: string) { this.values.delete(k); } }
const memory = new MemoryStorage(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
function fixture(width = 100) {
  const route = generateRoute(3, true); route.spawn = v3(0, 10.045, 0); route.spawnDirection = v3(0, 0, 1);
  route.roofs = [{ id: 0, center: v3(0, 10, 0), width, depth: width, tint: 0.5, style: 0 }]; route.slabs = []; route.interactions = []; route.hazards = [];
  const stage = new RooftopPhysics(route), player = new PlayerController(stage, route.spawn); return { route, stage, player };
}
function steps(stage: RooftopPhysics, player: PlayerController, count: number, input: Partial<PlayerInput> = {}, powers = { double: 0, speed: 0 }): string[] {
  const events: string[] = [];
  for (let i = 0; i < count; i++) { stage.update(1 / 60, player.position); player.update(1 / 60, { ...emptyInput(), ...input, jump: i === 0 && !!input.jump, interact: i === 0 && !!input.interact }, powers); stage.world.step(); player.afterPhysics(); events.push(...player.events); }
  return events;
}
function obstacle(stage: RooftopPhysics, center: V3, size: V3) { const b = stage.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z)); const c = stage.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2), b); stage.world.step(); return c; }
function dispose(f: ReturnType<typeof fixture>) { f.player.dispose(); f.stage.dispose(); }
async function newRun(seed = 84173) { const run = new ParkourRun({ store: new ParkourStore() }); await run.start(seed); return run; }
function tickRun(run: ParkourRun, n: number) { for (let i = 0; i < n; i++) { run.setInput(emptyInput()); run.update(1 / 60); } }

test('24 seeds: real ballistic safety margin, 28 checkpoints, all 17 encounter families, winding and rejoining branches', () => {
  for (let i = 0; i < 24; i++) {
    const seed = (i * 2654435761) >>> 0, a = generateRoute(seed), b = generateRoute(seed);
    assert.deepEqual(a, b); assert.equal(a.validation.possible, true); assert.equal(a.checkpoints.length, 28);
    assert.equal(new Set(a.encounters.map(e => e.type)).size, 17); assert.ok(a.encounters.filter(e => e.safeBranch).length > 20);
    assert.ok(a.expectedSeconds >= 480 && a.expectedSeconds <= 720, `${seed}: ${a.expectedSeconds}s`);
    assert.ok(a.jumps.length > 10); for (const jump of a.jumps) assert.equal(checkJump(jump), null);
    const turns = a.roofs.filter((r, n) => n > 1 && (r.center.x - a.roofs[n - 1]!.center.x) * (a.roofs[n - 1]!.center.x - a.roofs[n - 2]!.center.x) === 0).length;
    assert.ok(turns > 15); assert.ok(a.slabs.some(s => s.safe && s.kind === 'bridge'));
  }
});
test('a physically impossible jump is rejected instead of waved through; training is an eight-checkpoint fixed route', () => {
  const jump = { from: v3(), to: v3(10, 0, 0), sprint: false, landingWidth: 2, wind: 0, segment: 'impossible', branch: 'safe' as const };
  assert.ok(checkJump(jump)); jump.to = v3(1, maximumJumpHeight + 0.1, 0); assert.ok(checkJump(jump));
  assert.ok(maximumJumpDistance() < MOVEMENT.runSpeed * MOVEMENT.jumpSpeed * 2 / MOVEMENT.gravity);
  assert.equal(generateRoute(123, true).checkpoints.length, 8);
  assert.deepEqual(generateRoute(123, true).roofs.map(r => r.center), generateRoute(456, true).roofs.map(r => r.center));
});
test('first tick is already running; normal and sprint movement reach their real configured speeds', () => {
  const f = fixture(); assert.equal(f.player.motion, 'run'); assert.equal(f.player.speed, MOVEMENT.runSpeed);
  steps(f.stage, f.player, 60, { z: 1 }); assert.ok(f.player.position.z > 6.2); assert.ok(Math.abs(f.player.speed - MOVEMENT.runSpeed) < 0.01);
  const start = f.player.position.z; steps(f.stage, f.player, 60, { z: 1, sprint: true }); assert.ok(f.player.position.z - start > 7.8); assert.equal(f.player.motion, 'sprint'); dispose(f);
});
test('jump, power-gated double jump, fall, land and high-fall roll all run through the KCC', () => {
  const f = fixture(); f.player.respawn(v3(0, 10.04, 0));
  assert.ok(steps(f.stage, f.player, 1, { jump: true }).includes('jump')); steps(f.stage, f.player, 20);
  const before = f.player.velocity.y; steps(f.stage, f.player, 1, { jump: true }); assert.ok(f.player.velocity.y <= before); assert.equal(f.player.jumps, 1);
  assert.ok(steps(f.stage, f.player, 1, { jump: true }, { double: 10, speed: 0 }).includes('double')); assert.equal(f.player.jumps, 2); assert.ok(f.player.velocity.y > 8);
  const events = steps(f.stage, f.player, 110); assert.ok(events.includes('land'));
  f.player.respawn(v3(0, 16, 0)); f.player.grounded = false; f.player.coyote = 0;
  assert.ok(steps(f.stage, f.player, 95).includes('roll')); dispose(f);
});
test('coyote time accepts a late edge jump, and jump buffering survives until landing', () => {
  const f = fixture(12); f.player.respawn(v3(0, 10.04, 5.85)); steps(f.stage, f.player, 6, { z: 1 });
  assert.ok(steps(f.stage, f.player, 1, { z: 1, jump: true }).includes('jump'));
  f.player.respawn(v3(0, 10.58, 0)); f.player.grounded = false; f.player.coyote = 0; f.player.jumps = 1; f.player.velocity.y = -6;
  const events = steps(f.stage, f.player, 12, { jump: true }); assert.ok(events.includes('land')); assert.ok(events.includes('jump')); assert.ok(f.player.velocity.y > 0); dispose(f);
});
test('slide changes the actual capsule and cannot stand into a low ceiling', () => {
  const f = fixture(); f.player.respawn(v3(0, 10.04, 0)); obstacle(f.stage, v3(0, 11.22, 2.4), v3(4, 0.3, 3));
  steps(f.stage, f.player, 20, { slide: true, z: 1 }); assert.equal(f.player.height, MOVEMENT.slideHeight); assert.equal(f.player.motion, 'slide'); assert.ok(f.player.position.z > 1.5);
  // Hold position underneath after the slide timer; the headroom test must keep the capsule small.
  f.player.respawn(v3(0, 10.04, 2.4)); steps(f.stage, f.player, 1, { slide: true }); f.player.slideTime = 0;
  steps(f.stage, f.player, 1); assert.equal(f.player.height, MOVEMENT.slideHeight);
  f.player.respawn(v3(10, 10.04, 0)); steps(f.stage, f.player, 1); assert.equal(f.player.height, MOVEMENT.height); dispose(f);
});
test('vault, ledge grab and pull-up are collision-swept assisted trajectories', () => {
  const f = fixture(); f.player.respawn(v3(0, 10.04, 0)); obstacle(f.stage, v3(0, 10.4, 1.3), v3(3, 0.8, 1.3));
  assert.ok(steps(f.stage, f.player, 1, { interact: true }).includes('vault')); steps(f.stage, f.player, 40); assert.ok(f.player.position.z > 1.2); assert.ok(f.player.position.y > 10.65);
  f.player.respawn(v3(10, 10.2, 0)); f.player.grounded = false; f.player.velocity.y = -1;
  obstacle(f.stage, v3(10, 10.85, 1.2), v3(3, 1.7, 1.4));
  const events = steps(f.stage, f.player, 1, { traverse: true }); assert.ok(events.includes('ledge-grab')); assert.ok(events.includes('climb'));
  steps(f.stage, f.player, 65); assert.ok(f.player.position.z > 1); assert.ok(f.player.position.y > 11.5); dispose(f);
});
test('wall run reduces gravity and a wall jump kicks away from the wall', () => {
  const f = fixture(); f.player.respawn(v3(0, 11.5, 0)); f.player.grounded = false; f.player.coyote = 0; f.player.velocity.y = 0;
  obstacle(f.stage, v3(0.75, 12.5, 2), v3(0.4, 5, 20));
  assert.ok(steps(f.stage, f.player, 8, { z: 1, sprint: true }).includes('wallrun')); assert.equal(f.player.motion, 'wallrun'); assert.ok(f.player.velocity.y > -1);
  assert.ok(steps(f.stage, f.player, 1, { z: 1, sprint: true, jump: true }).includes('jump')); assert.ok(f.player.velocity.x < -1); assert.ok(f.player.velocity.y > 8); dispose(f);
});
test('ziplines and clothesline swings carry the capsule between real endpoints', () => {
  for (const type of ['zipline', 'swing'] as const) {
    const f = fixture(); f.player.respawn(v3(0, 10.04, 0)); f.route.interactions.push({ id: type, type, start: v3(0, 10.04, 0), end: v3(0, 10.04, 12), duration: 1.1, label: type });
    assert.ok(steps(f.stage, f.player, 1, { interact: true }).includes(type)); steps(f.stage, f.player, 90); assert.ok(f.player.position.z > 11.5); dispose(f);
  }
});
test('camera sphere sweep includes its near-plane clearance and keeps the camera outside a wall after smoothing', async () => {
  const f = fixture(); f.player.respawn(v3(0, 10.04, 0)); obstacle(f.stage, v3(0, 13, -3), v3(10, 8, 0.3));
  const view = new ChaseCamera(); view.reset(v3(0, 0, 1));
  const run = { player: f.player, stage: f.stage, state: 'running' } as ParkourRun;
  view.update(run, 1 / 60, true); assert.equal(view.collisionLimited, true); assert.ok(view.camera.position.z > -2.65);
  for (let i = 0; i < 30; i++) view.update(run, 1 / 60);
  assert.equal(f.stage.world.intersectionWithShape(view.camera.position, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Ball(0.2), undefined, undefined, f.player.collider, f.player.body), null); dispose(f);
});
test('every pickup activates on capsule contact; power bars last ten real seconds and time pickups add twenty', async () => {
  const r = await newRun();
  for (const type of ['double', 'slow', 'speed', 'magnet'] as const) {
    const p = r.route.pickups.find(p => p.type === type)!; assert.ok(p); r.player.respawn(p.position); tickRun(r, 1); assert.ok(r.powers[type] > 9.95);
    tickRun(r, 603); assert.equal(r.powers[type], 0);
  }
  const time = r.route.pickups.find(p => p.type === 'time')!; const before = r.remaining; r.player.respawn(time.position); tickRun(r, 1); assert.ok(r.remaining > before + 19.9);
  const coin = r.route.pickups.find(p => p.type === 'coin' && !r.collected.has(p.id))!; r.powers.magnet = 10; r.player.respawn(add(coin.position, v3(4.5, 0, 0))); tickRun(r, 100); assert.ok(r.collected.has(coin.id)); assert.ok(r.cash > 0); r.dispose();
});
test('speed boost really increases motor speed and slow motion slows only the world, not countdown/power duration', async () => {
  const r = await newRun(); const baseTime = r.stage.time, timer = r.remaining; r.powers.slow = 10; tickRun(r, 60);
  assert.ok(Math.abs(r.stage.time - baseTime - 0.32) < 0.02); assert.ok(Math.abs(timer - r.remaining - 1) < 0.02); assert.ok(Math.abs(r.powers.slow - 9) < 0.02);
  r.powers.speed = 10; r.player.respawn(r.route.roofs[0]!.center); for (let i = 0; i < 60; i++) { r.setInput({ ...emptyInput(), z: 1 }); r.update(1 / 60); }
  assert.ok(r.player.speed > MOVEMENT.runSpeed * 1.3); r.dispose();
});
test('rolling balls, sweeping lasers, gusts and patrol drones apply non-lethal knockback/push', async () => {
  const r = await newRun(); tickRun(r, 125);
  for (const type of ['rolling', 'laser', 'drone'] as const) {
    const h = r.route.hazards.find(h => h.type === type)!; assert.ok(h); const point = hazardPosition(h, r.stage.time);
    r.player.respawn(v3(point.x, type === 'drone' ? point.y - 0.9 : h.center.y + 0.025, point.z)); r.player.velocity = v3();
    const before = r.eventCounts.hazard ?? 0; tickRun(r, 1); assert.ok((r.eventCounts.hazard ?? 0) > before, type); assert.ok(Math.hypot(r.player.external.x, r.player.external.z) > 0.1); assert.equal(r.state, 'running'); r.player.respawn(r.route.spawn); tickRun(r, 125);
  }
  const wind = r.route.hazards.find(h => h.type === 'wind')!;
  while (Math.sin(r.stage.time * wind.speed + wind.phase) < 0.6) tickRun(r, 1);
  r.player.respawn(wind.center); const before = r.eventCounts.wind ?? 0; tickRun(r, 1); assert.ok((r.eventCounts.wind ?? 0) > before); assert.ok(Math.hypot(r.player.external.x, r.player.external.z) > 0); r.dispose();
});
test('moving/tilting/crane colliders animate; crumbling is triggered by standing on the platform, falls, then recovers', async () => {
  const r = await newRun();
  for (const kind of ['moving', 'tilting', 'crane'] as const) {
    const s = r.route.slabs.find(s => s.kind === kind)!; assert.ok(s); r.player.respawn(add(s.center, v3(0, 0.5, 0))); tickRun(r, 1);
    const before = structuredClone(r.stage.poses.get(s.id)); tickRun(r, 30); const after = r.stage.poses.get(s.id)!; assert.notDeepEqual(after, before); const active = r.stage.active.get(s.id)!; assert.ok(active); assert.ok(active.body.isKinematic());
  }
  const s = r.route.slabs.find(s => s.kind === 'crumbling')!; r.player.respawn(v3(s.center.x, s.center.y + s.size.y / 2 + 0.04, s.center.z)); tickRun(r, 3);
  assert.ok(r.stage.crumble.has(s.id)); const y = s.center.y; tickRun(r, 75); assert.ok(r.stage.poses.get(s.id)!.position.y < y - 0.4);
  r.player.respawn(r.route.spawn); tickRun(r, 300); r.stage.stream(s.center, true); tickRun(r, 1); assert.ok(!r.stage.crumble.has(s.id)); r.dispose();
});
test('fall has exactly five seconds penalty; timeout restarts the same seed and reset clears powers', async () => {
  const r = await newRun(9876), seed = r.seed, before = r.remaining;
  r.player.respawn(add(r.route.spawn, v3(0, -11, 0))); tickRun(r, 1);
  assert.equal(r.falls, 1); assert.equal(r.penalty, 5); assert.ok(Math.abs(before - r.remaining - 5 - 1 / 60) < 0.01); assert.ok(horizontal(r.player.position, r.route.spawn) < 0.01);
  r.powers.double = 10; r.remaining = 0.001; tickRun(r, 1); assert.equal(r.seed, seed); assert.equal(r.elapsed, 0); assert.equal(r.checkpoint, 0); assert.equal(r.powers.double, 0); assert.ok(r.eventCounts.timeout); r.dispose();
});
test('full normal-pace physics pilot: 8–12 simulated minutes, finish, persisted per-seed/per-marker best, next-run ghost and night unlock', async () => {
  memory.values.clear(); const r = await newRun(), bot = new RouteBot(r); let ticks = 0;
  while (r.state === 'running' && ticks < 50000) { r.setInput(bot.input()); r.update(1 / 60); ticks++; }
  assert.equal(r.state, 'finished'); assert.equal(r.checkpoint, 27); assert.equal(r.falls, 0); assert.ok(r.elapsed >= 480 && r.elapsed <= 720, String(r.elapsed)); assert.ok(r.result); assert.match(r.result.rank, /^[CSAB]$/);
  const store = new ParkourStore(); assert.ok(store.data.car && store.data.night); assert.equal(store.best(r.seed)!.result.seconds, r.result.seconds); assert.equal(store.data.markerBest['opening:day'], r.result.seconds);
  r.reset(); assert.ok(r.ghost.length > 4800); assert.ok(r.ghostAt(1)); assert.ok(r.setNight(true)); assert.equal(r.night, true); const nightTimer = r.remaining; r.setNight(false); assert.ok(r.remaining > nightTimer); r.dispose();
});
test('ParkourRun exposes lifecycle/events, is safely disposable, and locked night mode does not change an unfinished run', async () => {
  memory.values.clear(); const r = await newRun(); let starts = 0; const off = r.on('start', () => starts++); const seed = r.seed;
  assert.equal(r.setNight(true), false); assert.equal(r.night, false); r.reset(); assert.equal(starts, 1); off();
  await r.newSeed(); assert.notEqual(r.seed, seed); assert.equal(starts, 1); r.dispose(); r.dispose(); assert.equal(r.state, 'disposed');
});

test('the eight-checkpoint hand-authored training route can also be completed by normal movement input', async () => {
  const r = new ParkourRun({ training: true }); await r.start(84173); const b = new RouteBot(r); let ticks = 0;
  while (r.state === 'running' && ticks++ < 10000) { r.setInput(b.input()); r.update(1 / 60); }
  assert.equal(r.state, 'finished'); assert.equal(r.checkpoint, 7); assert.equal(r.falls, 0); r.dispose();
});
test('moving platforms carry a grounded rider, and resetting crumble geometry never launches a player skyward', async () => {
  const r = await newRun(); const s = r.route.slabs.find(s => s.kind === 'moving')!, e = r.route.encounters.find(e => `${e.id}-risk` === s.id)!;
  const a = r.route.roofs[e.roofA]!.center, b = r.route.roofs[e.roofB]!.center, x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
  r.player.respawn(v3(x, s.center.y + 2, z)); tickRun(r, 40); const before = { ...r.player.position }; tickRun(r, 40);
  assert.ok(horizontal(before, r.player.position) > 0.05); assert.equal(r.falls, 0);
  const c = r.route.slabs.find(s => s.kind === 'crumbling')!; r.player.respawn(v3(c.center.x, c.center.y + c.size.y / 2 + 0.04, c.center.z));
  let highest = r.player.position.y; for (let i = 0; i < 390; i++) { tickRun(r, 1); highest = Math.max(highest, r.player.position.y); }
  assert.ok(highest < c.center.y + 5, `no reset elevator impulse: ${highest}`); r.dispose();
});
test('blocked storage keeps parkour unlocks/results in memory without breaking gameplay or unrelated saves', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const store = new ParkourStore(); assert.equal(store.storage.available, false);
    store.finish({ seed: 123, marker: 'harbor', night: false, seconds: 600, falls: 0, collectibles: 4, cash: 20, rank: 'A', date: '2026-11-22' }, []);
    assert.ok(store.data.car && store.data.night); assert.equal(store.best(123, 'harbor')!.result.seconds, 600); assert.equal(store.data.markerBest['harbor:day'], 600);
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory }); }
});
