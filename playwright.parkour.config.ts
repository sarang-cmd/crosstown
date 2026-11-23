import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, testMatch: 'parkour.spec.ts', timeout: 180000,
  outputDir: '.arena/parkour-browser-results',
  reporter: [['list'], ['json', { outputFile: '.arena/parkour-browser-results.json' }]],
  projects: [
    ...base.projects!.map(p => ({ ...p, testMatch: 'parkour.spec.ts' })),
    { name: 'webgpu-full-run', use: base.projects![0]!.use, testMatch: 'parkour-full.spec.ts', timeout: 240000 },
  ],
});
