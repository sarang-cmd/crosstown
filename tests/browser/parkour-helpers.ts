import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';
export async function openRun(page: Page, project: string, extra = '') {
  await page.addInitScript(() => { localStorage.setItem('crosstown:settings:v1', JSON.stringify({ version: 1, data: { quality: 0, diagnostics: false } })); });
  await page.goto(`/?test&length=full${project === 'webgl2-forced' ? '&webgl' : ''}${extra}`);
  await page.waitForFunction(() => !!window.__parkour && document.documentElement.dataset.ready === 'true', undefined, { timeout: 150000 });
  const state = await page.evaluate(() => window.__parkour!.snapshot());
  expect(state.backend).toBe(project.startsWith('webgpu') && project !== 'webgpu-disabled' ? 'WebGPU' : 'WebGL 2');
  return state;
}
export async function runnerPixels(page: Page) {
  const shot = await page.screenshot();
  const { data, info } = await sharp(shot).extract({ left: 480, top: 310, width: 300, height: 360 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let amber = 0, coolRoof = 0;
  for (let i = 0; i < data.length; i += info.channels) { const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!]; if (r > 130 && g > 75 && g < 220 && b < 125 && r - g > 18) amber++; if (g > 65 && g > r * 0.98 && g > b && r < 210) coolRoof++; }
  expect(amber, 'actual animated amber glTF runner pixels, not just a ready flag').toBeGreaterThan(250);
  expect(coolRoof, 'actual rooftop geometry pixels').toBeGreaterThan(4000);
}
export const runSnapshot = (page: Page) => page.evaluate(() => window.__parkour!.snapshot());
