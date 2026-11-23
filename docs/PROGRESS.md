# Crosstown · build journal

<!-- STEP14-CURRENT-START -->
## 2026-11-22 release — Step 14 implemented; native 1080p60 and broad visual acceptance remain open

**Assumption:** preserve all earlier features, saves and routes; implement only the supplied lighting/effects/scaler step, using original code-built effects rather than unnecessary external assets. **Local 0.14.0 / 14.002; not deployed.** The production URL remains separately verified 0.13.0. Original DESIGN SHA-256 stays **`0f670679a820a3b687f6fb4fae6e0a14afebfc215b791b6918792ee322699dc9`**. **Verification provenance:** release metadata is labelled 2026-11-22, but the final batch records **2026-11-23T11:40:30.017Z → 2026-11-23T11:57:03.556Z**. The profiler's top-level date/timezone labels are stale; its ISO `capturedAt`/stage times ending in `Z` and the batch start/end provide recorded UTC provenance. No raw report or historical date has been rewritten. The source proof similarly separates release `date` from actual `capturedAt`.

### What exists

- All requested effect families: intact headlight/brake cones and ground pools; volumetric-style height fog, filtered sun shafts, bloom, rough wet-road SSR, camera motion blur, heat haze, tire smoke, skids, physical-impact sparks, rain splashes, occluded flare and original texture-free neon. Warm street lamps and emissive dusk windows are retained/improved. The day grade is bright/coastal/saturated; night keeps roads legible with colored emission.
- **Three r180 PostProcessing / TSL**, not the newer guide's RenderPipeline, legacy GLSL or EffectComposer. One half-float beauty/grade; conditional quarter-width × quarter-height bloom/shaft/SSR targets (1/16 pixels), bounded depth/fog/blur samples, one output transform. Camera cuts reset motion history and camera coordinate conventions follow the backend.
- Six nearest cars within 120 m, at most 24 cones plus 24 pools; 96 each smoke/sparks/splashes, 192 fading 22-second skids and at most 256 tracked wheels. Actual contacts/slip/brakes/collision events from owned, traffic, police and rival chassis feed effects without stealing earlier damage/audio events or adding physics bodies. Rain suppresses smoke.
- Texture-free lamp/neon instances share at most two luminous draws per active chunk; no per-lamp point-light swarm. Shader windows use derivative filtering and an actual emissive opt-out. Disabled/inactive/invisible mirrors release live targets/materials rather than keeping hidden rear renders.
- Escape → **Light & atmosphere** saves individual opt-outs and migrates old settings. Reduced motion suppresses blur/haze/flare; weather/daylight remove ineligible branches. Existing bindings, route lengths, garage VINs, bank/bests, twelve-car roster, parkour, activities, radio and landing remain.
- Four laptop budgets, DPR ≤1, scales **70 / 85 / 100 / 100%**, shadows **off / 512² / 1024² / 1536²**, views 140/220/350/500 m. Auto observes actual display intervals and sheds **volumetric fog → motion blur → wet reflections → bloom** before tier resolution/shadow/detail/population cuts; shafts share the volumetric cut. Warmup/cooldown/recovery hysteresis has regression coverage. Manual tiers stay fixed; the telemetry is not clamped to a fake 60.
- Real opt-in main-thread phase timings, scene payload estimates and worker generation/queue/roundtrip diagnostics. Existing worker baking/transfers, bounded normal pending requests, resumable installs, stable instance buffers and LRU are retained. These are CPU/storage estimates, **not GPU time, measured VRAM or overdraw**.

### Busiest-scene protocol and actual frame times

**busy-v3:** fresh browser per tier, **1920×1080 viewport, DPR 1**, actual Downtown verified both before/after, rain at **18:15**, requested locked **60 cars / 120 pedestrians**, three stars, helicopter and at least two **physical** ground police; nine nearby chunks before timing. Initial debug position/density/weather/stars and 100 setup physics steps are disclosed. Density is fixed before setup stepping. The player car brakes while actual police/crowd simulation continues. **Zero manual steps during measurement**, only normal input/simulation and requestAnimationFrame. Night legitimately reduces actual people; their counts are shown below rather than misreported as 120. This is a common fixed-density stress scene, not proof that one camera is the global worst case or each tier's uncapped maximum population.

**Software only:** Chromium/SwiftShader on virtual CPUs, not a Radeon 840M. A 1080p viewport is not native 1080p at Low/Balanced. These are short diagnostic samples (≥12 s / ≥8 intervals), not a long moving chase, stable statistical benchmark or human session. **None of these numbers meets the native 60 FPS acceptance gate.**

| Backend | Tier | Internal pixels | Intervals / elapsed ms | Actual FPS | Mean / p50 / p95 / max ms |
|:--|:--|:--|--:|--:|:--|
| WebGL 2 | Low | 1344×756 | 20 / 12,482.9 | **1.602** | 624.1 / 616.6 / 1,183.2 / 1,183.2 |
| WebGL 2 | Balanced | 1632×918 | 13 / 12,899.5 | **1.008** | 992.3 / 1,083.4 / 2,233.2 / 2,233.2 |
| WebGL 2 | High | 1920×1080 | 8 / 12,116.2 | **0.660** | 1,514.5 / 1,766.6 / 2,333.3 / 2,333.3 |
| WebGL 2 | Ultra | 1920×1080 | 8 / 16,199.4 | **0.494** | 2,024.9 / 2,149.8 / 3,066.6 / 3,066.6 |
| WebGPU | Low | 1344×756 | 13 / 12,616.1 | **1.030** | 970.5 / 1,016.6 / 1,083.3 / 1,083.3 |
| WebGPU | Balanced | 1632×918 | 8 / 13,699.4 | **0.584** | 1,712.4 / 1,716.6 / 1,766.6 / 1,766.6 |
| WebGPU | High | 1920×1080 | 8 / 19,899.1 | **0.402** | 2,487.4 / 2,483.2 / 2,566.6 / 2,566.6 |
| WebGPU | Ultra | 1920×1080 | 8 / 25,949.0 | **0.308** | 3,243.6 / 3,216.6 / 3,449.9 / 3,449.9 |

The same corrected protocol on the frozen **0.13 Balanced WebGL 2** build measures **0.797 FPS**, 10 intervals / 12,549.5 ms; mean/p50/p95/max **1,255.0 / 1,350.0 / 2,483.2 / 2,483.2 ms**, nine→nine nearby chunks and four physical police. Raw proof: `baseline-downtown-busy-webgl.json`. Whole-revision shadow/effect/detail/counter changes are bundled; a difference is **not isolated native attribution or a lag fix**.

| Backend / tier | Actual cars / people / physical police | Nearby chunks | Whole-frame draws / triangles | Post targets / estimated MiB | Material texture / geometry+instance MiB |
|:--|:--|:--|--:|:--|:--|
| GL2 Low | 60 / 58 / 4 | 9 → 9 | 140 / 123,545 | 1 / 11.63 | 25.44 / 20.90 |
| GL2 Balanced | 60 / 58 / 4 | 9 → 9 | 218 / 139,852 | 2 / 17.86 | 25.44 / 23.17 |
| GL2 High | 60 / 58 / 4 | 9 → 9 | 277 / 147,275 | 3 / 25.71 | 25.44 / 22.45 |
| GL2 Ultra | 60 / 58 / 4 | 9 → 9 | 316 / 153,311 | 3 / 25.71 | 25.44 / 22.72 |
| GPU Low | 60 / 58 / 4 | 9 → 9 | 164 / 123,545 | 1 / 11.63 | 25.44 / 21.12 |
| GPU Balanced | 60 / 58 / 4 | 9 → 9 | 203 / 131,875 | 2 / 17.86 | 25.44 / 22.66 |
| GPU High | 60 / 58 / 4 | 9 → 9 | 286 / 144,305 | 3 / 25.71 | 25.44 / 22.98 |
| GPU Ultra | 60 / 58 / 4 | 9 → 9 | 323 / 150,637 | 3 / 25.71 | 25.44 / 23.29 |

The last column estimates scene-owned payloads only, excluding retired roots, node-owned textures, targets, driver caches and actual residency; post/shadow/mirror estimates are separate. Draw counters include the most recent complete post/shadow/mirror frame; Balanced only refreshes shadows every fourth display frame. No claim of measured overdraw or isolated draw-count FPS gain.

Balanced **submission-side CPU mean / recent p95 ms**, not GPU execution:

| Phase | WebGL 2 | WebGPU |
|:--|--:|--:|
| input | 0.06 / 0.20 | 0.07 / 0.20 |
| fixedUpdate | 20.85 / 85.60 | 22.53 / 96.00 |
| cameraEnvironmentRoofs | 0.38 / 2.20 | 0.18 / 0.20 |
| cityStreaming | 1.51 / 8.30 | 0.88 / 2.70 |
| populationRender | 1.97 / 11.30 | 0.81 / 1.70 |
| vehicleEffectsMirrors | 0.63 / 1.30 | 1.17 / 4.40 |
| hudLife | 3.94 / 13.80 | 3.47 / 8.80 |
| renderSubmit | 19.71 / 92.70 | 11.83 / 25.00 |

Balanced worker work / queue-delivery / roundtrip maxima (ms): GL2 **99.7 / 4,655.5 / 4,656.2**; GPU **104.8 / 3,768.9 / 3,769.2**. These maxima include setup and scheduling/delivery, not a measured synchronous main-thread wait. Normal streaming caps pending requests at four; explicit bootstrap/test requests can increase total high-water. Balanced maximum observed install slice: **6.1 ms GL2 / 7.3 ms GPU**. Other final GL2 tiers retain **19.4 ms worker-baked-decor (High)** and **9.1 ms building-instance (Ultra)** outliers. Outliers remain visible; the ≤8 ms/no-popping/no-stall gate is not waived. Compressed Balanced Chrome profiles and all per-tier states/resources/adapters/stages remain in current evidence.

### Verified fixes and rejected attempts

