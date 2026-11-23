// Three r180 dual-backend renderer. GPU instance/adapter are retained to survive Chromium/Dawn garbage collection.
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';
import type { QualityTier } from '../config/quality';
export interface RendererContext {
  renderer: WebGPURenderer;
  backend: 'WebGPU' | 'WebGL 2';
  gpuHandles?: { instance: GPU; adapter: GPUAdapter; device: GPUDevice };
  resize(width: number, height: number, tier: QualityTier): void;
}
export async function createRenderer(host: HTMLElement, initialTier: QualityTier): Promise<RendererContext> {
  const forceWebGL = new URLSearchParams(location.search).has('webgl');
  let gpuHandles: RendererContext['gpuHandles'];
  // Avoid a permanent 4× MSAA render/resolve at laptop resolution; tier resolution and
  // browser upsampling remain available without multiplying every shadow/sky fragment.
  // r180's internal adapter is temporary. Keep our own strong references; no vendor patch or global monkey-patch.
  if (!forceWebGL && navigator.gpu) {
    try {
      const instance = navigator.gpu;
      const adapter = await instance.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const device = await adapter.requestDevice({ requiredFeatures: Array.from(adapter.features) as GPUFeatureName[] });
        gpuHandles = { instance, adapter, device };
      }
    } catch { /* The renderer's automatic WebGL 2 fallback is still available. */ }
  }
  const make = (force: boolean) => new WebGPURenderer({ antialias: false, forceWebGL: force, powerPreference: 'high-performance', device: force ? undefined : gpuHandles?.device });
  let renderer = make(forceWebGL);
  try { await renderer.init(); }
  catch (error) {
    if (forceWebGL) throw error;
    renderer.dispose();
    gpuHandles?.device.destroy(); gpuHandles = undefined;
    renderer = make(true);
    await renderer.init();
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = initialTier.shadows;
  renderer.shadowMap.type = PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.id = 'world-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Interactive 3D foundation. Drag to orbit; scroll to zoom; Space to apply impulse; R to drop again.');
  host.appendChild(canvas);
  const backend = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  renderer.onDeviceLost = info => {
    if (info.reason === 'destroyed') return; // Normal disposal is not a graphics failure.
    renderer.setAnimationLoop(null);
    if (backend === 'WebGPU') {
      console.warn('WebGPU device was lost; restarting this foundation with WebGL 2.', info.message);
      const url = new URL(location.href); url.searchParams.set('webgl', ''); location.replace(url.href);
    } else {
      const notice = document.createElement('div'); notice.id = 'boot-status'; notice.className = 'error';
      notice.textContent = 'The graphics context was lost. Reload this page to reconnect the renderer.';
      host.appendChild(notice);
    }
  };
  const resize = (width: number, height: number, tier: QualityTier): void => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxDpr) * tier.resolutionScale);
    renderer.setSize(Math.max(1, width), Math.max(1, height));
    renderer.shadowMap.enabled = tier.shadows;
  };
  resize(host.clientWidth, host.clientHeight, initialTier);
  return { renderer, backend, gpuHandles, resize };
}
