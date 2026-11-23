# Crosstown · verification of 0.14.0 / 14.002

**Release label: 22 November 2026 · Steps 01–14 prototype.** This page separates implemented scope, actual software/browser/physics observations and unfinished native/human/provider gates. The original DESIGN is byte-identical. Earlier outcomes remain in [TESTING-0.13.0.md](TESTING-0.13.0.md), historical summaries and raw evidence, not newly rerun whole-city acceptance. Public production is still 0.13.0; this source update is not a deployment.

## Evidence and revision boundary

[TEST-RESULTS.json](TEST-RESULTS.json) is the derived machine-readable summary; [EVIDENCE-MANIFEST.json](EVIDENCE-MANIFEST.json) fingerprints runtime, verification code and artifacts. Current reports/logs/captures are under `evidence/crosstown-0.14.0/`. Reports listed in [EVIDENCE-COMPRESSION.json](EVIDENCE-COMPRESSION.json) are losslessly stored as `.gz`; `gzip -dc` restores their original bytes/SHA-256. Historical output names in command logs are not rewritten after compression.

The final functional collector runs browsers **sequentially**, one writer per report, recording commands, timeouts, collector hashes, start/end and exit status. Before/after runtime fingerprints detect source drift. **Release metadata is labelled 2026-11-22; that is not the final run date.** The final batch records **2026-11-23T11:40:30.017Z → 2026-11-23T11:57:03.556Z**. The profile collector's hardcoded top-level `date: 2026-11-22` / `timezone: Europe/Berlin` labels are stale: use its ISO `capturedAt` and stage timestamps ending in `Z` for actual recorded UTC provenance. The tested collector and all raw/historical records remain unchanged to preserve their recorded hashes. The source proof's `date` follows release metadata; its separate `capturedAt` is the actual recorded capture time.

Candidate runtime SHA-256: **`44522b11cde89b169e5e2f8bb4028f9763fa14e395764d64bdeafcd312aa3542`**. The release summarizer and packager require completed unchanged boundaries. [CANDIDATE-BUILD.json](CANDIDATE-BUILD.json) records local compiled-output hashes; [PUBLIC-BUILD.json](PUBLIC-BUILD.json) remains the separately published 0.13 output. Do not run anonymous deployment equality against the new local dist and then claim the old public site contains it.

| Executed check | Observed result / boundary |
|:--|:--|
| Full unit/real-physics suite | **139 passed, 0 failed/skipped**, **29,891.207 ms**; 125 earlier cases + 14 Step 14 regressions |
| Strict types / decoded GLB audits / exact dependency pins | **Pass / 22 of 22 / 15 of 15** |
| Current production build | **Pass, 4.79 s**; `integration-build.log` |
| Retained built-output pixels | **6 expected, 0 unexpected/skipped/flaky**, **88,808.855 ms**; WebGPU, forced WebGL 2 and disabled-WebGPU fallback |
| Lighting executable phases | **9/9 WebGL 2 + 9/9 WebGPU**, fourteen isolated on/off effects each, zero runtime/network errors |
| Built city-life phases | **11/11 WebGL 2 + 11/11 WebGPU**, zero runtime errors; explicit Low/population-OFF fixtures |
| Physical activities / delivery collision failure / records reload | **6/6 finishes and rewards + pass + pass**, actual shared-world chassis/pedals |
| Landing | **320 / 390 / 768 / 1440**, no overflow/canvas/engine before Play |
| Actual radio providers | **5 core rows pass / 2 failed-or-unavailable**, no authenticated Spotify |
| Busy downtown four-tier cadence | Actual rAF results and per-tier failures, if any, are recorded in [PROGRESS.md](PROGRESS.md) and `candidate-busy-{webgl,webgpu}.json`; **not a native 60 FPS pass** |
| Clean extracted source | [Source-build proof](evidence/crosstown-0.14.0/source-archive-build.json): clean install/build/model/pin audits and every output byte compared to the local candidate, not public 0.13 |
| Public deployment | **No Step 14 deployment**; separately verified 0.13 remains. [Details](DEPLOYMENT.md) |

## Lighting acceptance: what is actually tested

