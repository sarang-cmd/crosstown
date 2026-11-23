import { test, expect } from '@playwright/test';
import { openRun, runnerPixels, runSnapshot } from './parkour-helpers';

test('parkour opens mid-run, renders the glTF and district, and stays visible after GC and mobile resize', async ({ page, context }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const s = await openRun(page, testInfo.project.name);
  expect(s.state).toBe('running'); expect(s.motion).toBe('run'); expect(s.velocity.z || s.velocity.x).not.toBe(0);
  expect(s.modelLoaded).toBe(true); expect(s.modelFallback).toBe(false); expect(s.workerReady).toBe(true); expect(s.total).toBe(28); expect(s.valid.possible).toBe(true);
  for (const name of ['Run', 'Sprint', 'ParkourJump', 'DoubleJump', 'Slide', 'Climb', 'Fall', 'Land', 'Roll', 'WallRun', 'Vault', 'Zipline', 'Swing']) expect(s.clips).toContain(name);
  await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.locator('#run-result')).toBeHidden(); await runnerPixels(page);
  await testInfo.attach('desktop-game', { body: await page.screenshot(), contentType: 'image/png' });
  if (testInfo.project.name === 'webgpu') { const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(600); await runnerPixels(page); }
  const title = await page.locator('.run-location').boundingBox(), timer = await page.locator('.run-score').boundingBox(); expect(title!.x + title!.width).toBeLessThan(timer!.x);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#world-canvas')).toBeVisible(); const [a, b] = await Promise.all([page.locator('.run-location').boundingBox(), page.locator('.run-score').boundingBox()]); expect(a!.x + a!.width).toBeLessThan(b!.x);
  await testInfo.attach('mobile-game', { body: await page.screenshot(), contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(700);
  await testInfo.attach('measured-software-renderer-not-hardware-benchmark', { body: JSON.stringify(await runSnapshot(page), null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('parkour controls, camera collision, checkpoint penalty, timeout, new seed and settings remain functional', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await openRun(page, testInfo.project.name);
  await page.keyboard.down('KeyX'); await expect.poll(async () => (await runSnapshot(page)).height).toBe(0.9); await page.keyboard.up('KeyX');
  // Coyote/buffering/ledge/roll/etc. use exhaustive real-KCC unit fixtures; these are browser wiring assertions.
  await page.evaluate(() => { window.__parkour!.reset(); window.__parkour!.step(1, { jump: true, z: 1 }); });
  expect((await runSnapshot(page)).motion).toBe('jump'); await page.evaluate(() => window.__parkour!.step(90)); expect((await runSnapshot(page)).grounded).toBe(true);
  await page.evaluate(() => { const f = window.__parkour!.fixture(); window.__parkour!.teleport({ x: -21, y: f.spawn.y, z: 26.6 }); window.__parkour!.pause(false); });
  await expect.poll(async () => (await runSnapshot(page)).cameraLimited).toBe(true);
  const camera = (await runSnapshot(page)).camera as number[]; expect(camera[2]).toBeGreaterThan(24.8);
  const penalty = await page.evaluate(() => { window.__parkour!.respawn(); return window.__parkour!.snapshot(); }); expect(penalty.penalty).toBe(5); expect(penalty.falls).toBe(1);
  const timedOut = await page.evaluate(() => { const seed = window.__parkour!.snapshot().seed; window.__parkour!.setRemaining(0.001); window.__parkour!.step(1); return { before: seed, after: window.__parkour!.snapshot() }; });
  expect(timedOut.after.seed).toBe(timedOut.before); expect(timedOut.after.elapsed).toBe(0); expect(timedOut.after.events.timeout).toBe(1);
  await expect(page.getByRole('dialog')).toBeVisible(); const ticks = (await runSnapshot(page)).ticks; await page.waitForTimeout(500); expect((await runSnapshot(page)).ticks).toBe(ticks);
  await expect(page.locator('[data-audio]')).toHaveCount(3);
  await page.locator('[data-bind="reset"]').click(); await page.keyboard.press('KeyT'); await expect(page.locator('[data-bind="reset"]')).toHaveText('T');
  await page.locator('#resume').click(); await page.keyboard.press('KeyT'); await expect.poll(async () => (await runSnapshot(page)).penalty).toBe(0);
  await page.evaluate(() => { const pad = { id: 'Synthetic standard parkour pad', index: 0, mapping: 'standard', connected: true, axes: [0.6, -0.5, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })) }; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] }); });
  await expect.poll(async () => (await runSnapshot(page)).device).toBe('gamepad');
  await page.evaluate(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
  const seed = (await runSnapshot(page)).seed; await page.keyboard.press('KeyN'); await expect.poll(async () => (await runSnapshot(page)).seed, { timeout: 60000 }).not.toBe(seed); await expect.poll(async () => (await runSnapshot(page)).state).toBe('running');
  expect((await runSnapshot(page)).backend).toBe(testInfo.project.name === 'webgpu' ? 'WebGPU' : 'WebGL 2'); expect(errors).toEqual([]);
});
