# Crosstown · verification and reproduction

**22 November 2026 · source 0.9.0 / build 09.001 · Steps 01–09 prototype.** Exact deployment state is in [DEPLOYMENT](DEPLOYMENT.md). Machine-readable final results: [TEST-RESULTS](TEST-RESULTS.json). Historical [0.7 verification](TESTING-0.7.0.md) is retained separately; it is not substituted for new 0.9 tests.

## Current executed checks and revision boundary

- **Full units: 99/99**, zero failed/skipped, **46,786.160 ms**. All 75 earlier cases remain; additions cover fleet/geometry/audio/garages, population, severe-frame scaling, immediate mass/inertia, external ownership/disposal and a stationary chassis physically struck from rest.
- **Strict TypeScript: pass; 16/16 prepared models; 15/15 exact/date-qualified direct dependency pins; production build: pass, 7.80 s.** The 189-file public build is locally roundtrip-verified, independently transferred byte-for-byte and checksum-confirmed by the Vercel builder.
- **25/25 selected browser cases**, no failed/skipped/flaky, plus a separate real public-car smoke. These are the specifically listed suites, not a claim to have rerun every optional historical city/parkour test.
- **189/189 anonymous public-file SHA-256 matches**, repeated after both temporary transfer processes were stopped. The permanent renamed site runs independently of that transfer. READY/PROMOTED deployment: `dpl_CGHF6xxuyPmeXv6cZjVVi7Yq2Mmt`.

| Final suite | Result | Exact scope |
|:--|:--|:--|
| Fleet, WebGPU + WebGL2 | **6/6 · 6.2 min** | All twelve models/profiles/class cabins; six-car reload/paint/physical wreck/recovery; physical finish/reward and unique live VIN |
| Retained vehicles, both renderers | **4/4 · 7.5 min** | Real entry/ignition/keyboard/manual modes; six cabin studies/audio/fallback/mirrors/buses/lifecycle |
| Selected city regressions, both renderers | **4/4 · 3.3 min** | Choices, A/D/yaw/save; six worker marker starts, cache/reset, fly-to-walk landing |
| Local built output, three renderer paths | **6/6 · 2.4 min** | Actual foundation/parkour pixels, glTF/worker startup, GC/mobile resize and disabled-WebGPU fallback |
| Actual public output | **5/5 · 3.3 min** | All three parkour renderer paths; physical full finish/celebration/save/ghost/night and training |
| Separate public car smoke | **Pass, errors `[]`** | Actual drive, sample decoding, real mirror pixels/geometry and E-key exit on public WebGPU |

The full local functional batch has identical before/after runtime SHA-256 **`6269b28082f916fe1a076b75e54115ccdf1b4d90da26658eb6f5b70bc9851910`**. `final-functional-batch.json` indexes actual report start/duration boundaries, including the correctly collected `.arena/fleet-results.json`. Final handoff generation refuses any runtime drift. This is not a fabricated Git commit or proof every hardware/human gate passed.

Pre-route-fix evidence stays separate: the earlier 99-unit/6-fleet pass was followed by **3 failed / 1 passed** retained vehicle cases. CDP isolated a null cached finish-billboard texture binding; an owned direct TSL texture node fixes recompilation, and lab completion now preserves Escape during loading. All final suites above follow both corrections. Population timed/reaction reports precede only those two rendering/lab-pause edits; `route-recompile-change-boundary.json` verifies NPC/vehicle/physics modules remain byte-identical. They are not relabeled as fresh final-revision performance acceptance.

Current raw evidence lives in `evidence/crosstown-0.9.0/`. Historical failed/debug/interrupted attempts stay labeled as such. Original DESIGN remains SHA-256 `0f670679a820a3b687f6fb4fae6e0a14afebfc215b791b6918792ee322699dc9`.

## Fleet acceptance actually exercised