1. Initial eight-step shafts made silhouette copies and binary SSR made marching gaps. Filtered quarter-resolution/jittered shafts and soft-confidence SSR replaced them after actual pixel inspection. SSR still has off-screen/edge limits; fog is a bounded height approximation, blur camera-only and cones/pools not fully shadow-occluded volumetric lights.
2. The first WebGPU collector ended on a generic resource 404; explicit favicon and URL/status instrumentation preceded the clean runs. Explicit blending removes the earlier undefined-blending warnings. Final lighting has errors/network arrays `[]`, only two known Rapier init-deprecation warnings per backend.
3. Actual isolated draw inspection found r180 rendering unlit two-sided transparent effects in redundant back/front passes. **forceSinglePass** keeps both faces: cones+pools **4→2 extra draws**, each particle family **2→1** in the same fixed lab. Both backend browser assertions and a new unit regression verify this; no native FPS attribution is invented.
4. The first nominal-downtown profiling point interpolated a road into **Old Town** (actual x≈594), and its unbounded Ultra setup stalled before timing. Those interrupted attempts remain named `oldtown-interrupted-*`, not current results. The corrected collector selects near the real district center, verifies Downtown before/after, applies requested stress before setup stepping and bounds/persists stages. All final tiers complete. The exact cause of the earlier setup stall is not established; it is not rewritten as a native timing result.
5. Earlier apparent window image-label reversal was checked directly: final windows-on is actually emissive and windows-off dark, on both backends. Real car/rain, city, individual lab and resize captures were assistant-inspected. This is **not comprehensive human art-direction acceptance or proof of no glitch in every pose/device**.

### Executed checks and acceptance boundaries

| Check | Final observation |
|:--|:--|
| Full units / real physics | **139/139**, 0 failed / 0 skipped; **29,891.207 ms**, 125 retained + 14 Step 14 cases |
| Types / decoded models / direct pins | **Pass / 22 / 15** |
| Production build | **Pass, 4.79 s** |
| Retained production pixels | **6 expected, 0 unexpected, 0 skipped, 0 flaky**, 88,808.855 ms; WebGPU / forced WebGL 2 / no-WebGPU fallback |
| Lighting | **9/9 phases per backend**, fourteen isolated on/off pixel effects each, real game windows/mirrors/car/rain/preferences/impact/city/resize/GC |
| City-life regressions | **11/11 phases per backend**, real modules/colliders/UI/saves, explicit Low/population-OFF fixtures |
| Activities / landing | **Six physical finishes/rewards**, delivery wall-failure/bank-record reload pass; **320/390/768/1440** landing widths, no engine/canvas before Play |
| Actual radio providers | **5 core passes / 2 failed-or-unavailable**; YouTube/SoundCloud observed PLAY+skip not established; authenticated Spotify untested without client ID/Premium/authorized account |
| Qualified busy-scene measurements | **All four tiers on both software backends**, actual intervals above, zero manual steps in the timed interval; **native target not accepted** |
| Clean source proof | Clean ZIP extraction/install/build/22-model/15-pin audits pass; **204/204 output files byte-match local candidate**, not public 0.13 |

Final runtime SHA-256 **`44522b11cde89b169e5e2f8bb4028f9763fa14e395764d64bdeafcd312aa3542`**, unchanged across the completed sequential 11-task batch. The radio task's unavailable rows remain exit 1, not provider acceptance; all non-provider tasks complete with exit 0. The previous 14.001 reports/collector/captures remain separately prefixed and are not substituted for the final revision. **Off** removes optional branches/samples/targets/draws/updates/meshes/materials/pools/live mirror targets. Shared beauty/grade/depth, original geometry/window pattern/mirror housings, cached city records and policy dispatch remain. Literal zero total CPU/GPU time, long-soak leak freedom, exhaustive no-glitch and human visual signoff are **not claimed**.

### File map

| Files | Responsibility |
|:--|:--|
| `src/rendering/post.ts` | Shared r180 TSL beauty/prepasses/composite/grade, backend coordinates, disposal/cut history |
| `src/rendering/{world-effects,particles,effects-policy}.ts` | Bounded contact/impact/weather-driven families and optional eligibility |
| `src/rendering/{city-lights,profile,resources}.ts` | Texture-free luminous instances, explicit CPU/payload diagnostics |
| `src/config/quality.ts`, `src/core/quality.ts` | Four real budgets, ordered cuts/recovery and honest display-cadence hysteresis |
| `src/world/city/{generator,mesh-bake,stream,environment,worker,city.worker}.ts` | Light records/window shaders, stream/shadow and real worker timing |
| `src/vehicles/{index,visual,cockpit}.ts`, `src/{npc,police,challenges}/index.ts` | Lazy mirrors, intact lamps and preserved shared-world impact event paths |
| `src/game.ts`, `src/save/index.ts`, `src/ui/{effects-settings,parkour-hud}.ts` | Frame composition, saved switches/reduced motion, telemetry and settings |
| `tests/lighting/`, `tests/unit/{lighting,effects-resources,quality}.test.ts` | Production-module synthetic isolation, pools/lifecycle/settings/scaler/submission regressions |
| `tools/{accept,profile}-lighting.mjs` | Both-backend on/off/physical-game checks, verified Downtown all-tier actual-rAF protocol |
| `tools/{check-release-functional,check-source-build,release-evidence,archive-evidence,check-handoff,package-project}.mjs` | Sequential provenance, clean extraction/output equality, lossless evidence, portable integrity |
| `docs/{LIGHTING,TESTING,FINDINGS,HANDOFF,RENDERER,SOURCE-ARCHIVE,DEPLOYMENT}.md` | Architecture/reproduction/limits and local-versus-public release boundary |

### Known issues / what the next step needs

1. **Native Radeon 840M-class 1080p60 and reported lag remain unaccepted.** Run the headed native collector, verify the adapter and inspect GPU/CPU/overdraw/VRAM traces in a moving populated pursuit and five-rival race. Keep exact real cadence/content; do not call Low/Balanced internal scaling native 1080p.
2. Human review of all effects in motion, SSR screen edges/camera cuts, bright day/neon night, driving/drift/stunts/garage escapes/map-following, audible mix and physical controls remains. Fog/SSR/blur/cone approximations are documented, not hidden. The busy-scene captures show overlapping near light/searchlight pools washing out some sidewalk highlights on both backends; final art tuning is not accepted.
3. Strict traffic fairness/no-stuck, continuous-map no-popping/max-stall and long driver-memory/toggle/streaming soaks remain open. Preserve prior 78/119-second queue waits and the current >8 ms outliers.
4. Real official-player PLAY/track-change acceptance and Spotify account/API/game-visual-use approval remain separate prior-step gates, not permission to bypass official visible players or expand Step 14 into provider redevelopment.
5. No Step 15 work, deployment, repository recreation/push or hosted CI pass. The source ZIP includes every 0.14 report/log and final capture; 0.13/historical raw trees, 51 supplemental old PNGs, 25 full-resolution historical gallery PNGs and 86 explicitly hash-pinned intermediate Step 14 captures remain unchanged in the workspace and inventory-only in the ZIP to fit snapshot limits. All 77 historical PNGs and fixed-name ZIPs remain intact in the workspace; the offline gallery embeds all 26 historical previews and the README Wren original remains in the ZIP. Current lossless compression audit covers **154 exact gzip restorations**; storage work is not a gameplay optimization. [Archive boundary](SOURCE-ARCHIVE.md) · [Lighting](LIGHTING.md) · [Reproduction](TESTING.md).

<!-- STEP14-CURRENT-END -->

Entries below remain chronological history, including the separately published 0.13 release; they are not current Step 14 acceptance claims.

## 2026-11-22 — Landing and Steps 10–13 implemented; performance/provider gates remain open

**Assumption:** retain every earlier feature, save and explicit route/control choice; add the requested lightweight `/` landing outside the game, preserve immediate `/play` and legacy game-query URLs, and implement the four supplied follow-up steps. This changes no byte of the original DESIGN (`0f670679a820a3b687f6fb4fae6e0a14afebfc215b791b6918792ee322699dc9`).

### What exists

- A responsive coastal cream/forest landing with local fonts/responsive images, navigation, three actual-capture feature cards and clear Play links. The hero is disclosed **AI-generated concept art**, not a game screenshot. No Three/Rapier/game/audio scene code or canvas loads on the landing. `/play` starts saved/default Quick immediately; `/play?setup` explicitly opens choices; root drive/training/length/webgl/other legacy queries remain. `/callback` is a separate optional OAuth return.
- Seven stylized, no-gore weapons: bat/pistol/SMG/shotgun/rifle/grenade/rocket, finite inventory/reload/recoil/spread, weapon wheel, real rays/pellets/projectiles, car-window fire, bounded fading ragdolls/effects/synthesis and seven free practice loans at County Line. Six independently downloaded/prepared CC0 Kenney GLBs and original bat/effects/fallbacks, with licences/credits.
- Real police sight cones/ray occlusion, seen/searching/lost/last-seen behavior and **20 unseen simulated seconds per star**; up to eight physical ground units plus helicopter, roadblocks and heavy escalation. F8/F9 are debug stars/cones; the existing traffic siren/gunfire reaction hooks are now connected. Garages have solid rear/side/roof colliders and an actually open doorway.
- Circular police-cone minimap, full map/connected-road waypoints and health/wanted/cash/ammo/challenge/radio HUD. Actual paid gun/ammo, paint, garage/storage/recovery and nearest-hospital care/respawn use the existing bank. Guarded storage retains earlier unlocks/marker bests/cache/settings. Death costs up to $100 and half live ammunition, not debt.
- Six drive-in activities/top-three records/cash rewards: five-physical-rival race, checkpoint trial, drift, two-landed-jump stunt, damage-limited delivery and final-camera speed trap. The six rooftop starts remain; two distinct seeded marker runs are completed in browser checks.
- Four original bounded procedural radio stations, real Radio Browser HTTPS streams/filters/favourites/static/fades and official **visible** YouTube/SoundCloud players. Optional Spotify uses PKCE/session-only tokens and stays hidden with no client ID; no secret is used. HUD/dash now-playing, engine/siren ducking and exit stop are wired. Provider approval/account/playback acceptance is separate; see [RADIO](RADIO.md).

### Performance work, without a false lag claim

