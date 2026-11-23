# Crosstown · Step 14 lighting and effects

**0.14.0 / 14.002 · 22 November 2026.** Implementation and software checks are not a native 60 FPS or human art-direction acceptance. Preserve this distinction. Production remains the separately verified 0.13.0 release unless [DEPLOYMENT.md](DEPLOYMENT.md) explicitly records a later deployment.

## Controls and persistence

Escape → **Light & atmosphere** has saved per-effect opt-outs. Checked means eligible within the selected tier/weather, not a promise that an effect is visible in every camera pose. Each row shows current eligibility. Older `crosstown:settings:v1` saves acquire an empty `disabledEffects` array; unknown/duplicate names are discarded. Existing bindings, wheel mapping, audio, progress and twelve-vehicle saves are unchanged.

Reduced motion removes camera motion blur, asphalt heat haze and lens flare. Wet reflections and rain splashes only allocate in rain; tire smoke is suppressed in rain, where splashes remain. Shafts/haze/flare require clear daylight and cannot brighten a night/rain scene. Bloom needs a bright HDR source; windows, lamps, neon, brakes and headlights provide emission. Headlight cones require intact enabled lamps; rear cones respond to actual brake/handbrake input. A bounded six-nearest-car light budget includes active, physical traffic, police and race vehicles.

## Render chain

The installed **Three.js 0.180.0** exports **`PostProcessing`**, not the newer online guide's `RenderPipeline`. The scene, all effects and final grade use node materials / TSL. There is no EffectComposer, ShaderMaterial, raw GLSL, vendor edit or `onBeforeCompile` hook.

1. Render one linear half-float HDR beauty with a depth buffer. A *sampleable depth texture* is only created if an active effect needs it.
2. If enabled: nine-tap HDR bloom threshold/downsample; filtered 24-sample sun-shaft occlusion; rough, soft-confidence 12-step screen-space wet reflections. Each is a separate **quarter-width × quarter-height** target, **1/16 of full-resolution pixels**, and one additional draw. No pyramid, history textures, full-scene reflection camera or velocity MRT is allocated.
3. One full-screen TSL composite: bounded five-sample **camera** blur, small near-ground heat distortion, filtered rough reflections with full-resolution normal rejection, eight-sample depth-terminated height fog, filtered shafts/glow, sun-occluded flare, then coastal saturation/cool-night/legibility grade.
4. ACES and output color-space conversion happen **once**, through PostProcessing. The HTML HUD is not blurred. Camera cuts reset motion history. Both backend coordinate conventions use installed Three depth reconstruction helpers.

The first full-resolution eight-tap shaft experiment produced visible silhouette copies; it was rejected after inspecting actual pixels. Jittered quarter-resolution shafts plus filtering replace it. The first binary SSR experiment had conspicuous marching gaps; soft hit confidence and filtering replace it. Their initial captures/reports remain named as early evidence, not final acceptance.

At full 1920×1080, the shared RGBA16F + depth payload estimate is **24,883,200 bytes**. Each optional quarter-resolution RGBA16F target adds **1,036,800 bytes**. These are arithmetic storage estimates, not measured driver VRAM. The debug resource audit separately reports scene buffer/texture payload estimates and explicitly excludes driver caches/residency.

## World effects and city lighting

- At most 24 light cones and 24 matching ground pools; six nearest cars within 120 m. One instanced cone draw plus one pool draw; unlit two-sided materials force a single pass instead of r180's redundant back/front submissions. Only the active car retains the earlier unshadowed spotlight; disabling cones removes that light from the renderer too.
- Tire smoke, collision sparks and rain splashes each cap at **96** particles; skid marks cap at **192**, expire after 22 simulated visual seconds and fade near expiry. Fixed preallocated particle objects are reused; no particle adds a physics body. A maximum 256 wheel-history entries prevents vehicle-ID churn from growing tracks indefinitely.
- Rear-wheel contact/slip/handbrake/braking controls smoke and marks. Actual physics collision/glass events from owned, population, police and rival chassis feed sparks before the original event queues are drained. Existing audio, damage, feedback and scoring paths are retained.
- Particle geometry uses the same single-pass rule and has per-instance opacity and bounded matrix/color/opacity uploads. Transparent depth writes are off. Empty batches issue no draw. The r180-compatible fixed 1,024-matrix capacity avoids its small-count UBO specialization; it does **not** increase the live draw count. Matrix payload per enabled batch is 65,536 bytes; opacity payload is 4,096 bytes where used.
- Original texture-free Art-Deco shop ribbons have cyan/magenta/lime/orange emission, including downtown and the coast. Warm lamp records and colored neon records are separate instanced families. At most two luminous draws per visible city chunk; no hundreds-of-point-lights approach. Both families actually dispose meshes/materials when disabled, including retired chunks. Static generated city records remain cached.
- Dusk windows share building/far-impostor shaders, not separate window objects. Derivative filtering suppresses tiny distant window aliasing. The lit-window opt-out recompiles the material without the emissive/lighting blend; baseline reflective window pattern and buildings remain.

## Four laptop budgets

All tiers cap DPR at 1. A 1920×1080 **viewport** is not necessarily native-resolution rendering:

| Tier | Internal pixels at 1080p viewport | Sun shadow | Detail radius | Default optional post |
|:--|:--|:--|:--|:--|
| Low | 1344×756 (70%) | Off | 1 chunk | Shared grade only |
| Balanced | 1632×918 (85%) | 512² PCF, every fourth display frame | 2 chunks | Bloom; daylight flare |
| High | 1920×1080 | 1024² PCF | 2 chunks | Bloom, rain reflections, clear shafts/haze/flare |
| Ultra | 1920×1080 | 1536² PCF | 3 chunks | High + height volume and camera blur |

