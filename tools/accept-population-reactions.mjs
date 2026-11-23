// Actual shared-world contact, not injected damage or a synthetic crashed flag.
// Uses development/?test hooks only. Software graphics: no native FPS claim.
import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const url = process.env.GAME_URL ?? 'http://127.0.0.1:5173';
const directory = 'docs/evidence/crosstown-0.9.0';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(90000);
const errors = [], report = { date: '2026-11-22', url, passed: false, errors, purpose: 'Physical player/NPC contact, braking/swerving, siren, night and future fear hook; not human or native performance acceptance' };
page.on('pageerror', e => { errors.push(e.message); console.log(e.stack); });
async function picture(name) {
  const frame = await page.evaluate(() => window.__vehicles.snapshot().renderFrames);
  await page.waitForFunction(f => window.__vehicles.snapshot().renderFrames > f + 1, frame);
  await page.evaluate(() => { document.querySelector('#pause-overlay').hidden = true; document.body.classList.remove('run-paused'); document.querySelector('#hud').classList.remove('is-paused'); });
  await page.screenshot({ path: `docs/screenshots/09-${name}.png` });
}
try {
  await page.addInitScript(() => localStorage.setItem('crosstown:settings:v1', JSON.stringify({ version: 1, data: { quality: 0 } })));
  await page.goto(`${url}/?test&webgl&autostart&length=quick&date=2026-11-20`, { timeout: 90000 });
  await page.waitForFunction(() => !!window.__population, undefined, { timeout: 180000 });
  await page.evaluate(() => {
    window.__parkour.pause(true); window.__city.hour(15);
    window.__vehicles.find('parked'); window.__vehicles.enter('parked');
    window.__vehicles.step(340); window.__vehicles.camera(2);
    window.__population.density(60, 120);
    window.__vehicles.teleport({ x: 520, y: .9, z: 785 });
    window.__population.prime({ x: 520, y: .1, z: 785 });
    window.__population.observe(p => { window.reactionPopulation = p; });
    window.__population.step(1); window.__population.observe(undefined);
  });
  const candidate = await page.evaluate(() => {
    const p = window.reactionPopulation;
    const c = p.traffic.cars.filter(c => {
      const path = p.traffic.paths.get(c.lane);
      return path.edge.lanes >= 4 && path.length - c.progress > 85 && c.progress > 20 && !c.transition && !['wren', 'kestrel'].includes(c.definition);
    }).sort((a,b) => Math.hypot(a.position.x-520,a.position.z-785)-Math.hypot(b.position.x-520,b.position.z-785))[0];
    if (!c) throw Error('No natural arterial NPC suitable for the physical contact fixture');
    return { id: c.id, definition: c.definition, position: { ...c.position }, yaw: c.yaw, lane: c.lane };
  });
  report.target = candidate;
  await page.evaluate(async c => {
    window.__vehicles.teleport({ x: c.position.x + Math.sin(c.yaw)*12, y: c.position.y + .12, z: c.position.z + Math.cos(c.yaw)*12 }, c.yaw + Math.PI);
    await window.__city.flush(c.position); window.__population.step(15);
  }, candidate);
  report.before = await page.evaluate(() => window.__population.snapshot());
  const collision = await page.evaluate(id => {
    const p = window.reactionPopulation, target = p.traffic.cars.find(c => c.id === id);
    if (!target || !p.fullCars.has(id)) throw Error('Natural NPC did not stream its full Rapier controller');
    const yaw = target.yaw;
    window.__vehicles.teleport({ x: target.position.x + Math.sin(yaw)*11, y: target.position.y + .1, z: target.position.z + Math.cos(yaw)*11 }, yaw + Math.PI);
    window.__vehicles.velocity({ x: -Math.sin(yaw)*22, y: 0, z: -Math.cos(yaw)*22 });
    const audit = { ticks: 0, chassisContacts: 0, maximumPlayerImpulse: 0, maximumNpcImpulse: 0, npcCrashStates: 0, maximumPlayerDamage: 0, maximumNpcDamage: 0 };
    window.__population.observe(pop => {
      const player = pop.vehicles.active.car, npc = pop.fullCars.get(id)?.car;
      audit.ticks++; audit.maximumPlayerImpulse = Math.max(audit.maximumPlayerImpulse, player.lastImpact);
      audit.maximumPlayerDamage = Math.max(audit.maximumPlayerDamage, player.damage);
      if (npc) { audit.maximumNpcImpulse = Math.max(audit.maximumNpcImpulse, npc.lastImpact); audit.maximumNpcDamage = Math.max(audit.maximumNpcDamage, npc.damage); }
      if (pop.traffic.cars.find(c => c.id === id)?.state === 'crash-brake') audit.npcCrashStates++;
      pop.vehicles.world.contactPairsWith(player.collider, other => { if (other.parent()?.userData?.vehicle === id) audit.chassisContacts++; });
    });
    window.__vehicles.step(150); window.__population.observe(undefined);
    return { audit, vehicles: window.__vehicles.snapshot(), population: window.__population.snapshot() };
  }, candidate.id);
  report.collision = collision;
  expect(collision.audit.chassisContacts).toBeGreaterThan(0);
  expect(collision.audit.maximumPlayerImpulse).toBeGreaterThan(2.5);
  expect(collision.audit.maximumNpcImpulse).toBeGreaterThan(2.5);
  expect(collision.audit.maximumPlayerDamage).toBeGreaterThan(0);
  expect(collision.audit.maximumNpcDamage).toBeGreaterThan(0);
  expect(collision.audit.npcCrashStates).toBeGreaterThan(0);
  expect(collision.population.traffic.stats.brakesForPlayer).toBeGreaterThan(report.before.traffic.stats.brakesForPlayer);
  expect(collision.population.traffic.stats.swerves).toBeGreaterThan(report.before.traffic.stats.swerves);
  await picture('physical-npc-crash');
  await page.evaluate(() => { window.__population.siren(true); window.__population.step(180); });
  report.siren = await page.evaluate(() => window.__population.snapshot());
  expect(report.siren.traffic.stats.pullOvers).toBeGreaterThan(collision.population.traffic.stats.pullOvers);
  expect(report.siren.traffic.agents.some(c => c.state === 'pulling-over' && c.lateral > .5)).toBe(true);
  await page.evaluate(() => { window.__population.siren(false); window.__city.hour(22); });
  await page.waitForFunction(() => window.reactionPopulation.traffic.night > .4);
  await page.evaluate(() => window.__population.step(180));
  report.night = await page.evaluate(() => window.__population.snapshot());
  expect(report.night.traffic.agents.every(c => c.headlights)).toBe(true);
  expect(report.night.pedestrians.count).toBeLessThan(report.before.pedestrians.count);
  expect(report.night.pedestrians.effectiveTarget).toBe(58);
  await picture('night-population');
  await page.evaluate(() => { const p = window.__vehicles.snapshot().cars.find(c => c.id === window.__vehicles.snapshot().active).position; window.__population.gunfire(p); window.__population.step(1); });
  report.futureFearHook = await page.evaluate(() => window.__population.snapshot());
  expect(report.futureFearHook.traffic.stats.gunfireReactions).toBeGreaterThan(0);
  expect(report.futureFearHook.pedestrians.stats.fled).toBeGreaterThan(collision.population.pedestrians.stats.fled);
  expect(errors).toEqual([]); report.passed = true;
  console.log(JSON.stringify({ passed: true, physicalContact: collision.audit, brakes: collision.population.traffic.stats.brakesForPlayer, swerves: collision.population.traffic.stats.swerves, pullOvers: report.siren.traffic.stats.pullOvers, peopleDay: report.before.pedestrians.count, peopleNight: report.night.pedestrians.count, fearHookOnly: true, errors }, null, 2));
} catch (error) { report.failure = String(error?.stack ?? error); console.log(report.failure); process.exitCode = 1; }
finally { await writeFile(`${directory}/population-reactions.json`, JSON.stringify(report, null, 2)+'\n'); await browser.close(); }