- Twelve separately selected real GLB outputs, twelve eight-loop recording profiles, six matching class cabins, four physical wheel rays per car / two per bike and actual ground contacts. Model selection and sound-profile identity are asserted, not just presence of twelve menu labels.
- Every car drives the same 44-segment installed Rapier loop using ordinary throttle/brake/steering, no helper impulses or resets, ≥850 m, maximum center error <0.74 m, zero damage. Three-second speeds **10.57–24.66 m/s**, brake distances from 13 m/s **3.47–6.61 m**; bike lean **0.44–0.46 rad**. These are not human handling-feel judgments.
- Six real E-key parked-car takeovers, traffic-proxy retirement, six stored VINs across a browser reload, retrieval and real paint-panel input. Actual repeated wall impacts reach dented/broken-glass/smoking/burning; fire becomes wreck after seven simulated seconds, and the real recovery button repairs the same owned/painted VIN.
- Ordinary-input physical parkour finish grants one reward in garage and street below billboard; entering/storing/retrieving/reloading keeps one live reward VIN and one reward record. Test does not call a synthetic unlock/finish setter.
- Runtime mass fix recomputes mass/inertia before the first wheel update without an extra shared world step. All twelve contact-ready new chassis remain finite. The old recursive-use WASM errors were secondary to injected NaNs, not evidence of concurrent world steps.
- Stationary struck-car damage is measured in a true two-body contact fixture and a loaded-city physical player/NPC collision. Neither injects damage or a crashed flag.

## Traffic/pedestrian evidence: time domains are separate

| Run | Actual result | Evidence |
|:--|:--|:--|
| Pure planner | 240 simulated seconds, 14,400 ticks; sampled overlaps/red entries/illegal crossings **0**; raw maximum stationary **118.65 s** | `traffic-pure-240s.json`; no Rapier or rendering |
| Loaded real shared world | 120 simulated seconds, 7,200 ticks in **20.281 wall seconds**; forced 60/120; maximum **12** full proxies; independent sampled overlap/red/crossing/nonfinite **0**; 67 agents observed ≥30 s, starvation `[]`; raw wait **78.183 s** | `population-loaded-final-120s.json` + compressed raw state |
| Actual fixed Balanced parked/occupied car | **120.228 wall seconds**, **1.859 FPS** over 216 rAF intervals / 116.162 s; observation advances **20.883 simulated seconds**; sampled constraints **0**, duration-qualified agents **0** | `population-parked-wall-120s.json`; density locked deliberately |
| Separate actual Auto parked/occupied car | **120.116 wall seconds**, **2.461 FPS** over 291 intervals / 118.229 s; **27.333 simulated seconds**; actual Auto→Low, factor **0.25**, six changes, targets **8 cars / 16 people**; duration-qualified agents **0** | `population-auto-wall-120s.json`; adaptation not locked |
| Actual crash / siren / night / future fear API | **80** chassis contact samples; player/NPC max impulse **14.913 / 8.835 m/s**, damage **0.2163 / 0.1183**; braking, **1** evasive lane change, **12** pull-overs; sampled 85 people→58 at night, all moving headlights on; errors `[]` | `population-reactions.json`; no weapons or injected damage |

Independent SAT uses explicit world-space rectangle corners with 0.025 m inset and a six-tick sampling cadence; it is not the game's overlap helper, nor exhaustive swept-contact auditing. New intersection entries are checked per tick; existing transitions at observation start are not falsely counted as new red entries. Pedestrian crossing samples use the same documented legal phase boundary independently.

Age qualification uses each agent's **actual observed duration**, not elapsed time after a birth or retirement. In both real-wall-time watches, not enough simulation advances for any ≥30-s cohort; an empty starvation list there is **not no-stuck proof**. Long raw stop/queue waits remain visible even when `maxUnexplainedStop` is small. Strict fairness/no-stuck acceptance is **OPEN**.

## Rendering, performance and source boundaries

- WebGPU uses headed Chromium under Xvfb with software Vulkan/SwiftShader. Forced WebGL 2 and WebGPU-disabled automatic fallback are separate paths. Functional pixel tests are not native GPU timing.
- The actual two-minute observations above are real unpaused display intervals in an occupied parked street car. They are **not accelerated simulation**. Their very low software FPS also means simulation is far behind wall time.
- Frame-cost diagnostics fix 1280×800, Balanced, Quick seed 84173, clear date 2026-11-20, hour 15 and **population off**. The final fresh-Chromium-per-scene run **completed, exit 0, errors `[]` in every scene**: roof **1.121 FPS** (15 intervals / 13.383 s), downtown **1.085 FPS** (14 / 12.900 s), cockpit lab **1.823 FPS** (22 / 12.066 s). Three compressed CPU profiles and exact snapshots are indexed by `profile-0.9-final.json`. The lab opening is explicitly awaited. Software remains extremely slow even with population off; program/uniform query waiting remains visible and is not a proven sole root cause.
- A prior shared-browser final attempt measured only the roof (**0.921 FPS**) and then timed out at the second page's hooks after 180 s; its log/partial JSON remain `profile-0.9-final-shared-browser*`. Fresh browser isolation changes process lifetime relative to historical profiles, so **no strict matched A/B ratio or speedup is claimed**. Completed and failed attempts remain separate.
- Historical 0.5 streaming maxima—79.5 ms install / 79.7 ms chunk CPU / 80.1 ms whole update—still fail the ≤8 ms gate. No new full-map continuous no-stall/no-popping or native 1080p60 acceptance is claimed.
- `window.__parkour`, `window.__city`, `window.__vehicles`, `window.__population` exist only in development or explicit `?test`. Hooks accelerate real physics fixtures; actual E/keyboard/mouse/UI/pixel checks accompany them. No normal production gunfire control exists.
- Source/public runtime fingerprints bracket the final test batch and final handoff. Documentation/release tools can change afterward without changing the tested app; verification-source fingerprints record their final bytes separately. No hosted GitHub CI run is claimed.