The complete 4 km terrain/road/impostor coverage remains. The roster, routes, weapons, police, traffic and pedestrians are not deleted to make a timing number. Normal population adaptation remains; the benchmark explicitly locks requested density and records actual counts, including night pedestrian reduction.

Auto uses measured display-frame intervals, not the capped physics step. After an eight-second warmup, sustained >19.5 ms frames shed **volumetric fog → motion blur → wet reflections → bloom**, skipping already-unavailable branches; shafts share the volumetric budget. Only then does it reduce tier resolution/shadows/detail/population. Changes have a three-second cooldown. Recovery needs 12 seconds of <17 ms headroom; shed branches return in reverse order before a tier increase. Manual tiers remain fixed. A long stall is reported honestly, not clamped to a fake 60 FPS.

## What “off” means, precisely

Executable checks compare actual effect-on/off pixels, allocation counts, draws, shader-branch selection and update counters. Disabled post effects have no corresponding graph branch/lookup, auxiliary target, auxiliary draw or effect-specific uniform update. Disabled world families have no mesh, material, particles or uploads/draws. Neon/lamps dispose their render objects/materials. Disabled mirrors release live targets/materials; their existing static housings/“off” placeholders remain.

**Not claimed:** zero total frame cost, zero shared dispatch cost, or nanosecond-identical CPU/GPU time. The common beauty target, depth buffer, color grade/composite, preference-policy checks, original world geometry and cached static city records remain. Literal “the whole frame costs nothing” would be false. Per-effect isolation is tested; native GPU time/residency and long-soak leak freedom are not established by a short software run.

## Reproduce and profile

```sh
npm ci
npm run build
npm run dev                  # port 5173; laboratory uses actual production modules
npm run preview -- --port 4193 --strictPort
npm run accept:lighting
BACKEND=webgpu xvfb-run -a npm run accept:lighting
npm run profile:lighting     # four fresh browsers, 1920×1080, SwiftShader by default
BACKEND=webgpu xvfb-run -a npm run profile:lighting
# On the real target laptop, headed native graphics, inspect recorded adapter:
GRAPHICS=native npm run profile:lighting
```

The explicit `tests/lighting/` laboratory uses synthetic static geometry/car only to isolate pixels/resources. It is **not** a gameplay, human-eye or FPS test. The built-game collector separately tests immediate startup, real car lights/rain, physical impact-wall sparks, saved switches/reduced motion, real city windows/neon, mirror disposal, resize and WebGPU garbage collection.

The final busy-v3 collector verifies the actual **Downtown** district and requests **60 cars / 120 pedestrians, 18:15, rain, three stars and helicopter**. It sets the fixed requested density before setup stepping, and persists/time-bounds every setup stage. An earlier nominal-downtown road point crossed into Old Town and its Ultra setup stalled before timing; those interrupted attempts are preserved and are not the final Downtown measurements. It requires at least **two physics-enabled ground police and nine nearby loaded chunks** before timing. Initial debug positioning and setup steps are disclosed; during measurement there are **zero manual simulation steps**, only normal input/simulation and actual rAF intervals. Before/after population/pursuit/chunk counts, renderer/internal resolution, resource estimates and a Balanced CPU profile are retained. Twelve seconds/eight intervals minimum make these short diagnostic samples, not a statistically complete benchmark or long chase soak.

Actual results belong in [PROGRESS.md](PROGRESS.md) and current `evidence/crosstown-0.14.0/*busy*.json`. Main-thread phase timers measure **CPU submission**, not GPU time. Worker work/roundtrip/queue-delivery timings are separate; a delayed worker reply is not itself a synchronous main-thread wait. Normal streaming already uses a four-request pending cap (explicit test/bootstrap requests can increase total worker high-water), transferred buffers, worker-baked decor, resumable installation and an LRU. A single install slice can still exceed its nominal budget; report, do not hide, those outliers.

## Remaining visual/hardware boundaries

This is stylized, bounded real-time lighting, not path tracing: SSR cannot reflect off-screen objects and can fade at edges; camera blur is not per-object velocity blur; fog is an eight-sample single-scatter height approximation; light cones/pools are not fully shadow-occluded volumetric spotlights. Overlapping near light/searchlight pools can wash out sidewalk highlights in the busy-scene captures; final highlight/art tuning remains open. Broad human art-direction/device/long-soak acceptance remains open even after actual assistant-inspected pixels and both-backend executable checks. Native Radeon 840M / 60 FPS acceptance cannot be established on this software-only sandbox. No new external models, sounds or textures were needed; effects and neon geometry are original code-built assets.

## File map

`src/rendering/{post,effects-policy,world-effects,particles,city-lights,profile,resources}.ts` · `src/config/quality.ts` · `src/core/quality.ts` · `src/ui/effects-settings.ts` · `src/save/index.ts` · `src/game.ts` · `src/world/city/{generator,mesh-bake,stream,environment,worker,city.worker}.ts` · `src/vehicles/{index,visual,cockpit}.ts` · `src/{npc,police,challenges}/index.ts` · `tests/lighting/` · `tests/unit/{lighting,effects-resources,quality}.test.ts` · `tools/{accept,profile}-lighting.mjs`.
