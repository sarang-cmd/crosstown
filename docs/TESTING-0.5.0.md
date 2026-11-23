# Crosstown verification · Steps 01–05

**Test date: 2026-11-22 · source 0.5.0.** Current machine-readable summary: [TEST-RESULTS.json](TEST-RESULTS.json). The previous release's report is preserved separately: [TESTING-0.3.0.md](TESTING-0.3.0.md), [TEST-RESULTS-0.3.0.json](TEST-RESULTS-0.3.0.json). Historical passes are not silently counted as current results.

## Current observed results

| Check | Observed result |
|---|---|
| `npm test` | **53/53 passed**, 0 failed/skipped; 20 foundation + 20 parkour + 13 city/session tests |
| Typecheck and production build | **Passed**; three workers, game/foundation and split renderer/physics chunks emitted |
| Assets | **3/3 passed**; actual dimensions/triangle/clip/hash checks retained |
| Dependency age/pins | **15/15 passed**; exact versions, publication no later than 2026-11-08 |
| Original reference | Byte-for-byte comparison with supplied DESIGN passed |
| City functional browser cases | **6/6 passed** across WebGPU/forced WebGL 2; choices/real A/D/stable yaw/saves, district/map/weather/dusk, real bridge/timer hold |
| Added city integration cases | **2/2 passed** across both backends; all six worker-relocated starts, cache one-shot save/reset, fly-to-walk landing |
| Retained gameplay browsers | **7/7 passed** across WebGPU, forced WebGL 2, WebGPU-disabled fallback, including full physical finish/save/ghost/night pilot |
| Retained foundation browsers | **12/12 passed**, WebGPU / forced WebGL 2 / WebGPU-disabled fallback |
| Final built-output browsers | **6/6 passed** on the final fixed-capacity build, all three backends |
| Strict refreshed city tour | **1/1 WebGPU passed**, corrected camera-anchor readiness, all seven districts with 3×3 near chunks, rain and map route captured |
| Continuous unpaused render/flight profile | Completed: current rooftop **0.855 rAF FPS**, partial W+Shift flight **0.989 rAF FPS / 230 m**. Software only; not a performance pass |
| Public production | **5/5 browser cases passed**; **22/22 anonymous file hashes match** the final build. READY/PROMOTED; see [DEPLOYMENT.md](DEPLOYMENT.md) |
| ≤8 ms maximum streaming | **Failed / open**; latest strict tour recorded **79.5 ms** install step and **80.1 ms** whole update |
| Radeon 840M-class 1080p60 | **Not validated**, no physical target GPU available |

The first six city cases precede the last diagnostics/facade-height-only correction; the later marker and retained gameplay cases exercise the resulting build. The 12-case foundation, 7-case gameplay and 2-case marker runs all precede the final minimum-capacity-only source edit; they were not rerun in full afterward. An anchor-readiness race was corrected after reviewing the earlier captures. The final strict WebGPU tour and final three-backend production/public checks were rerun after fixed instance capacities. Center-loaded/continuous-far flags alone are not accepted as proof of fully streamed detail. See C-011 in FINDINGS.

## Acceptance matrix

