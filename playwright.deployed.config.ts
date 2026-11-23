// Verify the real PUBLIC Vercel output, including a full physical pilot/save/unlock. No local server.
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, testMatch: ['parkour.spec.ts', 'parkour-full.spec.ts', 'parkour-training.spec.ts'], timeout: 180000,
  outputDir: '.arena/deployed-browser-results',
  reporter: [['list'], ['json', { outputFile: '.arena/deployed-browser-results.json' }]],
  use: { ...base.use, baseURL: process.env.DEPLOYMENT_URL ?? 'https://crosstown-sarang-dev.vercel.app' },
  projects: [
    ...base.projects!.map(p => ({ ...p, testMatch: 'parkour.spec.ts', grep: /parkour opens mid-run/ })),
    { name: 'webgpu-full-run', use: base.projects![0]!.use, testMatch: 'parkour-full.spec.ts', timeout: 240000 },
    { name: 'webgpu-training', use: base.projects![0]!.use, testMatch: 'parkour-training.spec.ts' },
  ],
  webServer: undefined,
});
