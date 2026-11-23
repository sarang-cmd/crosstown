# Steps 01–03 verification

Tested **2026-11-22**. Current machine-readable results: [TEST-RESULTS.json](TEST-RESULTS.json); raw passing logs and inspected screenshots: [evidence/](evidence/). The original Step 01 report remains at [evidence/foundation-01-results.json](evidence/foundation-01-results.json).

## Results

| Check | Final observed result |
|---|---|
| `npm test` | **40 passed**, 0 failed: 20 retained foundation tests + 20 parkour tests |
| `npm run typecheck` / `npm run build` | Passed; production game/foundation/renderer/physics chunks and both workers emitted |
| `npm run assets:check` | **3/3 GLBs passed**, including measured/hash-checked 27-clip parkour runner |
| `npm run check:versions` | All 15 direct dependencies exactly pinned and published before the 2026-11-08 cutoff |
| Retained foundation development browser suite | **12 passed**, 0 failed/skipped/flaky; WebGPU, forced WebGL 2, WebGPU disabled |
| Gameplay development browser suite | **7 passed**, 0 failed/skipped/flaky; two cases × three backends, plus full-run browser pilot |
| Production-output browser suite | **6 passed**, 0 failed/skipped/flaky; foundation and gameplay smoke cases × three backends |
| Real public Vercel browser suite | **5 passed**, 0 failed/skipped/flaky; three-backend boot/pixels, full pilot/save/ghost/night, eight-checkpoint training |
| Seed simulation | **24/24 complete normal-speed safe-path KCC pilots**, no falls; all ballistic checks valid |
| Anonymous deployed file integrity | **21/21 HTTP 200**, every SHA-256 matches the locally verified production output |
| Reference design | `cmp uploads/00-DESIGN.md docs/DESIGN.md`: byte-identical |

The development suites preceded the final visual/street-detail and wind-budget changes. The final real-Rapier unit/simulation runs and local production/public-site suites cover the updated build. No target-hardware FPS pass is implied by these functional results.

## Acceptance matrix

| Requested item | Evidence / boundary |
|---|---|
| First frame already running, no start gate | All three-backend boot tests assert `motion=run`, nonzero velocity, model/worker ready, closed pause/result overlays and actual runner/roof pixels; public production screenshots inspected |
| Short Step 02 course | Eight fixed checkpoints independent of the layout seed; full ordinary-input unit pilot completes without a fall; public browser boot/pixels/screenshot checks |
| Every movement action | Real Rapier capsule fixtures for run/sprint, jump, power-gated double jump, coyote/buffer, slide/headroom, ledge grab/pull-up, vault, wall run/jump, zipline/swing, land/high-fall roll; GLB clip names checked in-browser |
| Camera does not clip | Rapier sphere sweep includes near-plane allowance; unit test verifies no final intersection after smoothing; browser test positions the camera at an architectural wall and checks the limit. Not an exhaustive proof of every camera/level pose |
| Seeded winding route, branches, jump possibility | Determinism, 28 checkpoints, all 17 families, many turns and rejoining branches checked across 24 seeds; impossible gap/height rejected; movement-derived safe envelope includes crosswind drift |
| 8–12 minute full run | **24 complete pilots at 6.5 m/s, 1/60 s physics**, 665.75–682.433 seconds; no teleport/checkpoint shortcuts. Public browser pilot: 682.483 ordinary-speed simulated seconds, 0 falls, rank A |
| Hazards | Real moving/tilting/crane colliders change pose; moving platform carries rider; crumble delays, falls and recovers without launch; rolling/laser/drone fixtures apply non-lethal knockback; gust fixture pushes laterally |
| Powers/collectibles | Capsule-contact pickup tests activate all four powers, expire after ten real simulation seconds, increase actual speed/slow world only, magnet-attract coins, and add 20 seconds for time pickup |
| Fall, timeout, reset | Exactly five-second fall penalty and last-checkpoint respawn; timeout resets same seed, clears powers; reset/new-seed bindings tested in all three browsers |
| Finish/reward | Real browser full pilot reaches final checkpoint, displays rank A/time/falls/collected panel, advances the finish flight/fireworks, and unlocks the rendered sedan/night route; final finish screenshot inspected |
| Save, next-run ghost, harder night | Actual browser `localStorage` contains result and >4,800 ghost frames; R reveals ghost, L switches night, reload preserves unlocks/ghost; per-seed/per-marker and storage-blocked fallback tested |
| Near 60 FPS | **Not accepted on target hardware**: no Radeon 840M-class physical GPU is available. Software-rendered screenshots retain actual ~1–3 FPS; no fake timing |

## Test implementation

### Unit: 40 tests

`tests/unit/parkour.test.ts` adds **20** acceptance tests using real Rapier WASM and the shipped generator, physics, movement, run and storage modules. These are not mocked movement states. They include full ordinary-input long/training pilots and regression checks for elevated ramp lips, moving-platform carry, prop-blocked navigation and crumble-reset impulses.

The original **20** tests remain: fixed-step/interpolation/hidden-tab math, a falling/resting rigid body and KCC setup, quality measurement/hysteresis, input axes/dead zones/wheel mapping, exception-safe settings saves, and asset normalization math.