| Requirement | Actual evidence and boundary |
|---|---|
| Correct keyboard A/D | Unit dot-product checks at 16 camera headings; real browser held `KeyA`/`KeyD`, movement sign/position and unchanged yaw on WebGPU and WebGL 2. This is not a controller A/B fix |
| Beginning customization | Three lengths, controls, sensitivity, camera feel, graphics Auto/four tiers; saved preference and reload assertions. Explicit later user override to historical no-menu/full-default rules; DESIGN remains unchanged |
| Short and long routes retained | Ordinary-input real-KCC finishes: Quick **156.3 s**, Standard **331.25 s**, Full **682.433 s**, all zero-fall for seed 84173. Separate length best/ghost reloads |
| Earlier parkour still works | Every traversal/action, hazards, timer, powers, five-second fall penalty and lifecycle remain in real Rapier fixtures. Current full browser pilot renders finish/reward, saves, restores ghost/night and reloads |
| Camera collision / smoothing | Independent yaw, damped look/follow/look-ahead/interpolation; real sphere sweep with near-plane allowance; unit/browser wall clearance. No exhaustive human camera-pose or subjective animation review |
| Fixed 16 km² geography / worker chunks | Deterministic finite full-world/edge-chunk buffers; seam samples agree; complete far terrain/road/impostor representation. This proves data coverage, not absence of visual popping at speed |
| Connected district roads / lanes | **197 nodes / 353 edges / 944 directed lanes**; graph connected, lane endpoints/turn references/speed limits valid, all road classes present. Shortest connected-road waypoint routing tested |
| Opening street → beach | Real KCC pilot travels approximately 1.6 km without teleport/fall-through: 247.367 simulated seconds. Browser bridge crossing remains above the water and leaves the parkour timer unchanged |
| Six playable city starts | All six actual worker-generated spawns match their marker in both browsers. Six normal-input Quick KCC pilots finish with zero falls and marker-specific bests. Full long-course scenic integration at every marker/seed is still open |
| Flight → walking / cache persistence | Loaded collision ray probes resolve above/inside-roof positions; browser mode transition lands on solid geometry. Cache collection is one-shot and versioned storage/reset are checked; every hidden access path is not human-playtested |
| Distinct architecture / props / services | Seven district data palettes/heights/recipes, services/landmarks/features, actual inspected screenshots with balconies, roof props, signs, street objects, water and lighting. Final visual richness/distinctiveness is not accepted: distant blocks remain repetitive/sparse |
| Environment / weather / dusk | Deterministic recorded dates (clear 2026-11-20, fog 2026-11-22, browser rain 2026-11-24; overcast 2026-11-27 in pure tests), noon/night lighting, 1,440-active-real-second cycle. Water is analytical sky response/foam, not SSR/planar scene reflection |
| Fast full-map flight / dense-medium 60 FPS | **Open**. District/corner visits and far coverage are not a continuous-flight/performance proof. A partial real-input unpaused segment is recorded separately by the profiler |
| Main-thread stream ≤8 ms | **Not accepted**. P95 is not a substitute for the measured outlier maximum. See phase data and measurement definitions in FINDINGS |

## Reproduce

```bash
npm ci
npm test
npm run typecheck
npm run assets:check
npm run check:versions
npm run build
npx playwright install --with-deps chromium
xvfb-run -a npm run test:city
xvfb-run -a npm run test:parkour
xvfb-run -a npm run test:browser
xvfb-run -a npm run test:production
```

On a desktop omit `xvfb-run -a`. Development tests reuse port 5173; production tests start/stop their own preview on 4173. All passing reports use **zero retries**; raw logs/reports live under `docs/evidence/crosstown-0.5.0/`. The full route pilot accelerates normal 1/60-second KCC steps while suspending rendering **only inside the test helper**, restored in `finally`. It is not a rendered 11-minute real-time playtest or FPS benchmark.

### Render/stream timing

```bash
npm run dev
# Separate terminal; requires the server above:
npm run profile
```

`tools/profile-browser.mjs` uses 1280×800 / Balanced / forced-WebGL SwiftShader, warms actual frames, then records unpaused rAF cadence, startup readiness, phase/outlier state, sampled stack locations and a partial actual W+Shift fly segment. `PROFILE_URL` overrides the current server. Omit `--current-only` to compare a separately served old 0.3.0 build on port 4175 (`BASELINE_URL` override). No old built release is silently downloaded by the profiler.

`PERFORMANCE-COMPARISON-first-pass.json` preserves the rejected short-warmup experiment. The completed comparison is `PERFORMANCE-COMPARISON.json`; the preceding warmed variant is kept in `PERFORMANCE-COMPARISON-before-fixed-capacity.json`. Scenes differ because 0.5.0 adds the full city. The container has **2 CPUs / about 2 GiB RAM and software graphics**, not the target integrated GPU. Do not use a paused snapshot, an API's default 16.67 ms, a single screenshot, or accelerated simulation as a rendered FPS claim.

### Backends / pixels / test API

- **WebGPU:** headed Chromium under Xvfb, software Vulkan/SwiftShader; actual backend and geometry/model pixels required. A ready flag or a nonzero draw counter is insufficient. Forced GC must not erase the renderer.
- **WebGL 2 forced:** explicit `?webgl`, actual backend asserted.
- **Automatic fallback:** WebGPU browser feature disabled, default URL must render with WebGL 2.
- `window.__parkour` / `window.__city` exist only in development or with explicit `?test`; ordinary production has neither. They are acceptance instrumentation, not a replacement for real input tests.
- Synthetic gamepad/wheel tests validate mapping/plumbing only. No physical hardware/rumble or audible mix validation; mobile layout/touch look do not imply a complete touch movement controller.

## Evidence and remaining work

[SCREENSHOTS.md](SCREENSHOTS.md) indexes actual progress captures. [FINDINGS.md](FINDINGS.md) records bugs fixed, open issues, failed acceptance gates, measurement generations and untested features. [PROGRESS.md](PROGRESS.md) records the final build/deployment/archive state and file map. Historical 0.3.0 evidence is deliberately kept separate.
