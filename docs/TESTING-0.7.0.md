# Crosstown · verification and reproduction

**22 November 2026 · source/public 0.7.0 / build 07.001 · Steps 01–07 prototype.** This document separates executed checks from human/hardware acceptance. Machine-readable results: [TEST-RESULTS.json](TEST-RESULTS.json). Historical 0.5 reports remain under `*-0.5.0.*` and `evidence/crosstown-0.5.0/`; their results are not new 0.7 runs.

## Final executed checks

| Check | Actual outcome | Evidence relative to `docs/` |
|---|---|---|
| Full unit/real-Rapier suite | **75/75**, 34,731.101 ms | `evidence/crosstown-0.7.0/unit.log` |
| Strict TypeScript | Pass | `evidence/crosstown-0.7.0/typecheck.log`; build also typechecks |
| Prepared models | **3/3** decoded/hash/bounds/animation audits | `evidence/crosstown-0.7.0/assets.log` |
| Direct dependency date/pins | **15/15**, publication cutoff 2026-11-08 | `evidence/crosstown-0.7.0/versions.log` |
| Final production build | Pass, **9.24 s**, 77 public files | `evidence/crosstown-0.7.0/build.log`, `PUBLIC-BUILD.json` |
| Vehicle development browser | **4/4**, 665,066.990 ms; WebGPU + forced WebGL 2 | `evidence/crosstown-0.7.0/vehicles-browser{.log,-report.json}` |
| City regression subset | **4/4**, 405,843.065 ms; both backends | `evidence/crosstown-0.7.0/city-regression{.log,-report.json}` |
| Local built-output smoke | **6/6**, WebGPU / forced WebGL 2 / WebGPU disabled | `evidence/crosstown-0.7.0/production-browser{.log,-report.json}` |
| Actual public-site regression | **5/5**, all three paths + full physical finish/save/ghost/night + training | `evidence/crosstown-0.7.0/deployed-browser{.log,-report.json}` |
| Actual public sedan smoke | Pass; 7.113 m/s real motion, samples, live mirrors and E-key exit; errors `[]` | `evidence/crosstown-0.7.0/public-car-smoke.json` |
| Anonymous deployed integrity | **77/77** SHA-256 matches; repeated after transfer shutdown | `DEPLOYED-FILES.json`, `evidence/crosstown-0.7.0/post-transfer-integrity.log` |
| Original DESIGN reference | SHA-256 unchanged: `0f670679a820a3b687f6fb4fae6e0a14afebfc215b791b6918792ee322699dc9` | Evidence generator checks bytes |

**Revision boundary:** the full units, vehicle and city subset run after the mirror/material/reward-arrow fixes. The only subsequent public runtime-file edit was correcting stale `public/release.json` from 0.5 to 0.7 metadata. The final build, local production tests, public tests and 77-file comparison include that edit; gameplay code is unchanged. Documentation/publisher/gallery/packager changes do not alter the tested game. Runtime source is fingerprinted at handoff, not falsely presented as an independently captured per-run Git commit.

## What the 06–07 checks actually cover

### Physics and earlier features

- Original 53 foundation/parkour/city/session unit cases retained; 22 vehicle cases added across `vehicles.test.ts` (7), `vehicle-systems.test.ts` (13), `vehicle-ownership.test.ts` (2).
- Ordinary digital-keyboard-style and analog-gamepad-style **inputs into the shipped raycast physics**, no helper impulses or respawns: 44/44 loop segments, approximately 1,043 / 984 m travelled, <1 m maximum center error, zero damage. These headless pilots are not hands-on driving-feel acceptance.
- Suspension, gravity equivalence within the existing −24 character world, acceleration/braking/gear logic, reverse-to-forward, steering rack, handbrake rear-grip change, physical ramp flight/landing/wall impact, flips/upright recovery, blocked-door probes, immediate teleport telemetry and one shared Rapier step per tick.
- Physical placement against actual streamed city/course colliders at the opening and six relocated starts. Small physical forecourts are used where the reserved central course has no through-road edges.
- Independent glTF material/texture ownership and idempotent cleanup; one car's disposal cannot dispose source/other-car assets. Rooftop disposal stays within its owned root/caches. Reward arrow x/z follows the relocated parking position.
- Latest city browser subset: opening choices, actual keyboard A/D, stable camera yaw, saved length; six worker starts, hidden-cache saves/reset and fly-to-walk landing on both backends. **No new full seven-district visual/performance tour is claimed.**

### Actual vehicle browser input and pixels

