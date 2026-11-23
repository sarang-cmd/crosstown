# Crosstown · verification of 0.13.0 / 13.001

**22 November 2026 · Steps 01–13 prototype.** This page distinguishes implemented scope, actual browser/physics checks, external-provider availability and unaccepted native/human gates. The original DESIGN is byte-identical. Older outcomes remain in [TESTING-0.9.0.md](TESTING-0.9.0.md) and the separately named historical summaries; they are not newly rerun whole-city acceptance.

## Current evidence

[TEST-RESULTS.json](TEST-RESULTS.json) is the machine-readable release summary; [EVIDENCE-MANIFEST.json](EVIDENCE-MANIFEST.json) hashes runtime, verification source and artifacts. Raw current reports/logs are under `evidence/crosstown-0.13.0/`. Large completed reports/logs are stored losslessly as `.gz`, with exact original/restored SHA-256 values in [EVIDENCE-COMPRESSION.json](EVIDENCE-COMPRESSION.json); names in historical command logs remain the original output names. The final browser batch is **sequential**, one writer per report, with command, collector hash, start/end, timeout and exit code in `final-functional-batch.json`. A failed provider stays failed-or-unavailable; a completed collector is not automatically acceptance of its measured performance.

Runtime fingerprint: **`fb09baa8b193d2229a3b8665835b38c3e9c261ba0bf7da3c5a0a2e67e824ba66`**. `tested-runtime-before.json` and `tested-runtime-after.json` bracket the final browser batch. The packager checks this runtime against the release manifest, not an invented Git commit.

| Executed check | Final observed result |
|:--|:--|
| Full units / real physics | **125 passed, 0 failed/skipped**, 74,346.708 ms |
| Strict types / decoded GLB audits / exact dependency pins | **Pass / 22 of 22 / 15 of 15** |
| Production build | **Pass, 7.83 s**, 204 public files |
| Clean extracted source ZIP | `npm ci`, build (**6.22 s**), 22 models/15 pins pass; **204/204 output bytes match published build** |
| Built city-life browser phases | **11/11 WebGL 2 + 11/11 WebGPU**, zero runtime errors |
| Physical activities / collision failure / records reload | **6/6 + pass + pass**, real ordinary-input chassis fixtures |
| Landing | **4 widths pass**, no engine/canvas/overflow |
| Actual radio providers | **5 passing core rows / 2 failed-or-unavailable**; no Spotify authentication |
| Populated actual-display software observations | Three stars **2.053 FPS**; five rivals **1.438 FPS**; errors `[]`, **not near60/native acceptance** |
| Anonymous public deployment/browser verification | **204/204 file hashes**, before/after transfer shutdown; actual landing → normal `/play` workflow passes. [Details](DEPLOYMENT.md) |

## What the functional integration actually does

`tools/accept-city-life.mjs` uses the built preview on port 4193, **Low / population OFF / software rendering**, on forced WebGL 2 and WebGPU under Xvfb. Eleven phases per backend cover:

1. Immediate `/play`, correct renderer, six real weapon GLBs and no Spotify source/SDK without a client ID.
2. All seven range weapons damage actual colliders via real melee/rays/pellets/projectiles; practice loans do not grant ownership.
3. Actual gun/ammo shop clicks charge $250/$35, a finite twelve-round magazine empties and reload consumes reserve.
4. Debug levels one through five install the bounded physical ground units; helicopter appears at three.
5. A star remains after 1,100 unseen fixed ticks and falls after another 130. This is **20+ simulated seconds**, not a human wall-time garage escape.
6. A waypoint produces a connected road route. A full manual map-click-and-follow drive is not established merely by that graph check.
7. Car-window fire; four procedural stations, HUD/dash state, favourite and silence on exit.
8. Actual paint/garage UI costs $75 per paint session and $50 storage, preserves one VIN/paint and reloads the bank/slot.
9. Real garage rear-wall/roof sight rays are blocked; its open doorway is not.
10. Nearest-hospital respawn, up-to-$100 fee, half ammunition loss, reload persistence of bank/ammo/radio.
11. Two distinct rooftop markers start/finish seeded physical pilots in the same city and keep marker-specific bests.

Debug placement, seeded saves, debug wanted levels and accelerated fixed steps are explicit fixtures. They are not ordinary-player handling, 30 real seconds of escape, physical inputs, human listening or FPS acceptance. The broader requested garage escape and manual waypoint-following session still need hands-on review.

## Actual loaded-city activity results

`tools/accept-activities.mjs` uses the same shared Rapier world and normal chassis steering/pedals. It places the car **between attempts only**. The route pilot follows real gates; the drift pilot countersteers from measured slip; the stunt car drives over visible physical ramps. No impulse, score/time edit, teleport or reward injection occurs within a run.

| Activity | Result from the physical fixture | Reward |
|:--|:--|--:|
| Old Town Clock / trial | 45 route points, **57.05 simulated s** | $350 |
| Special Delivery | 45 route points, **53.40 simulated s**, within new-damage limit | $450 |
| Coastline Camera | **75.31 km/h** at the final camera, target 55 | $250 |
| Harbor Sprint / race | **57.10 simulated s**, five actual RaycastCar rivals | $500 |
| County Line Slide / drift | **142.13 points / 140**, 35.02 simulated s | $400 |
| Air Mail / stunt | **Two qualifying landed jumps**, 11.95 simulated s | $550 |

The collector also accelerates normally into a solid garage rear wall: damage reaches **0.3215**, delivery fails visibly with “cargo damage limit exceeded,” and bank/bests do not change. It then reloads and compares all six records and the bank. The six rewards total **$2,500**. Best-three ranking/payment-once/corrupt-storage rules have separate unit coverage.