`tools/accept-lighting.mjs` first uses the explicit `tests/lighting/` page on Vite. This is **synthetic static geometry and a synthetic car using real production rendering modules**, not a gameplay or FPS fixture. Each backend compares actual effect-on/off image bytes for bloom, height fog, wet SSR, camera blur, heat haze, shafts, flare, cones, smoke, skids, sparks, rain splashes, neon and lamps. Every effect changes at least 20 pixels. Mirrors and lit windows are tested separately in the real game.

Off-state assertions require one common beauty target/composite, no sampleable depth texture, no optional post branch/target, no world batches/particles/matrix or opacity allocation, no luminous city meshes/materials, and unchanged effect update counters after four disabled frames. The fixed off-scene draw count stays constant. Eight enable/disable cycles, resizing and actual WebGPU GC check short-run resource behavior; they do **not** prove long driver-memory soak freedom.

The same collector then opens the **built game** on 4193 and checks:

1. Immediate `/play`, correct backend, retained saved route, no choosing/pause at startup.
2. Actual intact head/brake cones and rain splashes; actual cockpit mirrors render, and toggling off releases live targets.
3. Dry/clear weather plus reduced motion really removes ineligible wet/blur/haze/flare branches; saved switches survive reload.
4. A real chassis hits the existing physical circuit wall. Actual damage/contact events feed sparks, with no damage/reward injection. The explicit lab's synthetic emitter is not substituted for this check.
5. Actual downtown dusk windows and neon; isolated window on/off pixels have correct final labels. All-off removes optional city/world objects, retaining only the documented common grade path.
6. 390×844 resize, finite colored pixels, no overflow; WebGPU garbage collection does not break node materials.

Both final lighting reports have errors/network arrays `[]` and **two existing Rapier deprecated-init warnings per backend**. The initial generic-404 WebGPU attempt and earlier undefined-blending warnings remain separately named and are not counted as final clean results. Assistant inspection covers final lab effects and real game windows, car/rain and dusk captures on both backends; this is not comprehensive human art direction or every camera/device pose.

**The exact off contract is structural, not literal zero frame cost.** The shared HDR beauty/grade/depth buffer, policy checks, original geometry/window pattern, mirror housings and cached city records remain. No claim of zero total CPU/GPU time, driver VRAM measurement or exhaustive glitch freedom. [Architecture/limitations](LIGHTING.md).

## Busy-scene measurements

`tools/profile-lighting.mjs` uses fresh browsers, a **1920×1080 viewport / DPR 1**, fixed tiers and actual requestAnimationFrame intervals. Low/Balanced use **1344×756 / 1632×918** internal pixels; High/Ultra use **1920×1080**. The adapter is recorded. Default is SwiftShader; `GRAPHICS=native` requests headed native graphics on a real laptop and still requires adapter verification.

The fixture requests locked **60 cars / 120 pedestrians**, downtown, rain, 18:15, three stars and helicopter. At least **two physical ground police and nine nearby loaded chunks** are required before timing. Actual night-reduced pedestrian/cars/police/chunk counts, resources, CPU phases and worker timings are retained before/after. Debug initial positioning/density/stars and setup steps are disclosed. **Zero manual simulation steps occur during the timed interval**: a braked car, ordinary simulation and display rAF only. This common fixed-density workload is not proof of each tier's uncapped maximum population or the whole map's global worst camera. A short stationary pursuit load is not a human driving/chase or long soak.

Twelve seconds/eight intervals minimum yields short diagnostic samples, not a robust statistical benchmark. Balanced records an additional compressed Chrome CPU profile. CPU phase timing is submission-side, not GPU execution. Resource estimates are not actual VRAM or overdraw. Worker generation/queue/delivery/roundtrip includes scheduling, not necessarily a main-thread stall. Chunk install outliers are retained rather than clamped.

The final busy-v3 frozen 0.13 baseline verifies actual **Downtown**, with **nine nearby chunks/four physical police**. Earlier nominal-downtown v1/v2 road interpolation actually entered Old Town; their Ultra setup interruption is preserved, not current location-qualified evidence. The earlier 0.13 stars/heli sample with zero physical police is explicitly not qualified. Full numeric results and original/settled protocol distinctions belong in [PROGRESS.md](PROGRESS.md). Neither a completed collector nor low draw count constitutes native 60 FPS acceptance; reported lag remains open.

