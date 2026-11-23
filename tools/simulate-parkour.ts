import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { generateRoute } from '../src/parkour/generator';
import { ParkourRun } from '../src/parkour/ParkourRun';
import { RouteBot } from '../src/parkour/bot';
await RAPIER.init();
const seeds = Array.from({ length: 24 }, (_, i) => i === 0 ? 84173 : ((i * 2654435761) >>> 0));
const validation = seeds.map(seed => { const r = generateRoute(seed); return { seed, possible: r.validation.possible, proofs: r.jumps.length, checkpoints: r.checkpoints.length, types: new Set(r.encounters.map(e => e.type)).size, metres: Math.round(r.distance), expectedSeconds: r.expectedSeconds, ...r.validation }; });
const run = new ParkourRun(); await run.start(84173); const bot = new RouteBot(run);
let ticks = 0; const start = performance.now();
for (; ticks < 90000 && run.state === 'running'; ticks++) {
  run.setInput(bot.input()); run.update(1 / 60);
  if (ticks % 6000 === 0) console.log({ tick: ticks, seconds: run.elapsed.toFixed(1), cp: run.checkpoint, nav: bot.index, falls: run.falls, motion: run.player.motion, position: run.player.position });
}
const summary = { state: run.state, simulationSeconds: ticks / 60, elapsed: run.elapsed, remaining: run.remaining, falls: run.falls, checkpoint: run.checkpoint, botNav: bot.index, navCount: run.route.nav.length, result: run.result, recordFrames: run.recording.length, maximumStreamMs: run.stage.streamMs, initialStreamMs: run.stage.initialStreamMs, cpuWallSeconds: (performance.now() - start) / 1000 };
console.log(JSON.stringify(summary, null, 2));
const additionalRuns: unknown[] = [];
if (process.argv.includes('--all-runs')) for (const seed of seeds.slice(1)) {
  const next = new ParkourRun(); await next.start(seed); const pilot = new RouteBot(next); let ticks = 0;
  for (; ticks < 50000 && next.state === 'running'; ticks++) { next.setInput(pilot.input()); next.update(1 / 60); }
  const result = { seed, state: next.state, normalPaceSeconds: ticks / 60, falls: next.falls, checkpoint: next.checkpoint, nav: pilot.index, maximumStreamMs: next.stage.streamMs };
  additionalRuns.push(result); console.log('SEED RUN', JSON.stringify(result));
  if (next.state !== 'finished') process.exitCode = 1;
  next.dispose();
}
fs.mkdirSync('docs', { recursive: true }); fs.writeFileSync('docs/PARKOUR-SIMULATION.json', JSON.stringify({ additionalRuns, date: '2026-11-22', method: '60 Hz real Rapier/KCC simulation; 6.5 m/s normal movement; every fixed tick, no teleportation, no skipped checkpoints; unrendered, not wall-clock duration or GPU benchmark.', seeds: validation, fullRun: summary }, null, 2) + '\n');
run.dispose();
if (summary.state !== 'finished' || validation.some(v => !v.possible)) process.exitCode = 1;
