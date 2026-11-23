// Software-only wall-clock render cadence. Never a native laptop / Radeon 840M benchmark.
// Usage: npm run profile (current only); node tools/profile-browser.mjs (also needs a separately served old release at :4175).
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const releases = [
  { name: '0.3.0-before', url: process.env.BASELINE_URL ?? 'http://127.0.0.1:4175/?test&webgl', shot: '00a-previous-gameplay' },
  { name: '0.7.0-crosstown', url: process.env.PROFILE_URL ?? 'http://127.0.0.1:5173/?test&webgl&length=full&date=2026-11-20', shot: '08-crosstown-rooftops' },
].filter(r => !process.argv.includes('--current-only') || r.name.includes('crosstown'));
const results = [];
async function cadence(page, seconds = 15) {
  return page.evaluate(seconds => new Promise(resolve => {
    const times = []; let first, last;
    function frame(now) {
      if (first === undefined) { first = last = now; requestAnimationFrame(frame); return; }
      times.push(now - last); last = now;
      if (now - first < seconds * 1000) requestAnimationFrame(frame);
      else {
        const sorted = [...times].sort((a, b) => a - b), wallMs = now - first;
        resolve({ wallMs, frames: times.length, rafFps: times.length / (wallMs / 1000), frameP50: sorted[Math.floor(sorted.length * .5)], frameP95: sorted[Math.floor(sorted.length * .95)], frameMaximum: Math.max(...times) });
      }
    }
    requestAnimationFrame(frame);
  }), seconds);
}
async function freeze(page) {
  await page.evaluate(() => {
    window.__parkour.pause(true);
    document.querySelector('#pause-overlay').hidden = true;
    document.body.classList.remove('run-paused');
    document.querySelector('#hud').classList.remove('is-paused');
  });
}
try {
  for (const release of releases) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      for (const key of ['coastline:foundation:v1', 'crosstown:settings:v1']) localStorage.setItem(key, JSON.stringify({ version: 1, data: { quality: 1, diagnostics: false } }));
    });
    const start = performance.now();
    await page.goto(release.url);
    await page.waitForFunction(() => !!window.__parkour, undefined, { timeout: 180000 });
    const readyWallMs = performance.now() - start;
    // Warm actual display frames rather than an arbitrary timer while shaders are still linking.
    const warmup = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(); let frames = 0, finished = false;
      const done = () => { if (!finished) { finished = true; resolve({ frames, wallMs: performance.now() - start }); } };
      const timer = setTimeout(done, 60000);
      function frame() { if (finished) return; frames++; if (frames >= 20) { clearTimeout(timer); done(); } else requestAnimationFrame(frame); }
      requestAnimationFrame(frame);
    }));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    const measured = await cadence(page);
    const profile = (await cdp.send('Profiler.stop')).profile;
    await fs.mkdir('.arena/profiles', { recursive: true });
    await fs.writeFile(`.arena/profiles/${release.name}.cpuprofile`, JSON.stringify(profile));
    const state = await page.evaluate(() => window.__parkour.snapshot());
    await freeze(page); await page.screenshot({ path: `docs/screenshots/${release.shot}.png` });
    const nodes = new Map(profile.nodes.map(n => [n.id, n])), sampled = new Map();
    profile.samples.forEach((id, i) => { const f = nodes.get(id).callFrame, key = `${f.functionName || '(anonymous)'} @ ${f.url.split('/').at(-1)}`; sampled.set(key, (sampled.get(key) || 0) + (profile.timeDeltas[i] || 0)); });
    const topSamples = [...sampled].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, microseconds]) => ({ name, sampledMs: microseconds / 1000 }));
    let flight;
    if (release.name.includes('crosstown')) {
      await page.evaluate(() => { window.__parkour.pause(false); window.__city.fly({ x: -1400, y: 130, z: -1500 }, { x: -1400, y: 130, z: 1500 }); });
      await page.waitForTimeout(1500);
      const before = await page.evaluate(() => window.__city.snapshot());
      await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
      const timing = await cadence(page, 20);
      await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
      const after = await page.evaluate(() => window.__city.snapshot());
      flight = { note: 'One initial positioning operation before measurement. Actual W+Shift held; no teleports, manual simulation steps, or render suspension during the measured segment. This is only a partial flight, not a complete-map acceptance pass.', timing, before, after, distanceXZ: Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z) };
      await freeze(page); await page.screenshot({ path: 'docs/screenshots/09-fast-flight-partial.png' });
    }
    results.push({ release: release.name, environment: 'Chromium forced WebGL 2 / software SwiftShader, 1280x800, Balanced, 2-CPU/2-GiB container. Unpaused rAF cadence, not GPU timestamp timing or target-hardware validation.', readyWallMs, warmup, cadence: measured, state, topSamples, flight, errors });
    console.log(release.name, JSON.stringify({ readyWallMs, warmup, cadence: measured, draws: state.draws, triangles: state.triangles, stream: state.city, flightDistance: flight?.distanceXZ, flightCadence: flight?.timing, errors }, null, 2));
    await page.close();
  }
  await fs.writeFile('docs/PERFORMANCE-COMPARISON.json', JSON.stringify({ date: '2026-11-22', warning: 'The city scene differs from the old release. Same viewport, full course and fixed Balanced tier; no hardware-performance or controlled CPU-attribution claim. First-pass inadequately warmed measurements are preserved separately and are not the steady-state comparison.', results }, null, 2) + '\n');
} finally { await browser.close(); }