Stable moving-instance matrix buffers retain 1,024 capacity and exact live draw counts, removing sampled attribute-resize shader churn; an isolated software comparison did **not** establish an FPS gain from that change alone. The Basic-shadow experiment was rejected; PCF remains. Analytical coast/canal water reduces **18,432 → 3,360 triangles (−81.77%)**, with numerical interpolation/up-normal/winding/finite regressions.

Matched earlier stationary population-OFF software A/B: WebGL roof **1.217→1.336 FPS**, coast **2.446→2.683**; WebGPU roof **1.105→1.143**, coast **2.300→2.495**. Whole-scene WebGPU draws differ, limiting attribution. They precede final activity/radio edits and are not final native benchmarks.

Final fixed-Balanced **actual-display** stress observations request locked 60 cars/120 people. Three-star/heli scene: **2.053 FPS**, 26 intervals/12.666 s, p95 1,133.2 ms. Five-active-rival scene: **1.438 FPS**, 18 intervals/12.516 s, p95 1,599.9 ms. Both have zero runtime errors and no manual steps during measurement; initial placement/stars/density are explicit debug setup. The three-star sample has zero physics-enabled ground police at both endpoints: it is a stars/heli-state observation, **not a qualified active ground-pursuit load**. The race does have five active physical rivals. These are still software-renderer failures of a near60 expectation, **not target-device acceptance or a lag fix**.

### Bugs and collector failures kept visible

1. Speed scoring used the first approximately 23 m graph gate, leaving too little acceleration distance. It now evaluates the actual route endpoint; the normal-input camera pass observes 75.31 km/h against 55.
2. Drift and stunt practice yards conflicted with Bay Fuel and a raised underpass approach. Final clear yards are **(1024,1280) / (1536,1280)** with building exclusions and visible physical ramps. A rejected intermediate stunt site exposed analytical-terrain/coarse-heightfield disagreement; the clearance assertion was not loosened.
3. Stunts incorrectly accepted the vehicle's cumulative lifetime airtime. Current-jump time accumulates only while airborne; the short-hop-with-old-airtime regression rejects stale credit.
4. Browser garage sight initially queried before the new shared-world colliders were stepped. The collector now installs/steps actual physics; rear wall/roof are blocked and the open door remains clear on both backends.
5. Official player readiness/commands were too optimistic. Undefined YouTube video-ID construction was removed; SoundCloud title callbacks no longer invent PLAY; **ON AIR requires an observed official PLAY event**, not a successful method return. The final real-provider attempts still do not establish YouTube/SoundCloud playback/skip.
6. Earlier test defects—out-of-scope purchased state, a surviving stale report writer, a residual rocket cooldown before pistol shots, and a visible-HUD assertion while rendering was deliberately disabled—are corrected in collectors. Their failures/interrupted reports remain separately named. The populated collector's initial pre-update helicopter assertion is preserved; a same-runtime retry awaits actual normal-update state and records the corrected collector hash. No failed telemetry row was edited into a pass.

### Executed checks and boundaries

| Check | Observed result |
|:--|:--|
| Full real-physics/unit suite | **125/125**, zero failed/skipped, **74,346.708 ms**; retained 99 older cases plus 26 follow-up regressions |
| Strict types / decoded models / dependency pins | **Pass / 22 of 22 / 15 of 15** |
| Production build | **Pass, 7.83 s**, **204** public files |
| Clean extracted source ZIP | Clean `npm ci`/build (**6.22 s**)/22 models/15 pins pass; **204/204 built output bytes match the public release**; same runtime fingerprint |
| Built city-life integration | **11/11 WebGL 2 + 11/11 WebGPU**, actual modules/colliders/UI/transactions/persistence; Low, population OFF, explicit fixtures |
| Physical activities | **6/6 finished, recorded and paid**: trial 57.05 s/$350, delivery 53.40 s/$450, speed 75.31 km/h/$250, race 57.10 s/$500, drift 142.13/$400, stunt two landed jumps/$550 |
| Delivery failure / records reload | Normal-pedal solid-wall collision reaches damage **0.3215**; visible failure, bank/bests unchanged; all six records/$2,500 bank reload identically |
| Landing | **320/390/768/1440**, no overflow/canvas/engine; about 281,417 B mobile / 342,833 B wider resources; assistant image review at 390/1440, not a human device study |
| Real radio fixture | **5 passing core rows / 2 failed-or-unavailable**, no mocks/runtime exceptions; YouTube official error 2, SoundCloud no observed PLAY; no playback/skip acceptance for those providers |
| Spotify authentication | **UNTESTED**, no client ID/Premium/allowlisted account; source hidden/no SDK; public use requires separate terms/approval review |
| Native near60 / human handling/listening / traffic fairness | **OPEN**, not waived by accelerated steps or deployment |

Final runtime SHA-256 is **`fb09baa8b193d2229a3b8665835b38c3e9c261ba0bf7da3c5a0a2e67e824ba66`**, unchanged across the final browser batch and same-runtime populated-collector retry. Command/collector hashes and actual start/end/exit status are recorded. A method named `pilot` uses normal pedals/steering and one shared step; it is not a human/FPS claim. A full human garage escape and manual map-click/follow drive still need review. Older 0.9 full browser/traffic/handling runs remain historical, not newly rerun whole-city 0.13 coverage.

