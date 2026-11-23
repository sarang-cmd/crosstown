import { test, expect } from '@playwright/test';
import { openRun, runnerPixels, runSnapshot } from './parkour-helpers';
test('eight-checkpoint training route also opens immediately with the animated runner and a visible billboard course', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const state = await openRun(page, testInfo.project.name, '&training');
  expect(state.total).toBe(8); expect(state.modelLoaded).toBe(true); expect(state.motion).toBe('run'); expect(state.valid.possible).toBe(true);
  await runnerPixels(page); await testInfo.attach('training-eight-checkpoints', { body: await page.screenshot(), contentType: 'image/png' });
  const f = await page.evaluate(() => window.__parkour!.fixture()); expect(f.checkpoints).toHaveLength(8); expect(f.jumps.length).toBeGreaterThan(0);
  await page.keyboard.press('Escape'); await expect.poll(async () => (await runSnapshot(page)).paused).toBe(true);
  expect(errors).toEqual([]);
});