### Browser backends

1. **WebGPU**: headed Chromium under Xvfb, Vulkan/SwiftShader. Backend must actually be `WebGPU`; silently falling back fails.
2. **Forced WebGL 2**: `?webgl`; backend must be `WebGL 2`.
3. **WebGPU disabled**: browser feature disabled, normal URL; automatic WebGL 2 fallback must render.

Tests require colored pixels from actual geometry, not just a ready flag or draw count. WebGPU remains visible after forced garbage collection. Gameplay checks include real amber skinned-model pixels, roofs, 27 clip names, worker generation, 390 × 844 and 1920 × 1080 layout, input wiring, slide/jump, swept camera, pause, rebinding, synthetic gamepad, penalty/timeout and new-seed rebuild. Foundation tests retain cube physics/pixels, full input/settings, synthetic wheel and precise browser GLB bounds/skins/animation measurements. Page/console errors are asserted absent in the boot/full-run cases.

The full public browser pilot also activates the AudioContext with a genuine key gesture, completes every ordinary-speed KCC step, checks the actual browser save, captures results/flight, resets into the ghost, unlocks night, reloads and verifies persistence. Rendering is suspended **only during the accelerated acceptance pilot**, restored in `finally`; gameplay rendering is normal otherwise. This keeps CI quick but is not rendered frame-rate evidence.

### Seed simulation

`npm run simulate:parkour` executes `tools/simulate-parkour.ts --all-runs`, checks 24 layouts against ballistic settings and runs all 24 through the actual capsule/KCC at 60 Hz. The command exits nonzero if **any** pilot is unfinished. [PARKOUR-SIMULATION.json](PARKOUR-SIMULATION.json) contains primary and 23 additional full runs, not just theoretical distance checks.

All full pilots choose the **safe branch**. Risky branches have mathematical checks and isolated physics fixtures; their complete combinations and subjective feel have not been exhaustively played by a human. Moving/tilting obstacle timing is dynamic, so a feasible gap is not a guarantee that every approach timing succeeds.

### Deployed integrity

Production: **https://coastline-highline.vercel.app**. Vercel deployment `dpl_AN77CJEBLkcpMBdFDmVyJ2Xgq1c9` reached `READY` and `aliasAssigned=true`. The public primary alias serves the game anonymously, unlike the protected preview aliases. [DEPLOYED-FILES.json](DEPLOYED-FILES.json) records matching hashes/status/type/size for all 21 production files, including models, workers and fonts. Transfer services were stopped after deployment; the game runs entirely from Vercel's stored static output.

## Reproduce

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run assets:check
npm run check:versions
npx playwright install --with-deps chromium
xvfb-run -a npm run test:browser
xvfb-run -a npm run test:parkour
xvfb-run -a npm run test:production
xvfb-run -a npm run test:deployed
npm run simulate:parkour
npm run verify:deployed
```

On a desktop omit `xvfb-run`. The local production suite owns port 4173; build first. The development suites can reuse port 5173. The deployed suite starts no local server and defaults to the public Vercel URL; set `DEPLOYMENT_URL` to test another **public** deployment. `verify:deployed` expects the local `dist` to match that site's exact release.

## Environment, failures fixed and remaining review

- Node.js **20.20.2**, Playwright **1.56.1** / Chromium **141**, Linux, software graphics. Most browser assertions use 1280 × 800 at Low quality to keep software CI tractable; mobile and 1080p resize cases are explicit. The inspected screenshots are in `docs/evidence/production-public-*`.
- **No Radeon 840M, physical gamepad, USB wheel or rumble hardware test.** Synthetic controller/wheel tests verify input plumbing, not real driver compatibility. No claim of target-hardware 60 FPS, streaming budget on every device, or all-quality-tier performance.
- Runtime streaming and first construction are measured separately. The primary seed's current report records both; initial construction can exceed the **8 ms in-run streaming** budget. No claim that every operation stays below 8 ms on the target laptop.
- AudioContext activation is tested; there has been no hands-on audible mixing/quality review. Embedded clips are verified and the running model is visibly animated; every animation transition and fallback appearance still needs subjective review.
- Mobile is responsive and touch-look works. There is no complete touch-only movement controller in this scope.
- Fixed implementation bugs encountered: elevated safe ramps meeting a facade lip; recovered crumbling ledge imparting a huge carry impulse; a moved water-tower collider blocking seed 84173 at checkpoint 21. Full pilots pass after correcting geometry/placement and clearing platform carry on reset.
- One new training smoke assertion initially read pause state before the next software-rendered input frame. Replaced the immediate read with `expect.poll`; the final clean five-test public suite passes with retries disabled.
- Headless Linux WebGPU initially yielded a blank composited image despite a ready API. Those runs were rejected; headed compositing plus pixel assertions is used. Device-loss fallback remains active.
- Rapier emits one upstream WASM-init deprecation warning; it is not suppressed and is not an app error.
- The rest of `DESIGN.md`—full city, vehicle gameplay/fleet/audio, crowds, police, weapons, radio and heavy post-processing—is deliberately outside Steps 02/03, not implicitly tested.