These are automated, accelerated physical attempts with debug setup, **not human or race-frame-rate acceptance**. The drift result has a narrow scoring margin; human difficulty/tuning review remains useful.

## Radio: actual providers, no mocks

`tools/accept-radio-providers.mjs` serves the actual radio/audio modules through Vite inside an HTTPS browser fixture and contacts real external providers. An ordinary click unlocks audio. The core rows exercise: hidden/no-SDK Spotify without ID; all four procedural stations, fades/static/volume and siren/start ducking; actual DE Radio Browser catalogue and HTTPS stream media progression; a second station/static; saved links/favourites and exit stop.

Official YouTube/SoundCloud rows require **observed PLAY**, then an observed playing **title change** after Next. A selected source, ready API or successful method return is insufficient. The UI likewise does not claim ON AIR just because an official API `play()` method returned. The last row verifies that a still-unobserved official player does not claim playback. See the latest per-row status, failure text, hidden sources and screenshots in `radio-provider-acceptance.json`.

**Authenticated Spotify is untested: no client ID/account/Premium session was supplied.** Current API/allowlist/terms approval and permitted synchronization with game visuals remain separate gates. See [RADIO.md](RADIO.md). Browser media progression and scheduling do not prove a human heard an appropriate, click-free mix.

## Landing and performance boundaries

The production landing is checked at **320 / 390 / 768 / 1440 px**: no horizontal overflow, canvas, Three/Rapier/GLB/WASM downloads before Play. Reported resource transfer is about **281,417 B mobile / 342,833 B wider layouts** in the measured run; these include protocol overhead, not a bundled engine download. The assistant inspected the saved 390/1440 full-page images; this is not a physical-device usability study. The hero is labelled concept art; the smaller images are actual captures.

Stable instanced attributes avoid resize churn; water drops from **18,432 to 3,360 triangles**. Two numerical water regressions pass. Earlier matched stationary population-OFF software A/B observations show modest gains (WebGL rooftop 1.217→1.336 FPS, coast 2.446→2.683; WebGPU rooftop 1.105→1.143, coast 2.300→2.495). Whole-scene WebGPU draw differences limit attribution. Those earlier revisions are identified separately; they are not final populated/native benchmarks.

`populated-performance-webgl.json` separately records **actual display intervals**, fixed Balanced and a requested locked stress fixture of 60 cars/120 people, with three stars or five physical rivals. After setup there are **zero manual simulation steps during measurement**. It records actual counts and simulation state before/after. **Fixture limit:** the three-star/heli endpoints have **zero physics-enabled ground police**, so this is not a qualified active ground-pursuit load. The race has five active ordinary-physics rivals. Software results cannot satisfy the native near-60 target. No fake FPS counter or shortened course is used.

**Reported lag is NOT considered solved.** Native near60 with a three-star pursuit/five rivals/ten near cars, strict no-stuck fairness, continuous-map stall-free/no-popping, long GPU-memory soaks, human handling/listening and physical input remain open. See [FINDINGS.md](FINDINGS.md).

## Reproduce the current checks

```bash
npm ci
npm test
npm run typecheck
npm run assets:check
npm run check:versions
npm run build
npm run preview -- --port 4193 --strictPort
# Keep that preview running in another terminal:
node tools/fingerprint-runtime.mjs docs/evidence/crosstown-0.13.0/tested-runtime-before.json
npm run accept:activities
npm run accept:life
xvfb-run -a env BACKEND=webgpu npm run accept:life
npm run accept:landing
node tools/accept-populated-life-performance.mjs
# Actual radio fixture also needs Vite on 5173:
npm run dev
npm run accept:radio
# Or, with both servers already running, collect browser checks sequentially:
node tools/check-release-functional.mjs
node tools/check-handoff.mjs
node tools/release-evidence.mjs
npm run package
```

Omit Xvfb on a desktop with a display. Never run multiple writers of the same evidence report. Retained full vehicle suites temporarily withhold/restore one WAV; do not overlap those suites in one checkout. `npm run verify:deployed` is read-only and compares every built public file anonymously; only run it against the intended published revision. `node tools/smoke-public-life.mjs` separately follows the actual public landing's normal `/play` link without debug hooks.

## Failed/interrupted attempts are preserved

The current evidence folder retains separately named first/second/third/fourth activity attempts, constant/feedback control probes, earlier provider attempts, the concurrent/stale integration writer conflict and startup interruption, the first WebGPU collector's residual weapon-cooldown failure, and pre-final official-player-state checks. The cooldown failure was in a test sequence firing immediately after a long-interval rocket, not proof of a missing purchased pistol; the collector now advances normal cooldown time. The delivery-HUD timeout occurred while the collector had deliberately disabled rendering; the final collector restores rendering before checking visible failure text. The first populated collector also queried the helicopter before a normal update; the same-runtime retry waits for actual helicopter/rival state and retains the prior failed attempt and five earlier collector hashes. None is silently counted as a pass.

Historical 0.9 browser/fleet/traffic/public observations are preserved, not relabelled as freshly rerun full 0.13 coverage. Large current/historical JSON/logs listed in [EVIDENCE-COMPRESSION.json](EVIDENCE-COMPRESSION.json) restore exactly with `gzip -dc`. All original PNG pixels stay intact; new WebP captures are presentation derivatives. The portable ZIP's deliberate historical raw-report exclusions are documented in [SOURCE-ARCHIVE.md](SOURCE-ARCHIVE.md).
