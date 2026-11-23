// End-to-end acceptance checks actual backend identity AND colored scene pixels; a blank WebGPU canvas cannot pass.
import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
const saveKey = 'crosstown:settings:v1';
const snapshot = (page: Page) => page.evaluate(() => window.__foundation!.snapshot());
async function boot(page: Page, project: string) {
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, data: { quality: 0 } }));
  }, saveKey);
  await page.goto(project === 'webgl2-forced' ? '/?sandbox&webgl&test' : '/?sandbox&test');
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  expect((await snapshot(page)).backend).toBe(project === 'webgpu' ? 'WebGPU' : 'WebGL 2');
}
async function coloredScenePixels(page: Page, region = { left: 330, top: 230, width: 590, height: 300 }, minimum = 150) {
  const shot = await page.screenshot();
  const { data, info } = await sharp(shot).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let mint = 0, orange = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
    if (r < 170 && g > 80 && g > r * 1.15 && g > b * 1.02) mint++;
    if (r > 170 && g > 100 && g < 210 && b < 150 && r - g > 20) orange++;
  }
  expect(mint, 'visible teal render cube pixels, not just a ready flag').toBeGreaterThan(minimum);
  expect(orange, 'visible orange rigid-body pixels, not a blank canvas').toBeGreaterThan(minimum);
}

test('boots directly, renders real geometry, and the body falls and rests', async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page, testInfo.project.name);
  await expect(page.locator('#pause-overlay')).toBeHidden();
  await expect(page.locator('#world-canvas')).toBeVisible();
  expect((await snapshot(page)).workerReady).toBe(true);
  // Reset in the same task in which height is observed, so a slow software GPU cannot hide the starting state.
  const resetHeight = await page.evaluate(() => { window.__foundation!.resetBody(); return window.__foundation!.snapshot().bodyY; });
  expect(resetHeight).toBe(6.5);
  await expect.poll(async () => (await snapshot(page)).settled).toBe(true);
  expect((await snapshot(page)).bodyY).toBeCloseTo(0.6, 2);
  await expect(page.locator('#fps')).not.toHaveText('—');
  const before = (await snapshot(page)).cubeRotation;
  await expect.poll(async () => (await snapshot(page)).cubeRotation).toBeGreaterThan(before + 0.03);
  await coloredScenePixels(page);
  if (testInfo.project.name === 'webgpu') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(2000);
    expect((await snapshot(page)).backend).toBe('WebGPU');
    await coloredScenePixels(page);
  }
  expect(errors).toEqual([]);
  await testInfo.attach('measured-state', { body: JSON.stringify(await snapshot(page), null, 2), contentType: 'application/json' });
});

