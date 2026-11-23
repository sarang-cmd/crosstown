import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: 'vehicles.spec.ts', timeout: 480000,
  outputDir: '.arena/vehicle-browser-results',
  reporter: [['list'], ['json', { outputFile: '.arena/vehicle-browser-results.json' }]],
  use: { ...base.use, viewport: { width: 1440, height: 900 } },
  projects: base.projects!.filter(p => p.name !== 'webgpu-disabled'),
});