## Retained vehicle checks

The earlier suite is rerun separately rather than replaced by new roster tests: real entry/door/ordered cold start, keyboard pedals/steering/handbrake and four views; manual stall/shutdown/neutral restart; six cabin gauges/hands/rack; virtual Gamepad API/wheel/rumble and mouse steering; real-recording RPM sweeps and missing-file synth fallback/recovery; saved volume sliders/actual gains and 16-engine/16-one-shot budgets.

The missing-file case **temporarily withholds one local WAV** and restores it byte-for-byte in `finally`. It is not deletion on Vercel. Mirror orientation is checked on the actual screen material, with upper/lower color fixtures, not just raw target memory; final captures remove fixtures/overlays. **Do not run concurrent vehicle suites against one checkout.**

## Reproduce

```bash
npm ci
npm test
npm run typecheck
npm run assets:check
npm run check:versions
npm run build
npx playwright install --with-deps chromium
xvfb-run -a npm run test:fleet
xvfb-run -a npm run test:vehicles
xvfb-run -a npm run test:city -- --grep 'opening choices|six worker-generated marker'
xvfb-run -a npm run test:production
npm run accept:roster
npm run accept:traffic
# A Vite server must be running for these standalone loaded-city probes:
npm run accept:population
WATCH=1 POP_LABEL=parked-wall-120s npm run accept:population
WATCH=1 ADAPT=1 POP_LABEL=auto-wall-120s npm run accept:population
node tools/accept-population-reactions.mjs
# Controlled, separately run software profile; do not run another browser workload:
BENCH_LABEL=0.9-final node tools/profile-frame-cost.mjs
# Read-only checks on the actual renamed public site:
npm run verify:deployed
xvfb-run -a npm run test:deployed
xvfb-run -a node tools/smoke-public-car.mjs
```

Omit Xvfb on a desktop. Public checks default to **https://crosstown-sarang-dev.vercel.app**; `DEPLOYMENT_URL` overrides with a credential-free public HTTPS host. No login/protection bypass is attempted. Full optional city/parkour/foundation suites remain available; a subset pass is never advertised as a new exhaustive full-city tour.

Prepared assets are bundled. Optional offline audio production uses Python `numpy`, `scipy`, `soundfile`; model preparation uses the included pinned tooling. Play/build needs no Python or protected downloads. [Asset pipeline](ASSET_PIPELINE.md) · [Fleet](FLEET.md) · [Population](POPULATION.md)

Large raw JSON/logs, including current browser/CPU reports, are losslessly archived as `.json.gz` / `.log.gz`; [EVIDENCE-COMPRESSION](EVIDENCE-COMPRESSION.json) audits **22** exact original-byte/hash restorations (`gzip -dc report.json.gz`). Plain code-form report names above may name their original decompressed paths; TEST-RESULTS links the actual stored files. Current population summaries link compressed raw states. Original capture pixels and fixed-name historical release ZIPs are retained; compression is not a new test run. The portable source ZIP contains all current 0.9 raw evidence, but does not duplicate old 0.5/0.7 raw trees that remain in the workspace; [archive scope](SOURCE-ARCHIVE.md).

## Unaccepted/human gates

**Reported lag is not considered solved. Native near60 FPS in busy Balanced / with ten near cars / Radeon840M 1080p60; strict no-stuck/fairness; physical gamepad/wheel/rumble; hands-on handling; by-ear realistic/distinct/click-free sound; pedestrian seating/social alignment and long GPU-memory soaks remain open.** Six field recordings are processed into twelve designed profiles; V10/twin and Chat/Flee are clearly documented derivatives. Art remains low-poly/prototype-level. Police, weapons and deep radio are future scope. [Finding ledger](FINDINGS.md)