test('keyboard, pause, quality, rebinding, synthetic gamepad and wheel inputs work', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page, testInfo.project.name);
  await page.keyboard.down('KeyW');
  await expect(page.locator('[data-action="forward"]')).toHaveClass(/pressed/);
  await expect(page.locator('#input-debug')).toContainText('KeyW');
  await page.keyboard.up('KeyW');
  const markerBefore = await page.locator('#render-marker').boundingBox();
  await page.mouse.move(640, 530); await page.mouse.down();
  await page.mouse.move(710, 515, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => Math.abs((await page.locator('#render-marker').boundingBox())!.x - markerBefore!.x)).toBeGreaterThan(2);
  await page.mouse.wheel(0, 180);
  await expect(page.locator('#input-debug')).toContainText('zoom out');
  await page.keyboard.press('KeyC');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const ticks = (await snapshot(page)).ticks;
  await page.waitForTimeout(650);
  expect((await snapshot(page)).ticks).toBe(ticks);
  for (const [name, tier] of [['Balanced', 1], ['High', 2], ['Ultra', 3], ['Low', 0]] as const) {
    await page.locator('#quality-options').getByRole('button', { name, exact: true }).click();
    expect((await snapshot(page)).tier).toBe(tier);
  }
  await page.locator('[data-bind="reset"]').click();
  await page.keyboard.press('KeyT');
  await expect(page.locator('[data-bind="reset"]')).toHaveText('T');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).data.bindings.reset, saveKey)).toEqual(['KeyT']);
  await page.locator('#resume').click();
  await page.keyboard.press('KeyT');
  await expect.poll(async () => (await snapshot(page)).bodyY).toBeGreaterThan(3);
  await expect(page.locator('[data-hint="reset"]')).toHaveText('T');
  await expect.poll(async () => (await snapshot(page)).settled).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).bodyY).toBeGreaterThan(1.1);
  // Browser Gamepad API test doubles: not a claim of testing a physical controller or wheel.
  await page.evaluate(() => {
    const pad = { id: 'Synthetic standard pad', index: 0, mapping: 'standard', connected: true, axes: [0.7, -0.6, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await expect.poll(async () => (await snapshot(page)).device).toBe('gamepad');
  await expect(page.locator('#input-debug')).toContainText('Gamepad');
  await page.evaluate(() => {
    const wheel = { id: 'Synthetic racing wheel', index: 0, mapping: '', connected: true, axes: [0.7, 0, -1, 0, 0, 1], buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [wheel] });
  });
  await expect.poll(async () => (await snapshot(page)).device).toBe('wheel');
  expect((await snapshot(page)).steering).toBeGreaterThan(0.6);
  expect((await snapshot(page)).throttle).toBe(1); expect((await snapshot(page)).brake).toBe(0);
  await expect(page.locator('#input-debug')).toContainText('Wheel');
  await page.evaluate(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
  await page.keyboard.press('KeyH');
  await expect(page.locator('#hud')).toHaveClass(/hide-diagnostics/);
  await page.keyboard.press('KeyH');
  await expect(page.locator('#hud')).not.toHaveClass(/hide-diagnostics/);
  expect(errors).toEqual([]);
});

test('prepared models load in the browser with real dimensions, wheels, skins and animation', async ({ page }, testInfo) => {
  await boot(page, testInfo.project.name);
  const assets = await page.evaluate(async () => {
    // Vite serves the dependency entry points with browser-resolved imports; these are test-only loads.
    const [{ GLTFLoader }, { MeshoptDecoder }, { Box3, Vector3, AnimationMixer }] = await Promise.all([
      import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
      import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js'),
      import('/node_modules/three/build/three.module.js'),
    ]);
    const result = [];
    for (const id of ['test-car', 'test-character']) {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/models/${id}.glb`);
      gltf.scene.updateMatrixWorld(true);
      const box = new Box3().setFromObject(gltf.scene, true), size = box.getSize(new Vector3());
      const nodes: string[] = []; let skinned = 0;
      gltf.scene.traverse((node: { name: string; isSkinnedMesh?: boolean }) => { nodes.push(node.name); if (node.isSkinnedMesh) skinned++; });
      let runningHeight = 0;
      if (id === 'test-character') {
        const mixer = new AnimationMixer(gltf.scene); mixer.clipAction(gltf.animations.find((clip: { name: string }) => clip.name === 'Running')).play(); mixer.update(0.25);
        gltf.scene.updateMatrixWorld(true); runningHeight = new Box3().setFromObject(gltf.scene, true).getSize(new Vector3()).y;
      }
      result.push({ id, dimensions: size.toArray(), ground: box.min.y, clips: gltf.animations.length, nodes, skinned, runningHeight });
    }
    return result;
  });
  expect(assets[0]!.dimensions[2]).toBeCloseTo(4.5, 2);
  expect(assets[0]!.ground).toBeCloseTo(0, 2);
  for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) expect(assets[0]!.nodes).toContain(name);
  expect(assets[1]!.dimensions[1]).toBeCloseTo(1.75, 2);
  expect(assets[1]!.ground).toBeCloseTo(0, 2); expect(assets[1]!.clips).toBe(14);
  expect(assets[1]!.skinned).toBeGreaterThan(0); expect(assets[1]!.runningHeight).toBeGreaterThan(1.5);
  await testInfo.attach('asset-browser-measurements', { body: JSON.stringify(assets, null, 2), contentType: 'application/json' });
});

test('mobile layout remains usable and credits are available', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, testInfo.project.name);
  await expect.poll(async () => (await snapshot(page)).settled).toBe(true);
  await coloredScenePixels(page, { left: 20, top: 330, width: 350, height: 200 }, 500);
  await expect(page.getByRole('button', { name: 'Drop again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause and open settings' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#pause-open').click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#resume').click(); await expect(page.getByRole('dialog')).toBeHidden();
  const response = await page.request.get('/CREDITS.md'); expect(response.status()).toBe(200);
  const text = await response.text(); expect(text).toContain('Kenney'); expect(text).toContain('CC0'); expect(text).toContain('Quaternius');
});
