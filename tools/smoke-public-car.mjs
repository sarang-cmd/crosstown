// Read-only browser acceptance on the deployed game; never uploads or changes a deployment.
// Linux: xvfb-run -a node tools/smoke-public-car.mjs
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('../public/release.json', import.meta.url), 'utf8'));
const evidence = `docs/evidence/crosstown-${pkg.version}`;
await mkdir(evidence, { recursive: true });
const url = new URL(process.env.DEPLOYMENT_URL ?? 'https://crosstown-sarang-dev.vercel.app');
if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Expected a public HTTPS game URL without credentials.');
const errors = [], browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--disable-vulkan-surface', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const report = { date: '2026-11-22', url: url.origin, purpose: 'Actual public sedan/cockpit/audio/mirror/exit smoke; not a hardware performance or complete handling acceptance run', passed: false, errors };
try {
  const response = await page.request.get(`${url.origin}/release.json`); expect(response.ok()).toBe(true);
  report.release = await response.json(); expect(report.release.version).toBe(pkg.version); expect(report.release.build).toBe(metadata.build);
  await page.addInitScript(() => { localStorage.setItem('crosstown:settings:v1', JSON.stringify({ version: 1, data: { quality: 0, diagnostics: false } })); localStorage.setItem('crosstown:driving:v1', JSON.stringify({ version: 1, data: { cabin: 'sedan', manual: false, assist: true, mouseSteering: false } })); });
  await page.goto(`${url.origin}/?test&drive&date=2026-11-20`);
  await page.waitForFunction(() => window.__vehicles?.snapshot().active === 'lab', undefined, { timeout: 180000 });
  await page.keyboard.press('KeyW');
  await page.evaluate(() => { window.__vehicles.step(340); window.__city.hour(15); });
  await expect.poll(() => page.evaluate(() => window.__vehicles.snapshot().audio.voices[0]?.state), { timeout: 45000 }).toBe('samples');
  await page.evaluate(() => window.__vehicles.step(180, { throttle: .65, steering: .12 }));
  const moving = await page.evaluate(() => window.__vehicles.snapshot());
  const car = moving.cars.find(c => c.id === moving.active);
  expect(moving.backend.toLowerCase()).toContain('webgpu'); expect(car.engine.phase).toBe('running'); expect(car.speed).toBeGreaterThan(3); expect(car.contacts).toBeGreaterThan(1); expect(car.visual.gltf).toBe(true);
  report.moving = moving;
  await page.evaluate(() => { const s = window.__vehicles.snapshot(), c = s.cars.find(c => c.id === s.active); window.__vehicles.teleport(c.position, Math.PI / 2); window.__vehicles.quality(2); });
  await expect.poll(() => page.evaluate(() => window.__vehicles.snapshot().cabin.mirrorRenderFrames), { timeout: 90000 }).toBeGreaterThan(1);
  report.mirrorPixels = await page.evaluate(() => window.__vehicles.mirrorPixels()); expect(report.mirrorPixels[0].range).toBeGreaterThan(50);
  await page.evaluate(() => { document.querySelector('#pause-overlay').hidden = true; document.body.classList.remove('run-paused'); document.querySelector('#hud').classList.remove('is-paused'); });
  await page.screenshot({ path: 'docs/screenshots/09-public-cockpit-webgpu.png' });
  await page.evaluate(() => window.__parkour.pause(false)); await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => window.__vehicles.snapshot().active), { timeout: 30000 }).toBe(null);
  report.afterExit = await page.evaluate(() => window.__city.snapshot()); expect(report.afterExit.mode).toBe('street'); expect(errors).toEqual([]);
  report.passed = true; console.log(`PASS public ${pkg.version} sedan: real drive, samples, live mirrors, geometry and E-key exit; zero runtime errors.`);
} catch (error) { report.failure = String(error?.stack ?? error); throw error; }
finally { await writeFile(`${evidence}/public-car-smoke.json`, `${JSON.stringify(report, null, 2)}\n`); await browser.close(); }