**Published 0.13.0 / 13.001 at [crosstown-sarang-dev.vercel.app](https://crosstown-sarang-dev.vercel.app).** Deployment `dpl_4jMtSU8oRbRUoB3MpUiMxTQVnnkR` is READY/PROMOTED, both primary/legacy aliases assigned. **204/204 anonymous permanent-file hashes pass before and after both transfer processes stopped**. The actual public landing → normal `/play` workflow passes without debug hooks or runtime/request failures. The compiled public archive has **12,850,153 B**, SHA-256 **`b0b3249355ea2d747729928aa0227aef8d6ea1c38e142c3eacb361b227905947`**, with independent local/HTTPS extraction checks and the matching Vercel builder checksum line. Normal Vite/npm-ci/source-build settings and existing SSO are confirmed unchanged; the public-only transfer is retired and excluded from source. No project/domain/repository recreation, source push or hosted CI pass is claimed. [Deployment details](DEPLOYMENT.md).

### File map

| Files | Responsibility |
|:--|:--|
| `index.html`, `src/main.ts`, `src/landing.css`, `public/images/`, `vercel.json` | Lightweight landing, immediate-game/callback/legacy routing, responsive local art/captures |
| `src/rendering/instances.ts`, `src/world/city/water.ts`, `environment.ts` | Stable instance backing and bounded analytical water surface |
| `src/weapons/`, `src/audio/combat-audio.ts`, `tools/prepare-combat-assets.mjs` | Bounded tools/projectiles/range/ragdolls/synthesis, six prepared CC0 models and provenance |
| `src/police/`, `src/vehicles/ai-driver.ts` | Wanted/last-seen/real sight rays and corner-aware physical police/rival driving |
| `src/city-life.ts`, `src/game.ts`, `src/save/economy.ts`, `src/ui/adventure*` | One shared-world composition, services/bank/hospital, HUD and acceptance interfaces |
| `src/world/city/{generator,physics}.ts`, `src/challenges/` | Real garage walls, collision-clear yards, activities/records and five rivals |
| `src/radio/`, `.env.example`, `docs/RADIO.md` | Procedural/live/official/optional PKCE sources, no-secret setup and actual provider limits |
| `tests/unit/{city-life,city-life-regressions,water}.test.ts` | Follow-up rules, geometry/clearance/current-airtime and numerical regressions |
| `tools/accept-{city-life,activities,landing,radio-providers,populated-life-performance}.mjs` | Real built-browser fixtures and honest actual-rAF/provider measurements |
| `tools/check-release-functional.mjs`, `fingerprint-runtime.mjs`, release/handoff/package tools | Sequential collector provenance, unchanged runtime, public-only transfer, anonymous hashes and source ZIP integrity |
| `docs/{HANDOFF,TESTING,FINDINGS,DEPLOYMENT,PROGRESS,SOURCE-ARCHIVE}.md` | Current implementation, exact verification, open gates and portable handoff; earlier notes below remain history |

### Known issues / next step

1. **Reported lag remains unresolved.** Obtain a native target-laptop trace in busy streets/three-star pursuit/five-rival race and fix the largest verified CPU/GPU cost without deleting content or falsifying cadence.
2. Resolve real YouTube error 2 and SoundCloud missing PLAY in a permitted browser/network; validate actual track changes, not API readiness. Do not silently call these working or bypass official visible players. Keep Spotify disabled until authorized Premium/account/API/terms testing is possible.
3. Human review of driving/drift/stunts, garage sight-break escape, manual waypoint following, audible mix and physical controls remains. The automated drift pass is only slightly above its target.
4. Strict traffic no-stuck/fairness still needs broad occupied-car/intersection coverage; preserve earlier 78/119-s raw waits. Continuous-map/no-popping/max-stall and long GPU-memory/takeover soaks remain open. Art and pedestrian social/seating transitions stay prototype-quality.
5. Source push/hosted CI require secure authorized authentication; do not recreate/delete the existing private repository. Keep original DESIGN/saves/old features and fixed-name historical ZIPs. The rolling source ZIP is regenerated as 0.13.0, with every entry extracted/hash-checked. All current 0.13 evidence/capture pixels and the 26 historical gallery originals are included. Eighteen large current raw reports/logs are losslessly gzip-stored (40 total audited exact restorations), not edited; the summarizer transparently reads either form. Raw 0.5/0.7/0.9 evidence and 51 explicitly hash-pinned supplemental historical PNGs stay byte-identical in the workspace rather than copied again into the ZIP; an exact exclusion inventory is included. This storage work does not change runtime or count as a gameplay optimization. [Handoff](HANDOFF.md) · [verification](TESTING.md) · [findings](FINDINGS.md).

Entries below are chronological history, not current scope/acceptance claims.

## 2026-11-22 — Steps 08–09 implemented and published; acceptance limits recorded

**Assumption:** retain Crosstown and every earlier feature/explicit choice, add only the supplied twelve-car/damage/garage and traffic/pedestrian scope; siren/gunfire fear are test/future hooks, not police or weapons. The original DESIGN SHA-256 is unchanged: `0f670679a820a3b687f6fb4fae6e0a14afebfc215b791b6918792ee322699dc9`.

### What exists

- Twelve independent fictional definitions, two each compact/sedan/muscle/supercar/SUV/motorbike; separate dimensions/mass/torque/gears/drivetrain/suspension/grip/brakes/aero/paints/audio. Ten prepared CC0 Kenney GLBs, with civilian roof trims; two detailed original CC0 bike GLBs after downloadable source access failed. Bikes have **two real wheel rays**, lean control, their own cabin and single/designed-twin audio. The old cabin studies/inputs/lab remain.
- All twelve complete the same 44-segment ordinary-input Rapier circuit, at least 850 m per car, no helper impulses/respawns, maximum center error <0.74 m, zero damage. Three-second acceleration ~10.57–24.66 m/s, 13 m/s brake distances ~3.47–6.61 m; bikes lean ~0.44–0.46 rad. These establish tuning differences, **not human driving feel**.
- Twelve per-car sound profiles / **96 roster loops** from six retained licensed recordings, with per-car designed DSP/synthesis. V10/twin are explicit flat-six/single-derived timbres, not independent recordings or measured dyno/load captures. Browser decoding and PCM/hash/seam tests do not replace listening.
- Local body/door dents, broken glass/lamps, smoke, fire→wreck after seven simulated seconds and modest power/grip degradation. Real collision damage applies to **both** striking and stationary struck chassis. No hidden repair from the upright-recovery key.
- Stopped parked/NPC cars are takeable via real E/F interaction. Six unique-VIN garage slots, browser persistence, actual removal into storage, retrieve/paint/recovery service UI in real marked city lots; last-owned recovery retains model/paint. Reward is granted once in garage **and** street below billboard, including a pending slot if full; store/retrieve/reload keeps one live VIN. Lab loans cannot be stored.
- Road-graph lane planners, 80-second staggered vehicle/pedestrian signals, front-to-back following, intersection/receiving-lane clearance, oldest eligible lane heads, indicators/brakes/overtaking/honks and three personalities. Actual player/NPC impact triggers braking/evasion; siren flag requests pull-over; future fear API introduces no gun or police gameplay.
- Animated CC0 glTF pedestrians on connected A* sidewalk routes: walk/idle/run/flee, legal crossings with clearance, destinations, paired chats, benches and entry/exit at actual parked cars. Chat/Flee are adapted greeting/run clips; seating/social transitions remain prototype-quality. Night reduces people and switches headlights on.
- Balanced nominal **60 moving cars / 120 people** plus a small parked pool across nearby blocks; near full Rapier vehicles/capsules only within **80 m**, in the one existing shared world. Far models use batched/instanced stand-ins. Actual dynamic positions feed back into planning; no hidden extra world steps. Near skinned caps 3/6/8/12 by tier, damaged near car visuals promoted only when needed.
- Performance work retains full routes, city, boats/aircraft, mirrors and inputs: owned/decoded Float32 geometry, all wheel children/transforms, moving-batch culling fixes, square neighborhood retirement, reduced Low detail radius and cheaper Balanced shadow cadence. Severe multi-second frames now count toward real-cadence quality/density reduction. **The user's lag is not considered solved.**

### Bugs isolated, not hidden

1. Replacement chassis mass/inertia were deferred to the next world step. A contact-ready wheel update could see zero mass and inject NaNs; later WASM recursive-use errors were secondary fallout. Recompute mass properties **before controller use**, never perform an extra hidden step. Every roster definition has a finite-mass/no-extra-step unit; repeated six-takeover/paint/recovery checks pass.
2. AWD engine drag bypassed Rapier brake friction; zero wheel drive force while braking. NPC brake-to-rest must not enter player reverse; reverse is disabled only on NPC engines.
3. Workshop host mount order and stale cached nearest service caused missing prompts/paint lookup hangs; mount after HUD and synchronously resolve the actual anchor. Takeover retirement disposes the **current** proxy, and disposal clears observer/external-nearest hooks.
4. Collision detection checked only pre-contact speed, so a stationary struck NPC could receive zero damage. Check pre/post-contact impulse speed; an actual loaded-city crash now damages both cars and produces an evasive lane change. No damage or crashed flag is injected into that test.
5. The retained restart test caught r180's stale/null sampled binding for the newly built finish billboard. A CDP probe found correct material/node texture versus null binding; an explicitly owned TSL texture node preserves compile and fixes both backends. Async lab completion now preserves Escape pressed during loading. The retained **4/4 vehicle/cabin/audio/mirror tests pass in 7.5 min** after these corrections.

### Executed population observations

| Run | Observation / limit |
|:--|:--|
| Pure planner soak | 240 simulated seconds / 14,400 ticks; independent sampled overlaps/red entries/illegal crossings 0; raw stopped wait **118.65 s**. Not Rapier or rendering |
| Loaded shared-world soak | 120 simulated seconds / 7,200 ticks in **20.281 wall seconds**; forced 60/120; maximum 12 full proxies; sampled constraints/finite errors 0; 67 duration-qualified agents, no <1 m starvation; raw stop **78.183 s** |
| Actual occupied parked car, fixed Balanced | **120.228 wall seconds**, 216 observed rAF intervals over 116.162 s, **1.859 FPS**; only **20.883 simulated seconds** during observation; sampled constraints 0, no agent reaches 30-s starvation eligibility |
| Separate actual occupied-car Auto observation | **120.116 wall seconds**, 291 intervals over 118.229 s, **2.461 FPS**; **27.333 simulated seconds**; actual Auto→Low, density factor **0.25**, six reductions, targets **8 cars / 16 people**; no 30-s eligible agents |
| Actual player/NPC collision / reactions | 80 chassis contact samples; maximum impulses **14.913 / 8.835 m/s**; player/NPC damage **0.2163 / 0.1183**; braking, **1** evasive lane change, **12** siren pull-overs; day sample 85 people→58 at night, all headlights on; future fear hook only; runtime errors `[]` |

No sampled audit is exhaustive swept-contact proof. The actual two-wall-minute watches are now executed, but slow software rendering advances too little simulation to prove fairness. Queues spanning signal cycles remain visible; **strict no-stuck and native near60 FPS acceptance remain OPEN**, not waived by a small unexplained-stop counter or agent recycling. The initial wall-watch interrupted by the stationary-impact development edit is retained as interrupted history, not counted.

### Final release checks

| Executed check | Final observed result |
|:--|:--|
| Full real-physics/unit suite | **99/99**, zero failed/skipped, **46,786.160 ms**; all 75 earlier cases retained |
| Strict types / model audit / exact dependency pins | **Pass / 16 of 16 / 15 of 15** |
| Production Vite build | **Pass, 7.80 s**, 189 public files |
| Fleet / retained vehicles, both renderers | **6/6 (6.2 min) / 4/4 (7.5 min)** |
| Selected city regressions / local built output | **4/4 (3.3 min) / 6/6 (2.4 min)**; choices/A-D/markers/cache/landing and actual pixels/fallback |
| Actual public regressions / separate car smoke | **5/5 (3.3 min) + pass**; real full finish/save/ghost/night/training and drive/samples/mirrors/E exit |
| Anonymous deployed file integrity | **189/189**, before **and after** both temporary transfer processes stopped |

The final local batch is bracketed by identical runtime SHA-256 **`6269b28082f916fe1a076b75e54115ccdf1b4d90da26658eb6f5b70bc9851910`**. `final-functional-batch.json` checks actual report start/duration boundaries; the collector uses the actual `.arena/fleet-results.json`. This is a byte revision, not a fabricated Git commit. Original DESIGN remains unchanged.

Historical attempts are not silently promoted: a previous post-impact 99-unit/6-fleet pass was followed by **3 failed / 1 passed** retained vehicle cases. CDP isolated the finish billboard's correct node texture versus null cached binding; direct owned TSL texture nodes fix recompilation without skipping it. Moving lab resume before asynchronous compilation preserves Escape during loading. All final checks above follow both corrections. Their earlier failures and unchanged pre-fix runtime `c2397cc537a4473bda7a7649d45e3725b8e52ec799c5ee24d5cf8eed54a55304` remain separately named evidence.

Vercel deployment **`dpl_CGHF6xxuyPmeXv6cZjVVi7Yq2Mmt`** is READY/PROMOTED at the new public address, with the legacy bookmark alias retained and SSO unchanged. The **12,548,166 B** compiled archive, SHA-256 **`a4ac64d518dcc0d5a87c5107a95bd8198e4994d97446ff1ecabb601e96c1a787`**, matches independent local/HTTPS roundtrips and the builder's checksum line. Normal Vite source defaults were restored/confirmed. This is tested compiled-output deployment, **not a source push or hosted GitHub CI pass**.

The timed population/reaction observations above precede only those final billboard/lab-pause edits. `route-recompile-change-boundary.json` verifies NPC/vehicle/physics modules are byte-identical. They are not relabeled as fresh final-revision native performance acceptance.

The final **fresh-Chromium-per-scene software diagnostic completed, exit 0, all three errors `[]`**: rooftop **1.121 FPS / 15 intervals / 13.383 s**, downtown street **1.085 FPS / 14 / 12.900 s**, cockpit lab **1.823 FPS / 22 / 12.066 s**, at 1280×800, fixed Balanced, population off. `profile-0.9-final.json` and three raw compressed CPU profiles retain exact values. Shader/program query waiting still appears; population alone is not the cause of slow software rendering. A prior shared-browser attempt completed only the roof at **0.921 FPS** and timed out opening its second page after 180 s; its failure/partial data remain `profile-0.9-final-shared-browser*`. Fresh process isolation and awaited lab compilation change the historical comparison boundary, so **no strict matched A/B ratio, lag fix or native FPS pass is claimed**.

### File map

| Files | Responsibility |
|:--|:--|
| `src/vehicles/{cars,engine,physics,damage}.ts` | All twelve definitions, two-wheel dynamics, drivetrain/brakes and actual damage/stages |
| `src/vehicles/{geometry,library,visual}.ts` | Decoded immutable glTF sources, independent owned geometry/materials, wheels/paint/dents/lights/effects |
| `src/vehicles/{garage,index,services}.ts` | VIN ownership, six-slot guarded saves, takeover/lifecycle, marked workshop UI/recovery |
| `src/npc/{traffic,pedestrians,index}.ts` | Real lane/sidewalk navigation, signals/reactions/activities and 80 m shared-world proxies/capsules |
| `src/npc/{visuals,budget}.ts` | Near/far rendering, animation pool, damage promotion and actual-frame adaptive density |
| `src/core/quality.ts`, `src/world/city/{generator,layout,stream}.ts`, `src/game.ts` | Severe-frame Auto, service/crossing geometry, square streaming/cadence, one-step composition and observer API |
| `tools/prepare-roster.mjs`, `trim-civilian-roof.mjs`, `prepare-roster-audio.py`, `credits.mjs` | Reviewed independent acquisition/fallback/preparation, exact licence/PCM/model reports and regenerated credits |
| `tests/unit/{fleet*,population,vehicle*}.test.ts`, `tests/browser/fleet.spec.ts` | Roster/geometry/audio/mass/ownership/brakes/collision units and actual six-slot/reward UI on both backends |
| `tools/accept-{roster,traffic}.ts`, `accept-population*.mjs`, `profile-frame-cost.mjs` | Ordinary-input circuit, pure/load/wall-time/reaction audits and controlled actual-rAF software profiles |
| `tools/{fingerprint-runtime,prepare-public-release,verify-deployed,release-evidence,check-handoff,package-project}.mjs` | Same-runtime boundaries, temporary public-only transfer, hashes, evidence index, offline links/safety and portable ZIP |
| `docs/{FLEET,POPULATION,TESTING,FINDINGS,DEPLOYMENT,PROGRESS}.md`, gallery/assets/evidence | Implementation, provenance, unaccepted gates and exact handoff boundaries |

### Known issues / what the next step needs

1. **Native performance remains unaccepted and software is still ~1–3 FPS.** Profile on the actual target laptop and busy Balanced/ten near cars; preserve full gameplay while fixing shader/stream/allocation outliers. Do not infer that an 8-car adaptive floor makes 60 FPS pass.
2. **Traffic fairness/no-stuck remains open:** shorten/balance signal and turn reservations with actual queue/green-opportunity measurements, long occupied-car/native watch and broad intersection/seed coverage. Do not hide the 78/119-s raw waits.
3. Human handling/audio/real-device rumble and pedestrian bench/social/car-entry alignment need hands-on review and better source art/recordings where available. A long GPU-memory/takeover soak and all moving-takeover permutations remain unaccepted.
4. Historical streaming ≤8 ms / continuous full-map stall-free/no-popping, long-course scenic blending and exhaustive risky/street-feature traversal remain open. Police/weapons/deep radio are later scope, not added here.
5. The existing private GitHub repository is unchanged/unpushed without secure auth; no hosted CI pass. Keep original DESIGN, earlier fixed-name archives/features/saves and the new public address. Large raw JSON/logs are losslessly archived as `.gz`, with **22** exact-restoration audits in `EVIDENCE-COMPRESSION.json`. All **77** PNGs retain identical decoded pixels after lossless encoding. The portable ZIP includes all current evidence; historical 0.5/0.7 raw trees remain unchanged in the workspace rather than duplicated inside it. [Archive scope](SOURCE-ARCHIVE.md).

## 2026-11-22 — Performance follow-up and Steps 08–09 started

**Work in progress; public production remains verified 0.7.0 until a new build is tested/deployed.** The user still observes lag, requests a Vercel-site rename and supplies Steps 08–09. Assumption: keep Crosstown as the name, preserve all earlier features/choices, implement the 12-car roster/damage/garages plus bounded traffic/pedestrians, and add only the future siren/gunfire reaction hooks—not weapons or police gameplay. Original DESIGN remains unchanged.

First capture controlled 0.7 baselines; fix measured render/main-thread overhead before raising agent counts. Use real reviewed CC0 models/animations and the retained licensed recordings, with designed code-built fallback on failure. Distinguish measured software gains from unvalidated native 60 FPS/human handling/audio quality. The existing project is already named Crosstown; the old public alias must not be replaced by an invented, unapproved domain.

## 2026-11-22 — Steps 06–07 implemented, verified and deployed

**Assumption/scope:** one playable Harbor Six sedan, with six class-specific cockpit/engine studies on that same chassis—not six playable cars or the later eleven-car fleet. Keep the earlier city/parkour/foundation and the user's Quick/Standard/Full, controls/camera/graphics choices. Only 06–07 were added; the unchanged whole-project reference is not a completion claim.

### What exists

- Data-driven 1,320 kg RWD sedan with the real prepared CC0 glTF, four re-pivoted moving wheels and 42 moving source-door triangles; working lamps, a seated code-built driver and a minimal parked-driver step-out/carjack sequence. Code-built sedan fallback remains available on model failure.
- Four-ray Rapier suspension/damping, load transfer, surface/slip tire curves, torque/gears/drivetrain/differential/engine braking, optional assist and real handbrake/flight/landing/impact/recovery. Vehicles compensate to Earth gravity inside the retained −24 character world, with exactly one shared Rapier world step per fixed tick.
- Ordered door→key→ignition/bulb check→crank→catch→idle, cold-start fast idle, shutdown and manual in-gear stalls/restart. Automatic brake-to-reverse and reverse-to-drive transition are covered. E/F street entry/exit and the actual parkour finish-reward car work.
- Cockpit/hood/close/far chase views, smoothed speed-sensitive keyboard steering, mouse-steering toggle, analog Gamepad API triggers/stick, USB wheel-axis mapping and matching ±450° rack, plus browser rumble. Native wheel force feedback is not claimed.
- Clear parking/physical 10×14 m forecourts where the central reserved course has no through roads. Both parked and reward cars avoid every course-building footprint. The relocated reward is shared by find/street data and its glowing arrow; the earlier goal-orbit finish flight remains. No vehicle GPS/AI is added.
- A worker-built ~0.8 km handling loop outside the city, with 44 segments, an optional physical ramp/slope/gravel/wall; `/?drive` and Esc → Driving lab. The off-map proving ground is not advertised as an enlarged city.
- Six distinct code-built compact/sedan/muscle/supercar/SUV/motorbike cabins with working speed/RPM/temperature/gear/warning lamps, two hands/matching wheel, manual shifter, radio-OFF display and time-of-day lighting. Same sedan exterior/physics throughout; low-poly study art, not finished realistic interiors.
- Actual rear views: 256×96 center, 128×96 sides, every second rendered frame on High/Ultra; Low/Balanced explicitly off. A screen-level two-height fixture caught and fixed vertical texture inversion on **both** render backends. The removed fixture is absent in final clean live-view captures.
- Six licensed real-engine profiles / 48 WAV RPM-load loops, equal-power crossfade and RPM pitch, hybrid engine/mechanical/driving synthesis, PannerNode allocation and sample-failure fallback. Current recordings are lossy publisher-preview field recordings with **designed**, not measured, RPM/load anchors. All provenance/modifications/CC0 or CC-BY evidence is bundled.
- Saved master/engine/effects/radio buses (plus retained music). Six replacement folders/manifests documented in README. Engine emitters cap at 16, controlled car then nearest; one-shots separately cap at 16. This is not a global 16-AudioNode implementation. Radio catalogue/streaming remains later scope.
- Lifecycle cleanup isolated: each glTF car owns its material/texture copies, rooftop disposal traverses only its own root/caches, duplicate cleanup is safe, and cabins/forecourts/car/voice ownership is bounded through route restart. Unit disposal probes and browser restart bounds pass; a long GPU-memory soak is not claimed.

### Executed verification

| Run | Final observed result |
|:--|:--|
| Full units | **75/75**, 34,731.101 ms; original 53 + 22 vehicle cases |
| TypeScript / model audits / exact pins / DESIGN | Pass / **3/3** / **15/15** / unchanged SHA-256 |
| Production build | Pass, **9.24 s**, 77 public files |
| Vehicle browser | **4/4**, **11.1 minutes**, WebGPU + forced WebGL 2; errors `[]` |
| Earlier city regressions | **4/4**, **6.8 minutes**; choices/real A-D/yaw/saves + six starts/caches/reset/fly landing, both backends |
| Final local built-output | **6/6**, **3.9 minutes**; WebGPU / forced WebGL 2 / WebGPU-disabled fallback |
| Actual public-site earlier-feature tests | **5/5**, **3.0 minutes**; all three paths, full physical finish/save/ghost/night and training |
| Actual public sedan smoke | Pass; real motion **7.113 m/s**, samples, live mirrors and real E-key exit, no runtime errors |
| Public integrity | **77/77** anonymous SHA-256 matches, repeated after temporary transfer shutdown |

Vehicle browser evidence includes actual street carjack/door/start/steering/cameras/handbrake/exit, physical parkour finish→reward entry (about **156.35 simulated seconds, zero falls, A**), route restart/re-entry, real-key manual shutdown/stall/neutral restart, six cabin/gauge checks, virtual pad/wheel/rumble, three-engine sweeps, actual missing-file fallback and restore, mirror cadence/off tier/orientation and saved slider/gain tests. A 24-emitter/24-effect fixture verifies 16/16 caps and controlled priority.

The missing sample `harbor/high-on.wav` was moved out of the served folder and deliberately returned HTTP404; fallback RMS remained nonzero, `finally` restored the file byte-for-byte, and samples recovered. Screen mirrors showed upper magenta / lower cyan with **69/92 pixels**, mean y **22 / 34.5**, on both backends. Pause overlays and control markers are removed from final captures. Low-tier cabin-study **MIRRORS OFF** text is intentional.

**Revision boundary:** full units/vehicle/city tests follow all gameplay/material/mirror/arrow fixes. A stale public `release.json` was then corrected from 0.5 to 0.7 metadata only; final build/local production/public tests and integrity checks include that correction. No gameplay code changed afterward. Earlier full-city performance/tour evidence remains historical. Accelerated physics pilots are not real-time FPS proof.

Durable logs/reports: `docs/evidence/crosstown-0.7.0/`; detailed raw vehicle states: `VEHICLE-{STREET,INTERIORS}-{webgpu,webgl2-forced}.json`. Failed earlier browser attempts are retained as superseded history. Original DESIGN SHA-256 remains `0f670679a820a3b687f6fb4fae6e0a14afebfc215b791b6918792ee322699dc9`.

### Publishing and handoff

- Existing **private** GitHub **sarang-cmd/crosstown**, ID **1467794178**, was successfully created earlier with ten topics using the explicitly authorized transient token. Its value is never saved. **Source push remains pending:** connector unsupported, no current authenticated CLI/token available. No local Git commit or hosted CI pass is invented.
- Publisher now validates the existing exact owner/repository ID/private state and clean reviewed `main`; it performs a normal non-force push and **never recreates/deletes the repository or changes visibility**. CI includes a vehicle acceptance job. A reviewed source ZIP is not a GitHub push.
- Existing Vercel project refreshed to **0.7.0**, deployment **`dpl_4FNdWnzTuzhbpnp3ZVPYS7cCLRjm`**, observed **READY/PROMOTED**, aliases assigned. Established public URL remains https://coastline-highline.vercel.app.
- New one-time public-output transfer: **5,312,752 B**, SHA-256 `89c328bb1046b7948f6e3c46280a35f66365f88cfbf7a8e40e322d332eccaa08`; independent roundtrip + Vercel verification + 77 public hashes pass. Only compiled public files were exposed. Transfer server/tunnel are **stopped**, and hashes still pass. Retired transfer sources must not be redeployed.
- Normal Vercel source settings confirmed: Vite / `npm ci` / `npm run build` / `dist`. This import is not a claim of remote source compilation. Source assets/lockfile/docs/tests remain in the refreshed allowlisted archive; originals and historical 0.5 handoff/evidence are retained.

### File map

| Files | Responsibility |
|:--|:--|
| `src/vehicles/cars.ts`, `engine.ts`, `physics.ts` | Sedan data, tire/torque curves, ignition/transmission, suspension/drivetrain/collisions/exits |
| `src/vehicles/parking.ts`, `index.ts` | Real city/course-safe parking/physical pads, composition, shared stepping, ownership/lifecycle and preferences |
| `src/vehicles/visual.ts`, `cameras.ts`, `cockpit.ts` | Real glTF door/wheels/lights/people/material copies; four views; six geometry cabins/gauges/live mirrors |
| `src/vehicles/circuit*.ts`, `test-pilot.ts` | Worker proving-ground bake/physics and ordinary-input loop pilot |
| `src/audio/engine-mix.ts`, `vehicle-audio.ts`, `parkour-audio.ts` | Recorded/synth engine mix, nearest-first spatial emitters, effects, saved buses and retained parkour sound |
| `src/core/input.ts`, `src/config/actions.ts` | Keyboard/mouse/Gamepad API/wheel axes, mapping and rumble |
| `src/game.ts`, `src/ui/vehicle-hud.ts`, `vehicles.css`, retained HUDs | Street/drive/reward/lab modes, settings/touch driving buttons and diagnostics |
| `src/world/city/physics.ts`, `src/world/rooftops.ts` | Shared city collisions, course-footprint tags, relocated arrow and owned rooftop disposal |
| `tools/prepare-car-audio.py`, `assets/audio-sources/`, `public/audio/cars/` | Reviewed source recordings, offline DSP, six manifests/48 prepared loops |
| `tests/unit/vehicle*.test.ts`, `tests/browser/vehicles.spec.ts`, `playwright.vehicles.config.ts` | Physics/audio/ownership units and actual-input/two-backend acceptance |
| `tools/smoke-public-car.mjs`, `docs/PUBLIC-BUILD.json`, `VERCEL.json` | Public sedan acceptance and exact deployed-build boundary |
| `README.md`, `ASSET_PIPELINE.md`, `FINDINGS.md`, `TESTING.md`, `DEPLOYMENT.md`, gallery/evidence/packager | Current controls/replacement folders, provenance, honest gates and portable release tools |

### Known limitations and what the next step needs

1. **Near60 FPS driving/cockpit and Radeon 840M 1080p60 are unaccepted.** This is software graphics. Historical 0.5 streaming maxima (79.5 ms slice / 80.1 ms update) still fail the ≤8 ms gate; no fresh full-map no-stall/no-popping pass or measured hardware speedup is claimed.
2. **No by-ear engine/mix/click review**, physical gamepad/wheel/rumble or subjective handling review. Virtual devices and numerical RMS/seams/pitch are useful but not substitutes. Obtain target hardware and human comparisons before accepting feel/sound/performance.
3. Cabin/person art and sparse street/forecourt/distant silhouettes remain clearly prototype-level. Higher-quality rigged interiors/people and licensed measured multi-load recordings would improve realism; six independent vehicle dynamics/exteriors are not included.
4. Preserve route/city scenic blending, every risky path/street feature and long-soak GPU-memory testing as open. Existing choices/parkour/city features were not removed to meet a target.
5. Before later fleet/NPC/police/weapons/radio steps, reuse the data/physics/audio interfaces, run the earlier regressions, obtain secure auth for the **existing** private repository and review a clean allowlisted source commit. No new later-phase system is claimed here.

## 2026-11-22 — Steps 06–07 started

**Source work in progress; public production remains the tested 0.5.0 until a new deployment is verified.** User attached the first-car and cockpit/engine-sound steps and explicitly authorized transient GitHub-token authentication. The supplied token authenticated successfully as the user; its value is never saved in project files, remotes, reports or logs. Do not copy it into this journal.

Plan: keep parkour/city/choices intact; add one real-glTF Rapier raycast sedan, drivetrain/steering/entry/start sequence/four cameras/test loop, six data-selected cockpit layouts, real licensed sample preparation and hybrid Web Audio with fallback/mirrors/gauges/buses. Validate deterministic physics/audio state and actual pixels/input on both backends. Record untested physical input/audio feel and existing performance failures honestly. Build only 06–07, not the later fleet/NPC/police/radio steps. GitHub will use a private-by-default repository and a clean remote URL; only allowlisted source/assets/docs/tests are published.

## 2026-11-22 — Crosstown / Steps 04–05 handoff

### What exists

- **Crosstown** is the user-selected name; **`crosstown`** is the chosen repository name. App, chooser/HUD, package metadata, README, badges and prepared repository metadata are rebranded. Legacy save keys are migration fallbacks, not current branding. The established public URL is preserved so bookmarks still work.
- **A/D keyboard fix**, not controller A/B: corrected the camera-space right vector, checked 16 headings, and held real browser keys on both render backends. Removed movement→yaw feedback; added independent damped yaw, follow/look-ahead and interpolated runner positions, retaining collision sweeps and the liked character/world features.
- Explicit user override: beginning **Quick / Standard / Full**, control layout, sensitivity, camera feel and Auto/four-tier graphics choices supersede historical no-menu/full-default restrictions. Quick defaults to 8 checkpoints / 16 roofs; Standard 16/32; Full retains 28/64 and the full encounter catalogue. `DESIGN.md` remains unchanged.
- Fixed **4 km × 4 km**, seven-district city with ~128 m worker chunks, natural sea/ridge boundaries, connected roads/lane graph, marking/curb/crosswalk detail, ramps/bridges/tunnels/mountain roads, animated water/foam, far coverage and nearby Rapier collisions. Street walking, debug flying and a full map/connected-road waypoint are usable; exploration holds the rooftop timer.
- District-specific architecture/props, procedural facade windows, balconies/awnings/murals/signs/roof equipment, street objects/parked cars, landmarks/service lots, stunt/access structures, hidden city caches and **six actual worker-relocated rooftop starts**. Later interactive shops/driving/police are not implemented.
- Physical sun/sky, a 24-active-real-minute day, calendar-seeded clear/overcast/rain/fog, dusk windows/signs, animated water with analytical sky response and decorative traffic/boats/aircraft. Choosing/pausing/hiding freezes the environment clock.
- Earlier traversal/hazards/powers/countdown/pickups/fall penalty remain, with finish camera flight/fireworks/Web Audio swell/results/waiting-car unlock/night/ghost/bests. A waiting reward car is **not** drivable.
- Feature-preserving optimization: static street buffers baked in the worker; shared mixed mover batch rather than per-block texture-backed batches; sliced installs; 48 retired GPU-ready / 56 worker-data chunk caches; linear instance/vertex colors. Minimum instance capacities 32 buildings / 128 lights reduce small-block shader variation but do not eliminate later program waits.
- Polished **README with local badges**, real screenshot index and offline responsive gallery; detailed bug/acceptance ledger; source/asset/API/render/deployment notes; prepared issue template, checks workflow, repository description/topics and authenticated publish script.

### Executed verification — exact boundaries

| Run | Actual result / source boundary |
|---|---|
| Final typecheck, units, assets, exact dependency pins, original reference | Pass; **53/53 units**, **3/3 assets**, **15/15 pins**; DESIGN byte-identical to upload |
| Final production build | Pass, **8.72 s**; deployed output has 22 public files |
| Earlier complete city functionality | **6/6** across WebGPU / forced WebGL 2, before facade/diagnostic refinements and minimum capacities |
| Marker/cache/reset/fly landing | **2/2** across both backends, after facade/diagnostic fixes but before minimum capacities |
| Foundation and gameplay regressions | **12/12** and **7/7**, before the final minimum-capacity-only source edit |
| Final strict WebGPU district tour | **1/1**, after minimum capacities; actual anchor + 3×3 near chunks in all seven districts; rain/dusk/map route captured |
| Final local built-output tests | **6/6**, after minimum capacities; WebGPU / forced WebGL 2 / WebGPU-disabled fallback |
| Actual public-site browser tests | **5/5**, final deployed build; all three backends, full physical finish/save/ghost/night and training |
| Anonymous public integrity | **22/22** hashes match; repeated after transfer shutdown |
| Offline screenshot gallery | 12 embedded captures; desktop/mobile, no horizontal overflow or network requests; keyboard/lightbox navigation checked |

No combined fresh **8/8 city** run or final strict forced-WebGL tour is claimed. Raw logs/reports and compressed CPU profiles are saved in `evidence/crosstown-0.5.0/`; [TEST-RESULTS.json](TEST-RESULTS.json) records dates, durations, revision boundaries and failed gates. The 53 current unit tests include ordinary-KCC Quick / Standard / Full finishes (**156.3 / 331.25 / 682.433 simulated seconds**, zero falls), six physical Quick marker finishes and a no-teleport street→beach crossing (**247.367 simulated seconds**). Accelerated simulation is not real-time rendering evidence.

### Performance & visual acceptance — still open

- The **≤8 ms maximum main-thread streaming gate fails** in this environment. Final strict WebGPU tour: **79.5 ms** largest install slice / **79.7 ms** accumulated chunk CPU / **80.1 ms** whole city update; P95 slice **0.4 ms**. Outlier is labeled worker-baked decoration for chunk `6,16`; scheduling/allocation/GC/root cause is not proven. Earlier maxima are retained separately and not mixed with these metrics.
- Final forced-WebGL software profile after 20 actual warm-up frames: current **0.855 rAF FPS**, preceding retained baseline **0.862 FPS**, and about **5.25 s** sampled in `getProgramParameter`. Lower sample draw/triangle counts do not establish a controlled FPS improvement. No claim that severe lag is fully fixed.
- Actual unpaused held-W+Shift flight covered only **230.023 m / 21.233 s / 21 frames**. It is not a continuous full-map/no-popping pass. Structural far coverage and seven district visits do not replace that acceptance item.
- **No physical Radeon 840M 1080p60 validation**, physical gamepad/wheel/rumble or audible mix review. No complete touch movement joystick. City art remains repetitive/sparse at distance, with LOD noise and rough road/terrain blending; scenic blending for every relocated long course/seed remains open.
- All findings/fixed bugs/untested traversal paths and water/post-effect limitations are explicit in [FINDINGS.md](FINDINGS.md). No features were removed to meet an FPS claim.

### Publishing & handoff

- Connected **Vercel project renamed to `crosstown`**. Current production **`dpl_9oYzAnnu38B6iihCXVsVJK2M29q7`** observed **READY/PROMOTED**, aliases assigned. Public https://coastline-highline.vercel.app now serves **Crosstown 0.5.0**, not the old release.
- One-time public-compiled-output import verified **1,802,763 bytes**, SHA-256 `be7cf23cef1a7485fbf5dff76bc6d89002bbc1a94d12efb6e7adab37c9be8158`. The plain-text connector serialization failure was resolved by explicit base64 for the small transfer descriptor. No source, uploads or secrets were exposed. Transfer server/tunnel stopped after 22/22 hashes and 5/5 public tests; a subsequent hash check passes independently of them.
- Normal future source settings restored: **Vite / `npm ci` / `npm run build` / `dist`**. The retired transfer descriptor is not a redeployable source repository. See [DEPLOYMENT.md](DEPLOYMENT.md).
- **GitHub create/push is not done.** Connector lookup returned unsupported and no authenticated CLI/session is available. Description/topics/homepage/README/CI/issue form and `tools/publish-github.sh` are prepared, but no remote URL, applied server-side topics or hosted CI pass is invented. The previously exposed credential was not saved or used and should be revoked. Secure CLI authentication and a reviewed local source commit are required to publish; the script defaults to private and refuses existing repositories/remotes.
- Portable **`crosstown.zip`** includes current source/lockfile/configs, `.github`, prepared assets, tests, documentation, screenshots, durable logs/reports and its own per-file SHA-256 manifest. ZIP roundtrip/file-count/hash validation is performed by `npm run package`; root `SHA256SUMS.txt` records the final digest. Historical `coastline-foundation.zip` / `coastline-highline.zip` remain unchanged. No credentials, home-directory state, `node_modules`, `dist`, `.arena`, uploads or transfer bootstrap are included.

### Current file map

| Files | Responsibility |
|---|---|
| `src/game.ts`, `src/config/{session,actions,app}.ts`, `src/ui/session-setup.ts` | Composition/modes, user choices/preferences, branding and defaults |
| `src/player/{controller,runner,chase-camera,fly-camera}.ts` | Real KCC/animation/interpolation, corrected A/D, damped collision-safe follow and flight |
| `src/parkour/`, `src/world/{route-worker,route.worker,rooftops,bake}.ts` | Retained lifecycle/hazards/powers/finish, length-aware translated worker routes, rooftop batches/LOD |
| `src/world/city/{types,layout,generator,mesh-bake}.ts` | Fixed geography, connected roads/lanes/waypoints, district generation and transferable static meshes |
| `src/world/city/{worker,city.worker,stream}.ts` | Worker protocol, sliced installs, far coverage, shared movers/rain and bounded caches/diagnostics |
| `src/world/city/{environment,physics}.ts` | Calendar sun/sky/water/day/weather and nearby physical street/collision-safe landing |
| `src/ui/{city-hud,parkour-hud,index}.ts`, `src/save/` | Modes/map/waypoint HUD, results/marker+length bests/ghosts, cache storage/migration/reset |
| `tests/unit/city.test.ts`, `tests/browser/crosstown.spec.ts`, `playwright.city.config.ts` | Geography/input/length/markers/street/environment and actual two-backend integration assertions |
| `tests/browser/{foundation,parkour,parkour-full,parkour-training}.spec.ts` | Retained foundation/traversal/full finish/ghost/training/pixels/fallback coverage |
| `tools/profile-browser.mjs`, `docs/PERFORMANCE-COMPARISON*.json` | Warmed software cadence/startup/CPU and real-input partial-flight measurements |
| `tools/{package-project,release-evidence,make-progress-gallery,verify-deployed}.mjs` | Allowlisted source handoff, observed-evidence index, offline actual-capture gallery and public integrity checks |
| `.github/`, `tools/publish-github.sh` | Prepared metadata, CI/issue form and secure publish-after-authentication helper; **unpublished** |
| `README.md`, `docs/{SCREENSHOTS,FINDINGS,TESTING,PROGRESS,DEPLOYMENT,PARKOUR-API,RENDERER}.md` | Styled entry point, actual captures, issue/acceptance ledger, source/API/deployment handoff |
| `docs/TEST-RESULTS.json`, `docs/EVIDENCE-MANIFEST.json`, `docs/evidence/crosstown-0.5.0/` | Current results, runtime/artifact fingerprints and durable raw evidence |

### Next work / what it needs

1. **Physical target laptop**: resource-upload/allocation traces; split or reuse remaining costly construction; remove first-use program waits; repeat dense-medium 1080p and genuine full-map fast flight. The shader and outlier gates cannot be signed off here.
2. **City polish/integration**: denser low-cost distant silhouettes, less repetitive facades, cleaner LOD/terrain/road transitions and a reserved city-course footprint that preserves safe parkour. Physically walk the remaining tunnel/garage/underpass/cache access paths.
3. **Secure GitHub authentication**: only then create/push `crosstown` with the prepared description/topics. Never reuse the chat-exposed credential.
4. Continue later numbered phases **only when requested**. Drivable fleet/cockpits/engine recordings/NPCs/police/weapons/radio remain unbuilt; this handoff is Steps 01–05, not the whole reference.

---

## Historical log — earlier release facts, not current acceptance

## Log

### 2026-11-22 — Step 01: Foundation complete

**Scope:** a running, empty engine foundation. No city or gameplay has been added.

- Saved the supplied reference first as `docs/DESIGN.md`, unchanged; created this document initially with an empty log. The final reference was verified byte-for-byte against the upload.
- Scaffolded with `create-vite@7.1.1` (vanilla TypeScript), then pinned all 15 direct dependencies. Included the npm lockfile and a publication-date check/report. Run with `npm ci` and `npm run dev`.
- Read the current official WebGPURenderer manual before writing source; inspected installed Three.js 0.180.0 exports. Implemented `three/webgpu`, automatic WebGL 2 fallback, an explicit `?webgl` test path, async initialization/compilation, actual backend reporting and device-loss recovery.
- Built only the requested test environment: bright TSL sky, procedural 1 m grid ground, directional sun/shadows, rotating teal test cube and a separate falling orange Rapier body. Both are real rendered meshes, not background imagery.
- Implemented fixed 60 Hz physics, bounded catch-up and position/quaternion interpolation. Added hidden-tab clock protection, reset/impulse controls, a configured kinematic character controller and a stable-rest regression fix that rejects bounce apices.
- Added unified keyboard, pointer/touch, standard gamepad and Gamepad API wheel input; centralized action bindings; persisted rebinding and wheel-axis calibration; live debug lines and analog values; optional rumble with safe failure.
- Added four quality budgets, real FPS/frame-time telemetry and automatic hysteresis. Resolution, shadows and camera range are active; crowds, traffic and heavy-effect settings are future hooks only.
- Added validated, versioned saves with try/catch around every localStorage operation, including access itself. Blocked storage degrades safely. Reset requires confirmation and never clears other projects.
- Booted a typed fixed-seed world-worker boundary with no world generation work yet. Created every requested module boundary with a short scope comment.
- Built and tested the licensed-asset importer: URL/ZIP download and relative resources; evidence/checksums; measured bounds; +Z/Y-up uniform scaling; ground pivot; available key-node naming; mesh budget and simplification; WebP textures and Meshopt FILTER geometry/animation compression; output re-decode checks; generated credits.
- Prepared and browser-verified two CC0 fixtures: Kenney sedan at **4.5 m length / 2,032 triangles**, four named independent wheels; Quaternius RobotExpressive at **1.75 m height / 3,237 triangles**, all **14 clips** and skins retained. These fixtures are not placed into the test scene.
- Added the live non-blocking HUD, accessible Escape pause/settings, input monitor, responsive layout and source credits. Refined mobile layout so telemetry does not cover the dynamic body; mobile tests now require visible pixels from both cubes as well.
- Wrote README, renderer/asset/testing notes, `.env.example` for the deferred Spotify client ID, progress, dependency report, model reports and source/archive tooling.

**Verification:** 20 unit tests passed; 12 development browser cases passed across WebGPU, forced WebGL 2 and WebGPU disabled; 3 production-output browser smoke cases passed. No failed, skipped or flaky cases in the final runs. Production build, type check, repeated hash-pinned fixture preparation and asset checks passed. See `docs/TESTING.md` and `docs/TEST-RESULTS.json`.

**Explicit remaining validation:** 1080p/60 FPS on a Radeon 840M-class physical laptop and physical gamepad/wheel/rumble testing. This container uses software graphics; its measured FPS is retained honestly. Rapier emits one upstream initialization deprecation warning, not an application error.

**Deferred by design:** city/chunk generation and streaming, player movement, parkour, the 12-car fleet and vehicle physics/interiors/audio, NPCs, police, weapons, radio, shops/challenges and production heavy effects. Continue with the next numbered project step; do not treat the reference spec as already implemented.

### 2026-11-22 — Step 02: Opening district and movement implemented

**Scope:** playable rooftop movement, not the rest of the city/driving reference. Assumed both attached numbered steps should be built in order, with Step 03 becoming the default route and Step 02 retained for regression testing.

- Preserved the original foundation and its tests behind `?sandbox`; default boot goes straight into a running third-person player without a title, onboarding overlay or click-to-start state. Settings only open on demand.
- Built a bright instanced rooftop district with towers/window grids, roof facades, water tanks, vents, solar panels, billboards, fire escapes, clotheslines, skyline and streets below. Added street lamps/palms/curbs/crossings for the final camera flight. Fictional names and procedural geometry only; no real-world brands.
- Prepared the existing verified CC0 Quaternius character into a **402,984 B, 1.75 m, 3,237-triangle, 27-clip skinned GLB**. Preserved 14 original animations and added 13 reproducible parkour clips, with reports, hashes, license evidence and CC0 extension credits. Added a designed articulated fallback and an actual CC0 sedan reward model with procedural fallback.
- Added a real Rapier capsule/KCC with run/sprint, coyote time, buffered jump, double-jump power gate, capsule-changing slide/headroom check, ledge grab/pull-up, collision-swept vault, wall run/jump, zipline, clothesline swing and high-fall roll.
- Added a close look-ahead third-person camera using sphere/near-plane collision sweeps, movement/ghost animation, responsive timer/checkpoint/cash/minimap HUD and compact controls. Reduced-motion settings suppress the finish camera flight and reduce fireworks.
- Retained an **eight-checkpoint fixed hand-authored route at `?training`**, ending at the billboard. Normal-input unit pilot completes it without falls; the public browser training scene also renders and opens mid-run.

**Verification:** every motor action has real-KCC fixtures; camera wall clearance, five-second fall penalty, reset and first running frame have unit/browser assertions. Public desktop/mobile/training screenshots were inspected. The target **near-60 FPS** requirement remains **unverified on physical target hardware**, not silently passed.

### 2026-11-22 — Step 03: Long seeded run, finish and connected Vercel deployment

**What exists**

- Worker-generated deterministic route through **64 roofs / 28 checkpoints / 17 segment families**, with turns, increasing difficulty, safe/slow and risky/fast branches that rejoin, glowing markers and billboard beam.
- Jump distance/height calculated from the shipped gravity/jump/run settings with a safety margin. Impossible segments are rejected; wind allowances use closed-form drift from the actual damped external-velocity motor, not an arbitrary visual constant.
- Streamed Rapier rooftop/slab/prop colliders, moving/tilting platforms, delayed falling/recovering ledges, swinging crane colliders, rolling-ball/laser/drone knockback and lateral gusts. No damage/death from knockback; falls return to the checkpoint for **5 seconds**.
- Generous countdown, +20-second time pickups, same-seed timeout reset, new-seed control, risky-branch coins, double jump/slow motion/speed/magnet powers with ten-second HUD bars.
- Reusable `ParkourRun` lifecycle/events for future city markers. Host rendering/audio/HUD are listeners; tests can run simulation without Three.js rendering.
- Finish camera flight/fireworks/original Web Audio music swell, compact C–S results, visible waiting sedan/glowing arrow, harder night unlock, best-run ghost, best times per seed and per marker. Real browser storage persistence/reload and blocked-storage degradation verified.
- Deployed through the connected Vercel app to **https://coastline-highline.vercel.app**, deployment **`dpl_AN77CJEBLkcpMBdFDmVyJ2Xgq1c9`**, state **READY/PROMOTED**, aliases assigned. Public main alias returns 200 without authentication; account-protected preview aliases intentionally remain unchanged.
- Connected deployment used a checksum-pinned **public compiled-asset** archive because the connector lacks a binary upload tool. The builder verified SHA-256 `f60ed9bee555d55d1d62447222f04f47fb12f0a2146e18296791b4f686346c94`; all 21 public files independently hash-match. The temporary transfer server/tunnel have been stopped; production is fully stored/served by Vercel.
- Refreshed source packaging, README, testing/renderer/asset notes, city integration API and deployment instructions; original `coastline-foundation.zip` and unchanged DESIGN are preserved. The current archive is `coastline-highline.zip`, with its own checksum.

**File map**

| Files | Responsibility |
|---|---|
| `src/main.ts`, `src/game.ts`, `src/foundation.ts` | Default game / query routing; renderer-worker-player-audio-HUD composition; retained foundation |
| `src/config/movement.ts`, `src/config/actions.ts` | Motor/ballistics/wind envelope; shared remappable keyboard/gamepad controls |
| `src/player/{controller,runner,chase-camera}.ts` | KCC and traversal; glTF/ghost/interpolation/fallback; camera collision and finish flight |
| `src/parkour/{ParkourRun,generator,physics,hazards,bot,types,index}.ts` | Lifecycle/events/timer/powers/finish, seeded validation, nearby collision streaming, hazard poses, ordinary-input test pilot |
| `src/world/{route.worker,route-worker,rooftops}.ts` | Worker protocol; instanced district/props/hazards/pickups/reward/fireworks/night |
| `src/audio/parkour-audio.ts`, `src/ui/{parkour-hud,parkour.css}` | Original Web Audio buses/effects/music; HUD/settings/results/minimap |
| `src/save/parkour.ts` | Versioned guarded seed/marker bests, cash/unlocks, bounded ghost recordings |
| `public/models/parkour-runner.glb`, `tools/prepare-parkour-character.mjs`, `docs/assets/parkour-runner.*` | Reproducible licensed 27-clip runner, actual decoded dimensions and checksum report |
| `tests/unit/parkour.test.ts`, `tests/browser/parkour*.ts`, `playwright.{parkour,production,deployed}.config.ts` | Real-physics acceptance, browser wiring/pixels/full-run/persistence and public deployment verification |
| `tools/simulate-parkour.ts`, `docs/PARKOUR-SIMULATION.json` | 24 complete normal-pace physical pilots and per-seed jump checks |
| `tools/verify-deployed.mjs`, `docs/DEPLOYED-FILES.json`, `docs/TEST-RESULTS.json`, `docs/evidence/` | Anonymous production file-integrity proof, durable passing logs, inspected screenshots and measured (software-only) states |
| `README.md`, `docs/{TESTING,PARKOUR-API,DEPLOYMENT,ASSET_PIPELINE,RENDERER}.md`, `vercel.json` | Setup/controls/scope, evidence/limitations, integration and normal future source deployment |

**Final verification**

- **40/40 unit tests**, **12/12 retained foundation browser regressions**, **7/7 development gameplay browser cases**, **6/6 local built-output browser cases**, **5/5 actual public-site browser cases**. WebGPU, forced WebGL 2 and WebGPU-disabled fallback all render actual model/geometry pixels. Retries disabled in passing browser runs.
- **24/24 complete ordinary-input safe-path pilots**, every KCC step at 1/60 s and 6.5 m/s: **665.75–682.433 simulated seconds**, zero falls. The main public browser pilot completed in **682.483 simulated seconds**, with rank A, 0 falls, 15 collectibles; its actual saved result, ghost, night unlock and reload persistence passed. Accelerated test simulation is not a real-time rendering benchmark.
- Production build/typecheck, all three asset checks and publication-date audit pass. All 21 deployed files return anonymous 200 and match the verified build hash. `docs/DESIGN.md` is still byte-identical to the upload.
- Fixed real acceptance failures before completion: elevated safe-ramp facade collision, huge crumble-recovery carry impulse, and a water-tower collider blocking checkpoint 21. Moved architectural props out of the safe corridor and reran all 24 full pilots. A training browser timing assertion was synchronized to the next input frame; the final five-test public run is clean.

**Known issues / not claimed**

- **No physical Radeon 840M-class 1080p/60 FPS validation**; software renderer gameplay captures measured roughly 1–3 FPS. Runtime and initial physics-construction timing are reported separately; neither proves target-device streaming performance. No physical gamepad/wheel/rumble or audible mix review.
- All full route pilots choose safe branches. Isolated movement/hazard fixtures and ballistic checks do not replace an exhaustive human playthrough of every risky branch, animation transition or camera pose. Mobile layout is responsive but has no complete touch-only movement joystick.
- Audio starts after a genuine browser gesture without a start screen. Rapier's upstream initialization deprecation warning remains. KTX2/production LOD catalogue, volumetric fog/SSR/motion blur are not implemented.
- The car is a model and unlock, not drivable. The full fixed city, six physical city start markers, vehicle gameplay/fleet/interiors/engine samples, traffic, pedestrians, police, weapons, shops, driving challenges and radio are outside the two attached steps.
- The first thin Vercel deployment's temporary transfer URL is intentionally retired. Future deployments must send the included full source using standard `npm ci` / `npm run build` / `dist` settings, already restored on the project, not redeploy just that old one-file transfer source.

**Next step needs:** a physical target-laptop/controller/audio pass and human risky-route playtest; then city/start-marker and vehicle-entry integration using `ParkourRun` events and saved car unlock. Preserve the safe-path pilots and foundation regressions while adding streets/driving. Follow the next numbered scope rather than implementing the entire reference at once.
