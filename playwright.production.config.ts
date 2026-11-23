// The same strict scene/pixel test against production chunks and the bundled worker, on all three backends.
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: ['foundation.spec.ts', 'parkour.spec.ts'],
  grep: /boots directly, renders real geometry|parkour opens mid-run/,
  outputDir: '.arena/production-results',
  reporter: [['list'], ['json', { outputFile: '.arena/production-results.json' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000 },
});
