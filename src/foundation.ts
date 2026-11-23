// Step 01 composition root: boots directly into the live test scene, without a title screen or start gate.
import './style.css';
import { APP } from './config/app';
import { FixedStepLoop } from './core/loop';
import { InputManager } from './core/input';
import { PhysicsSandbox } from './core/physics';
import { QualityScaler } from './core/quality';
import { createRenderer } from './rendering/renderer';
import { InspectionCamera } from './player/camera';
import { SaveStore, loadSettings } from './save';
import { HUD } from './ui';
import { TestScene } from './world/test-scene';
import { WorldWorker } from './world';
import type { QualityMode } from './config/quality';

export interface FoundationSnapshot {
  backend: string; bodyY: number; bodySpeed: number; settled: boolean; workerReady: boolean;
  fps: number; frameMs: number; tier: number; qualityMode: QualityMode;
  paused: boolean; ticks: number; simulationTime: number; drawCalls: number; triangles: number;
  cubeRotation: number; input: string; device: string; steering: number; throttle: number; brake: number;
}
declare global {
  interface Window {
    __foundation?: { snapshot(): FoundationSnapshot; resetBody(): void; impulse(): void };
  }
}
async function boot(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#scene')!;
  const bootStatus = document.querySelector<HTMLElement>('#boot-status')!;
  const save = new SaveStore();
  const settings = loadSettings(save);
  save.write(settings);
  const quality = new QualityScaler();
  quality.setMode(settings.quality);
  const worker = new WorldWorker();
  const workerPromise = worker.initialize(APP.worldSeed).catch(error => { console.warn('World worker unavailable:', error); return null; });
  const [context, physics] = await Promise.all([createRenderer(host, quality.current), PhysicsSandbox.create()]);
  const { renderer } = context;
  const world = new TestScene();
  const view = new InspectionCamera();
  const input = new InputManager(renderer.domElement, settings.bindings, settings.wheel);
  world.applyQuality(quality.current);
  let paused = false;
  let loop: FixedStepLoop;
  let hud: HUD;
  let hudElapsed = 1;
  let previousFrameTime: number | undefined;
  const persist = () => { save.write(settings); };
  const setPause = (value: boolean): void => {
    paused = value;
    loop.setPaused(paused);
    hud.setPause(paused);
    quality.resetMonitor();
    previousFrameTime = undefined;
  };
  const reset = (): void => {
    physics.reset();
    hud.notify('Rigid body reset · 6.5 m drop');
    if (paused) setPause(false);
  };
  const impulse = (): void => {
    if (paused) setPause(false);
    physics.impulse();
    void input.rumble();
  };
  const setQuality = (mode: QualityMode): void => { settings.quality = mode; quality.setMode(mode); persist(); };
  hud = new HUD(document.querySelector<HTMLElement>('#interface')!, input, settings, {
    pause: () => setPause(!paused), reset, impulse,
    camera: () => { view.reset(); hud.notify('Camera returned to origin'); },
    settingsChanged: persist, quality: setQuality,
    resetSave: () => {
      if (!window.confirm('Reset all saved Crosstown foundation settings and bindings?')) return;
      if (save.clear()) location.reload();
      else hud.notify('Browser storage is blocked. Nothing was changed.');
    },
  });
  hud.setBackend(context.backend);
  const resize = (): void => {
    context.resize(host.clientWidth, host.clientHeight, quality.current);
    view.resize(host.clientWidth, host.clientHeight);
    view.camera.far = quality.current.viewDistance;
    view.camera.updateProjectionMatrix();
  };
  quality.onChange = () => { world.applyQuality(quality.current); resize(); };
  resize();
  const abort = new AbortController();
  window.addEventListener('resize', resize, { signal: abort.signal });
  document.addEventListener('visibilitychange', () => {
    loop.setPaused(paused || document.hidden);
    loop.resetClock(); quality.resetMonitor(); previousFrameTime = undefined; input.clear();
  }, { signal: abort.signal });
  loop = new FixedStepLoop({
    beforeFrame(dt) {
      input.poll();
      if (input.pressed('pause')) setPause(!paused);
      if (input.pressed('diagnostics')) { settings.diagnostics = !settings.diagnostics; hud.setDiagnostics(settings.diagnostics); persist(); }
      if (!paused) {
        if (input.pressed('reset')) reset();
        if (input.pressed('impulse')) impulse();
        if (input.pressed('camera')) view.reset();
        view.update(input.frame, dt, settings.reducedMotion);
      }
      input.endFrame();
    },
    fixedUpdate(dt) { physics.step(); world.fixedUpdate(dt, settings.reducedMotion); },
    render(alpha, dt) {
      const now = performance.now();
      if (!paused && !document.hidden && previousFrameTime !== undefined) quality.sample((now - previousFrameTime) / 1000);
      previousFrameTime = now;
      world.render(alpha, physics);
      renderer.render(world.scene, view.camera);
      hud.markers(world.cubeLabelPosition, world.bodyLabelPosition, view.camera, host.clientWidth, host.clientHeight);
      hudElapsed += dt;
      if (hudElapsed >= 0.1) { hud.update(quality, physics, worker.ready, save.available, paused); hudElapsed = 0; }
    },
  }, APP.fixedStep, APP.maxFrameDelta, APP.maxSubsteps);
  // Compile the shared node graph before starting the physics clock, avoiding a startup time jump.
  world.render(1, physics);
  bootStatus.textContent = 'Preparing the first frame…';
  await renderer.compileAsync(world.scene, view.camera);
  await workerPromise;
  bootStatus.remove();
  document.documentElement.dataset.ready = 'true';
  document.documentElement.dataset.backend = context.backend;
  renderer.setAnimationLoop(loop.frame);
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    window.__foundation = {
      snapshot: () => ({
        backend: context.backend, bodyY: physics.body.translation().y, bodySpeed: physics.speed,
        settled: physics.settled, workerReady: worker.ready, fps: quality.fps, frameMs: quality.frameMs,
        tier: quality.tier, qualityMode: quality.mode, paused: loop.paused, ticks: loop.ticks,
        simulationTime: loop.simulationTime, drawCalls: renderer.info.render.drawCalls,
        triangles: renderer.info.render.triangles, cubeRotation: world.cube.rotation.y,
        input: input.lastEvent, device: input.deviceKind, steering: input.frame.steering,
        throttle: input.frame.throttle, brake: input.frame.brake,
      }), resetBody: reset, impulse,
    };
  }
  const dispose = (): void => {
    renderer.setAnimationLoop(null);
    abort.abort(); input.dispose(); worker.dispose(); physics.dispose(); world.dispose(); renderer.dispose();
    context.gpuHandles?.device.destroy();
    delete window.__foundation;
  };
  import.meta.hot?.dispose(dispose);
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { once: true, signal: abort.signal });
}
boot().catch(error => {
  console.error('Foundation initialization failed:', error);
  const status = document.querySelector<HTMLElement>('#boot-status');
  if (status) {
    status.classList.add('error');
    status.textContent = 'The graphics engine could not initialize. This scene needs WebGPU or WebGL 2. Try enabling hardware acceleration, or test the WebGL 2 fallback.';
    const button = document.createElement('button');
    button.textContent = 'Retry with WebGL 2';
    button.onclick = () => { const url = new URL(location.href); url.searchParams.set('webgl', ''); location.href = url.href; };
    status.appendChild(button);
  }
});
