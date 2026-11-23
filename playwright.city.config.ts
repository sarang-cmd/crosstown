import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: 'crosstown.spec.ts',
  timeout: 240000,
  outputDir: '.arena/city-browser-results',
  reporter: [['list'], ['json', { outputFile: '.arena/city-browser-results.json' }]],
  projects: base.projects!.filter(p => p.name !== 'webgpu-disabled'),
});
