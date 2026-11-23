// Use a real compositor for WebGPU pixel assertions. On headless Linux: xvfb-run -a npm run test:browser.
import { defineConfig } from '@playwright/test';
const gpuArgs = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--disable-vulkan-surface', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const glArgs = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'foundation.spec.ts',
  outputDir: '.arena/browser-results',
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '.arena/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1280, height: 800 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', channel: 'chromium' },
  projects: [
    { name: 'webgpu', use: { headless: false, launchOptions: { args: gpuArgs } } },
    { name: 'webgl2-forced', use: { headless: true, launchOptions: { args: glArgs } } },
    { name: 'webgpu-disabled', use: { headless: true, launchOptions: { args: [...glArgs, '--disable-webgpu', '--disable-features=WebGPU'] } } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
});
