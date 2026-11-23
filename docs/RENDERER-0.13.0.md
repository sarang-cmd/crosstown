# Renderer compatibility notes

Checked the current official [WebGPURenderer manual](https://threejs.org/manual/#webgpurenderer) in full before writing source code, on 2026-11-22. The canonical page now resolves to `manual/pages/webgpurenderer.html`.

Installed and inspected **Three.js 0.180.0 (r180)**, published 2025-09-03. Package exports confirm:

- `three/webgpu` → `./build/three.webgpu.js`
- `three/tsl` → `./build/three.tsl.js`
- `three/addons/*` → `./examples/jsm/*`

## Decisions

- Use `WebGPURenderer` from `three/webgpu`, including its built-in WebGL 2 backend. Await `init()` and `compileAsync()` before starting the simulation clock. Use `setAnimationLoop()`.
- Default to automatic WebGPU selection. Use `?webgl` to explicitly exercise `forceWebGL: true`. If automatic initialization rejects, also try a fresh forced-WebGL renderer.
- Report the actual initialized backend, **not** `isWebGPURenderer` (which is true for both).
- Use `MeshStandardNodeMaterial` and `MeshBasicNodeMaterial`. The grid and sky are composed in TSL; the same graph targets WGSL and GLSL.
- No raw GLSL, `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, or `EffectComposer` is used.
- The foundation, rooftop district, seven-district streamed city, procedural facade windows, sky and animated water all use node materials/TSL. The district uses emissive markers/beams, instancing, lit geometry, fog, animated hazards and cheap fireworks, not legacy custom shaders. There is no full-screen post-processing stack; later bloom/SSR/motion-blur effects must use a TSL node chain.
- PCF sun shadows, capped device pixel ratio, four quality budgets. Rooftop/city detail visibility and nearby physics streaming are active. Living traffic/pedestrian density follows the tier and an independent adaptive budget; heavy post-effect flags remain metadata, not claims of shipped effects.
- The app needs WebGPU or WebGL 2 and WebAssembly. If neither rendering API is available it shows a small honest diagnostic, not a fake scene.

The latest manual may describe newer releases; APIs used here were also verified against the installed r180 exports/types and tested in both backends. No claim is made that r180 is the latest release.

## Device lifecycle and testing

The context retains strong references to the GPU instance, adapter and device. Genuine device loss remains possible; the upstream discussion covers the platform risk [1](https://github.com/mrdoob/three.js/issues/33559). Our recovery policy stops rendering and restarts the current scene with `?webgl` after a WebGPU device loss, preserving the URL's seed/scene flags and saved settings. Intentional device destruction during cleanup is ignored. This is a recovery policy, not a claim that loss is impossible.

WebGPU checks use a headed Chromium compositor under Xvfb with a software Vulkan/SwiftShader device and require actual pixels from both foundation meshes or the amber animated runner/rooftops, depending on the scene. A ready API or a nonzero draw-call counter alone is not accepted. Forced WebGL 2 and WebGPU-disabled fallback are tested in development, against local production chunks and against the actual public Vercel deployment. Exact current production/public, fleet and retained vehicle suite results are recorded in TESTING; historical 0.7 passes are not substituted for new 0.9 evidence. Hardware performance remains unverified; see `docs/TESTING.md`.

## City installation / shader variants

Static street geometry is baked into transferable vertex-colored buffers in the city worker; the source records are kept. The renderer uses shared materials, instanced building volumes, a single mixed mover `BatchedMesh`, far volume impostors, alpha-hashed detail fading and a bounded GPU-ready retired-chunk cache (48). Buildings/lights allocate minimum 32/128 instance capacities, drawing the actual counts, because installed r180 small-instance UBO arrays otherwise vary by capacity. This is not a shader-stall or ≤8 ms acceptance claim: later program waits and up to 79.5 ms installation slices remain recorded. See `FINDINGS.md` and `PERFORMANCE-COMPARISON.json`.

## Steps 06–07 cabins and mirror targets

Code-built cabins use the same node-material renderer, not a DOM/photo overlay. Each live car owns cloned glTF materials/textures; rooftop cleanup is restricted to its own root/caches. Ownership/disposal units and route restart/re-entry bounds pass; no long GPU-memory soak is implied.

Mirrors are actual 256×96 center / 128×96 side render targets rendered every second displayed frame on High/Ultra; Low/Balanced explicitly show an OFF texture. The cabin/exterior are hidden during rear renders and restored in `finally`, together with the previous render target. TSL mirror sampling applies horizontal reflection and the required vertical target orientation correction. Screen-material upper/lower color fixtures, not only raw target memory, pass on **both** backends. No screen-space/ray-traced scene reflection or near60 FPS acceptance is inferred.

## Steps 08–09 · moving-agent cost

Twelve decoded low-poly source geometries share batched traffic rendering; far cars/people use simpler instanced stand-ins. Moving batches disable only an invalid stale outer bound, retaining per-instance culling. Near damaged cars temporarily own deformable visuals. Skinned near-person caps are 3/6/8/12 by tier. Full Rapier proxies/capsules stream inside 80 m in the one shared world, not a separate hidden per-agent step.

Low keeps a square 3×3 detailed chunk neighborhood; other tiers retain their view-based neighborhoods and far city coverage. Retirement uses matching square bounds to prevent corner churn. Balanced shadows refresh at reduced cadence; live mirrors remain High/Ultra only. Density and Auto measure actual multi-second frame intervals instead of dropping them; only hysteresis accumulation is capped. Pausing/hidden time is not normal cadence.

Controlled before/after profiles deliberately disable population and fix seed/date/hour/quality/viewport. Populated real-wall-time observations are separate. Neither low draw counts nor adaptive reduction proves native near60 FPS; the lag target remains open.