- Real E-key street entry/carjack and exit; actual glTF door visibly opens. Ordered cold sequence, keyboard pedals/steering/handbrake/lights and all four cameras.
- Real-key manual toggle/shutdown/in-gear start→stall/neutral restart. Normal parkour physical pilot finishes, unlocks and enters the actual reward car; route restart/re-entry remains functional with 2 city cars, 2 forecourts and 1 cached cabin.
- All six actual cabin geometries; two hands, three gauges, matching physical readings/rack and truthful screen gear/manual shifter. Virtual standard gamepad and USB-wheel Gamepad API input, mouse steering and virtual landing rumble. **No physical devices were used.**
- Three real-recording engine RPM sweeps; eight layers, bounded pitch, continuous numerical weights and nonzero output RMS. Each of all 48 PCM16 files is hash-checked, unclipped and has ≤1-LSB endpoint discontinuity.
- Missing-sample test **physically moves** `public/audio/cars/harbor/high-on.wav` out of the served folder and deliberately returns HTTP 404. Synthesis/nonzero RMS/no crash are verified; `finally` restores the sample, compares bytes and confirms recorded-sample recovery. This disk-withholding test is local, not a claim of deleting a file on Vercel.
- Mirror render-target hashes/range/rear markers, every-second-frame cadence, High/Ultra on and Low off. The on-screen material—not just raw target bytes—shows upper magenta before lower cyan control bars: **69/92 pixels**, mean y **22/34.5**, on each backend. The vertical sampling flip was fixed after an added test exposed it; final clean screenshots remove the markers and pause overlay.
- Synthetic 24-candidate allocation: **16 spatial engine emitters**, controlled-car priority; separate **16 one-shot** effect cap. This is not 16 total oscillators/buffer sources.
- Master .31 / engine .42 / effects .53 / radio .24 saved/reloaded through the real sliders. Numeric actual gains, pause attenuation and radio ducking checked.

Fresh telemetry: `VEHICLE-STREET-{webgpu,webgl2-forced}.json`, `VEHICLE-INTERIORS-{webgpu,webgl2-forced}.json`; all `errors: []`. Original failure logs remain in the same evidence directory as **superseded history**, not current failures.

## Reproduce

```bash
npm ci
npm test
npm run typecheck
npm run assets:check
npm run check:versions
npm run build
npx playwright install --with-deps chromium
xvfb-run -a npm run test:vehicles
xvfb-run -a npm run test:production
xvfb-run -a npm run test:city -- --grep 'opening choices|six worker-generated marker'
# Optional complete development suites (not claimed as fresh combined passes here):
xvfb-run -a npm run test:city
xvfb-run -a npm run test:parkour
xvfb-run -a npm run test:browser
# Read-only checks on the public site:
npm run verify:deployed
xvfb-run -a npm run test:deployed
xvfb-run -a node tools/smoke-public-car.mjs
```

Omit Xvfb on a desktop. `DEPLOYMENT_URL=https://your-approved-public-host.example` overrides public integrity/browser/sedan checks. Use a public HTTPS URL without credentials; no login/protection bypass is attempted. Vehicle tests intentionally rename one local sample and restore it in `finally`; do not run simultaneous vehicle suites against the same checkout.

`npm run assets:audio` is optional **offline asset preparation**, requiring Python `numpy`, `scipy`, `soundfile` and the retained licensed sources. Play/build need only the prepared public WAVs, not Python or an external sound service. [Asset provenance and replacement →](ASSET_PIPELINE.md)

## Backends, instrumentation and evidence boundaries

- Headed Chromium / Playwright 1.56.1 under Xvfb, software Vulkan/SwiftShader for WebGPU; forced WebGL 2 and WebGPU-disabled automatic fallback are separately asserted where listed. Nonzero ready flags/draw counts alone are not pixel proof.
- `window.__parkour`, `window.__city`, `window.__vehicles` exist in development or explicit `?test`, not ordinary production. They accelerate real physics/state fixtures; actual keyboard/mouse checks accompany them.
- Parkour's full physical pilot suspends rendering while stepping ordinary 60 Hz KCC inputs. Street reward result is approximately **156.35 simulated seconds, zero falls, A**; the full public pilot remains about **682.48 simulated seconds**. Neither is an FPS measurement.
- No hosted GitHub Actions result is claimed. Existing private repository creation/topics are verified separately; the current source has not been pushed.
- Portable evidence/manifests refer to project-relative paths. Original Playwright logs/reports can retain their original `/home/user` and `.arena` execution paths; files needed for review are copied into `docs/evidence/`.

## Unaccepted/human tests

**Near60 FPS / Radeon 840M 1080p60, physical gamepad/wheel/rumble, hands-on handling feel and by-ear three-engine/no-click comparison remain unaccepted.** Sources are lossy field previews with designed anchors, not calibrated multi-load captures. Cabin/driver art is a low-poly prototype.

Historical strict city measurements still fail the ≤8 ms maximum gate: 79.5 ms install / 79.7 ms per-chunk CPU / 80.1 ms whole update, despite P95 ~0.4 ms. They are **0.5 historical observations**, not a fresh 0.7 benchmark or a controlled speedup. Full-map continuous no-stall/no-popping flight remains open, as do exhaustive risky-branch and every-street-feature human traversals. [Detailed ledger →](FINDINGS.md)