## Retained gameplay and providers

`tools/accept-city-life.mjs` reruns eleven phases per backend using actual production modules, real sight/projectile/collision worlds, finite ammunition, paid UI transactions, stored VINs, hospitals, radio state and two distinct rooftop marker runs. It uses **Low / population OFF / explicit debug saves and positioning**, with accelerated fixed steps where stated. This is not a broad native performance or ordinary-human escape/map-following pass. The complete phase descriptions remain in [TESTING-0.13.0.md](TESTING-0.13.0.md).

`tools/accept-activities.mjs` uses ordinary chassis steering/pedals in the shared Rapier world. Placement is between attempts only; route/drift/stunt logic integrates physical inputs, not injected scores/rewards. All six finish and retain top-three records/cash; normal wall impact fails delivery without changing bank/bests, then reload compares records/bank. Human tuning/handling remains open.

`tools/accept-landing.mjs` checks four widths and no game-engine fetches/canvas before Play. The hero is disclosed AI-generated concept art; the three feature images are actual captures.

`tools/accept-radio-providers.mjs` contacts **real** providers through an HTTPS fixture, no mocked provider events. Five core rows pass (no-ID Spotify hidden/no SDK; four procedural stations/volume/static/fades; actual DE HTTPS Radio Browser playback; station change; persistence/exit stop). Two official YouTube/SoundCloud rows fail or are unavailable. They require observed PLAY followed by a changed playing title after Next; readiness, metadata or a successful method return is insufficient. **Spotify authentication is untested** without supplied ID/Premium/allowlisted account, and game-visual-sync/API permission review is separate. [RADIO.md](RADIO.md).

## Reproduce

```sh
npm ci
npm test
npm run typecheck
npm run assets:check
npm run check:versions
npm run build
# Separate terminals; keep both running:
npm run dev                                  # port 5173 laboratory/provider modules
npm run preview -- --port 4193 --strictPort   # built game
# Individual current checks:
npm run accept:lighting
xvfb-run -a env BACKEND=webgpu npm run accept:lighting
npm run profile:lighting
xvfb-run -a env BACKEND=webgpu npm run profile:lighting
GRAPHICS=native npm run profile:lighting       # real target laptop, inspect adapter
npm run accept:life
xvfb-run -a env BACKEND=webgpu npm run accept:life
npm run accept:activities
npm run accept:landing
npm run accept:radio
# Or sequential current batch after recording the exact runtime boundary:
node tools/fingerprint-runtime.mjs docs/evidence/crosstown-0.14.0/tested-runtime-before.json
node tools/check-release-functional.mjs
node tools/check-source-build.mjs
node tools/check-handoff.mjs
node tools/release-evidence.mjs
npm run package
```

Omit Xvfb on a desktop with a display. Never run competing benchmark browsers or multiple writers of a report. Full retained vehicle suites temporarily withhold/restore a WAV; do not overlap them. Build/preview code must match the runtime boundary. Post-summary edits require regenerating the evidence manifest before packaging. `verify:deployed` compares the intended **published** build, not automatically the current local dist.

## Open gates / provenance

Native 840M-class 1080p60, human art direction/handling/listening, physical devices, complete touch-only on-foot controls, strict traffic fairness/no-stuck, ≤8 ms maximum streaming slice, continuous-map no-popping and long driver-memory soak remain open. SSR/off-screen, camera-only blur, approximated height fog and unshadowed cones are documented compromises. [FINDINGS.md](FINDINGS.md).

Failed/interrupted initial lighting/baseline/profile attempts and earlier releases remain named raw evidence; no failed telemetry is edited into a pass. Historical full fleet/traffic/public tests stay historical. All fixed-name historical ZIPs and all 77 historical PNGs remain intact. Portable-source archive-only exclusions and exact restorations are documented in [SOURCE-ARCHIVE.md](SOURCE-ARCHIVE.md).
