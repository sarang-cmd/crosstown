# Crosstown — findings & bug ledger

**Recorded 2026-11-22 · source 0.9.0 / 09.001 · Steps 01–09 prototype.** The public address is now https://crosstown-sarang-dev.vercel.app; [DEPLOYMENT](DEPLOYMENT.md) records its verified build. This is not a claim that the whole reference is finished. [DESIGN](DESIGN.md) remains byte-identical. Exact completed runs and revision boundaries are in [TESTING](TESTING.md).

## Current release gates

| Gate | State |
|---|---|
| Earlier foundation/parkour/city, explicit choices and keyboard A/D correction | Retained; current real-physics and both-backend regression results are indexed in TESTING |
| Twelve independent cars/bikes, class cabins, loop handling, audio profiles | Implemented; all twelve physical loops and model/sample/cabin browser checks; not a human handling/listening sign-off |
| Six stored VINs / reload / paint / physical damage-fire-wreck / recovery | Implemented; real UI and physical collision checks on both renderers |
| Physical parkour reward in garage + street, no duplicate live VIN | Implemented; ordinary-input physical finish, store/retrieve/reload browser checks |
| Road traffic / animated pedestrians / legal crossings / crash+siren / night / adaptive density | Implemented; pure, shared-physics and actual-wall-time evidence are deliberately separate |
| Strict “no stuck cars” / fairness | **OPEN**: raw stopped waits of ~78 s loaded / ~119 s pure planner; some queues span signal cycles |
| Busy Balanced / ten near cars / near60 FPS / Radeon840M 1080p60 | **NOT ACCEPTED**. Software rendering remains very slow; the user's lag report is not considered solved |
| Human handling/audio, real controller/wheel/rumble, seating/social alignment | **Not accepted**; virtual/numeric checks are not human or physical-device proof |
| Maximum streaming ≤8 ms / continuous-map no-stall/no-popping | Historical failed/open gate; 0.5 strict tour 79.5 ms install / 80.1 ms update; no new full-map sign-off |
| GitHub / production | Existing private repository is not pushed; no hosted CI. Public site and anonymous build hashes are independently checked; see DEPLOYMENT |

## Steps 08–09 defects fixed and verified

| ID | Finding | Correction / evidence |
|:--|:--|:--|
| F-001 | Quantized/normalized glTF coordinates were transformed as raw integers in shared traffic geometry | Decode attributes to Float32 before world-space baking; immutable-source bounds/wheels/geometry units and all twelve rendered models |
| F-002 | Wheel groups contained multiple children/alloys with their own transforms | Preserve every child and bake its own world transform; independent resource/geometry assertions |
| F-003 | Nonzero AWD engine drag selected Rapier's engine-force path and bypassed service brakes | Zero engine force while service/handbrake friction is active; all three AWD brake regressions and all-twelve straight tests |
| F-004 | NPC brake-to-rest could select player-style reverse | NPC engines explicitly disallow reverse; player automatic reverse is retained |
| F-005 | A newly created contact-ready takeover chassis had deferred mass/inertia zero; its first wheel update could inject NaNs and poison WASM | Recompute mass properties before creating/using the controller, with **no extra world step**. All twelve finite-mass/no-hidden-step regression and repeated six-takeover browser runs. The later WASM recursion error was fallout, not proven concurrency |
| F-006 | Workshop DOM mounted before its HUD host; nearest-service state could be stale after a move | Mount after the HUD and synchronously check the real street/car anchor at interaction time; both-backend six-car/paint/recovery UI cases |
| F-007 | Retiring a takeover could use a stale captured physics proxy | Look up and dispose the current proxy; clear observer/external-nearest hooks on disposal; ownership/controller-count units |
| F-008 | Only the striking car took damage when a stationary parked/NPC chassis was hit | Use pre- or post-contact speed for the actual impulse threshold. Real shared-world collision: both chassis damaged, 80 contact samples, braking and one evasive lane change; unit regression |
| F-009 | Storage/recovery/reward ownership needed a single authoritative VIN | Stored cars leave the street, retrieval replaces any matching live VIN, exit/save precedes recovery repair, and reward is granted once; six-slot reload and physical-finish browser cases |
| F-010 | Severe multi-second frames were discarded by quality/density monitoring | Record true frame cadence and cap only hysteresis time; adaptive density and Auto are observed separately from forced-budget stress checks |
| F-011 | r180 route recompilation reused a null sampled-texture binding for a fresh finish-billboard `.map` material, despite its node value containing the right texture | CDP exception/16 × 7 m billboard probe; own a direct TSL texture node, preserving full compile. Retained entry/reward/restart browser cases now pass on both renderers |
| F-012 | Opening the lab asynchronously could undo Escape pressed during its shader compilation | Resume the originating pause before compile; preserve subsequent user pause state. All four retained vehicle/cabin/audio/mirror cases pass after correction |

The initial wall-watch attempt was intentionally interrupted when the stationary-contact fix triggered development HMR. Its log is retained as **interrupted, not acceptance**. Final timed observations are separate named reports. Sampling uses an independent slightly inset rectangle SAT; it is not exhaustive swept-contact auditing of every intersection/seed.

### Traffic and population boundaries

The conservative 80-second signal has long all-red pedestrian clearance. Zero sampled overlaps/red entries/illegal crossings in a soak does not establish fairness; the raw maximum stop is always reported. Age-qualified starvation checks use **actual observed agent duration**, not time after an agent is born or retired. In the forced Balanced two-wall-minute run, severe software FPS advances less than thirty simulated seconds, so **no agent qualifies for that 30-second starvation test**. The separate loaded 120-simulation-second soak is necessary and is not misrepresented as smooth real-time play.

Pedestrian chat is adapted greeting and flee is a retimed run. Bench placement, body/seating alignment, car-entry transitions and social believability remain prototype-level. Near models/capsules and far stand-ins are bounded, but a long memory/GPU-resource soak and broad route/seed stress are still needed.

## Vehicle defects fixed and checked

| ID | Finding | Change / evidence |
|:--|:--|:--|
| V-001 | Naive waiting-car placement could be inside folded-back course buildings, hiding the street-entry prompt | Search outside all course footprints, use clear city lanes or shared physical central forecourts; streamed placement/door/walking units + real E-key browser entry |
| V-002 | Free-rev automatic shifting cascaded through gears | Wheel/engine RPM coupling and shift timing; real straight/loop units and keyboard drives |
| V-003 | Teleport/recovery retained old speed/rack/contact state, blocking immediate exit | Reset cached telemetry and previous state; immediate exit-lock regression and real E-key browser exit |
| V-004 | Cockpit screen could show stale gear while deterministic physics was paused | Keyed instrument redraw; screenGear matches physical readings across all six cabins |
| V-005 | Capture pause overlays obscured instruments, and raw mirror target checks missed upside-down on-screen sampling | Per-capture DOM hiding, actual screen-material upper/lower color fixture, vertical UV correction on both backends; clean final mirror screenshots |
| V-006 | Shallow glTF materials/textures could be disposed by multiple car/route owners | Per-car material/texture copies, owned-root rooftop cleanup, idempotence and disposal event units; bounded restart/re-entry browser state |
| V-007 | Glowing reward arrow initially copied the old parking x/z | Follow relocated route.carPosition on updates; ownership/arrow unit and actual reward browser assertions |

Remaining vehicle acceptance: **physical device/rumble, human handling and by-ear mix**; near60 FPS; more polished cabin/person models and independently measured multi-load recordings. Budget definition is 16 engine emitters plus a separate 16-one-shot cap, not a 16-node global audio graph. A long GPU-memory soak is not claimed by the lifecycle checks.

## Earlier city defects fixed (retained)

| ID | Bug / finding | Change and evidence |
|---|---|---|
| C-001 | Keyboard A/D reversed in chase-camera space | Corrected screen-right basis at all headings. No controller A/B remap was substituted. `ChaseCamera.movement`; city unit + real browser held-key tests |
| C-002 | Strafing changed the camera heading and fed back into movement | Independent damped desired yaw/pitch; no facing-to-yaw feedback; look-ahead and interpolated runner/camera positions. Held A/D leave yaw stable. Subjective feel still needs human review |
| C-003 | The only normal route was an excessive commitment | Explicit user override to historical no-menu/default-full behavior: Quick default, Standard and unchanged full option. Primary normal-input pilots: 156.3 / 331.25 / 682.433 simulated seconds; zero falls |
| C-004 | Synchronous city construction and a texture-backed BatchedMesh per block caused allocation/setup overhead | Worker-baked vertex-colored decoration, measured sliced installs, one shared moving-geometry batch, bounded CPU and GPU-ready reuse. Every decorative source record is retained; no feature was deleted to improve the numbers. Budget still fails at outliers |
| C-005 | City colors looked bleached | Worker RGB values were sRGB but instance/vertex attributes expect linear values. Added proper conversion; `#808080` becomes approximately 0.21586 linear. Refreshed beach/Old Town screenshots show the corrected palette |
| C-006 | A city marker changed only the score namespace | Whole-course worker placement now moves roofs, spawn, checkpoints, jumps, interactions, hazards, pickups and directions. Quarter-turn placement prefers land bounds. All six Quick pilots finish using normal KCC input with no falls |
| C-007 | Fly-to-street could drop inside solids or fall from an arbitrary 160 m height | Populate nearby collision data, probe local surfaces from above roofs, and place safely on the actual hit. Real Rapier probes include inside-building and above-roof cases |
| C-008 | Confirmed save reset omitted hidden city caches | Reset now clears `crosstown:city:v1` along with settings, preferences, results and legacy keys. Other applications' storage is untouched |
| C-009 | A slow renderer lengthened the day cycle | Environment advances by elapsed wall time, frozen while choosing/paused/hidden. One day is 1,440 real active seconds; fixed simulation catch-up is not used as a real clock |
| C-010 | Browser A/D check sometimes injected input while the chooser/rebuild was still closing | Test waits for `choosing=false`, then resets and holds actual keys. Clean subsequent runs pass; this timing fix alone was not treated as proof of a separate runtime defect |
| C-011 | Tour readiness could observe the previous camera anchor and prematurely capture the next district | Added anchor coordinates and a location-specific readiness predicate. Earlier captures/state snapshots are preserved. A center-loaded or far-coverage flag by itself is not detail-readiness proof |
| C-012 | Short city-start buildings could show window/fire-escape floors above the roof | Facade floor loops stop below the actual roof height; the rooftop props/traversal features remain |

## Open issues and unaccepted items

**Measurement boundary:** the detailed city performance/tour figures in P-001–P-006 below are retained **0.5 observations**, not new 0.9 benchmarks. Their failed/open gates have not been silently converted to passes. Current 0.9 evidence and software diagnostics are indexed in TESTING.

### Current 0.9 software diagnosis — lag remains unresolved

The final isolated-process diagnostic completed all three scenes, exit 0, with runtime/console errors `[]`: **1.121 FPS roof, 1.085 FPS downtown street, 1.823 FPS cockpit lab**, at 1280×800, fixed Balanced, population **off**. Exact cadence/CPU/snapshots are retained in `evidence/crosstown-0.9.0/profile-0.9-final.json` and three `.cpuprofile.gz` files. These results are visibly slow, not a pass or an advertised speedup. Program/uniform-query waiting remains in roof/street samples; GPU/driver stalls and browser scheduling require target-hardware tracing before assigning a sole cause. Turning off population alone does not resolve the observed software cost.

A shared-browser attempt completed only the roof at 0.921 FPS and timed out initializing page two after 180 s. Its bounded failure/partial profile remain separately named `profile-0.9-final-shared-browser*`. The completed runner uses a fresh Chromium process for each scene and awaits lab compilation explicitly, so it is **not a strict matched historical A/B comparison**. Populated two-minute observations separately remain 1.859 FPS fixed Balanced / 2.461 FPS Auto with adaptive density reduction. Native busy-city/ten-car near60, long no-stall flight and the user's lag report remain **OPEN**.

### P-001 · High · Performance target and streaming outliers

The latest strict WebGPU city tour passed its functional assertions, **not** the performance budget. All seven captures waited for their actual camera anchor and 3×3 nearby chunks. Final tour observations:

- maximum individual installation slice: **79.5 ms**;
- maximum accumulated per-chunk installation CPU-wall time: **79.7 ms**;
- maximum whole city update: **80.1 ms**;
- P95 individual installation slice: approximately **0.4 ms**.

The final 79.5 ms outlier is labeled `worker-baked-decor` for chunk `6,16`. Earlier runs also recorded terrain/road buffer setup outliers, including 61.3 ms terrain setup during profiling. These wall times include browser/OS scheduling and allocation effects. It is **not established** that scheduling, garbage collection, GPU allocation or any one of them is the sole root cause. A nominal 1.5 ms scheduler cannot preempt a synchronous operation already in progress.

Follow-up: worker-supplied bounds, reusable buffer/geometry arenas, resource-upload tracing and physical-laptop profiling; then repeat continuous flight and the densest district at 1080p/Balanced. Do not hide outliers behind an average/P95 or claim the gate passes.

### P-002 · High · Cold shader work and startup

The first software-only profiling attempt warmed with an arbitrary seven-second wait. It still sampled approximately **11.35 seconds in WebGL `getProgramParameter`**, indicating first-use shader/program waiting inside the sampled interval. That attempt is preserved as `PERFORMANCE-COMPARISON-first-pass.json` and is **not a reliable steady-state before/after benchmark**.

Boot now precompiles visible and hidden material variants, including a representative road/building block, rain and ghost. The reproducible profiler warms actual display frames and records ready time separately. Completed measurements are in [PERFORMANCE-COMPARISON.json](PERFORMANCE-COMPARISON.json). Installed r180 `InstanceNode.js` uses an array sized by instance capacity for small UBOs; city buildings/lights now use minimum capacities of 32/128 while drawing their actual counts. This reduces small-block size variability (larger counts can still vary), **but the final sampled interval still spends about 5.25 seconds in `getProgramParameter`**. Other first-use variants/waiting remain unresolved; no stall-free startup claim.

Final software-only observations, not a speedup or hardware claim:

| Scene | Unpaused rAF cadence | Draws / triangles at sample | Ready wall time |
|---|---:|---:|---:|
| Old 0.3.0, full course, Balanced | 0.862 FPS | 163 / 229,460 | 3.337 s |
| Crosstown 0.5.0, full course + city, Balanced | 0.855 FPS | 82 / 198,256 | 3.865 s |

The old baseline is retained from the preceding warmed run. Each scene warmed 20 display frames; scenes and scheduling differ. The lower draw/triangle counts do **not** establish improved end-to-end FPS. A real W+Shift unpaused flight covered only **230.023 m in 21.233 wall seconds**, about **0.989 rAF FPS**; it is not a full-map flight acceptance pass. App ready/first-render timings (2.909 / 3.022 s) are separate from all-chunks readiness and from later shader waiting.

### P-003 · High · City art and LOD quality are not final

Inspected real captures show improved color, balconies/awnings/roof equipment, coast/water and lit night windows. However, large grid blocks remain sparse, distant volumes/window grids are repetitive, LOD hand-offs can show stochastic roof/detail noise, and some far steep road sections read as detached/buried strips. District topology/palette/height differences do not equal a polished final art pass. Full graphical Step 05 acceptance is **open**.

Follow-up: differentiated low-cost distant silhouettes/facades, better block infill, road/terrain blending and closer street-level capture/playtest. No fake concept images or removal of existing character/world features are an acceptable substitute.

### P-004 · Medium · City-start route blending

All six marker positions are real roof locations, and their courses now start there and complete under the real parkour KCC. The parkour collision stage remains separate from the street stage by design. A relocated course can visually overlap unrelated fixed city buildings or terrain, especially long routes at district boundaries/hills. Full-route scenic blending at every marker/seed is **not accepted** by the six Quick simulation pilots. Preserve the safe route while adding an explicit reserved/merged city-course footprint.

### P-005 · Medium · Feature traversal coverage

A real KCC walk from the opening street to the beach and a browser bridge crossing pass. Unit landing probes and browser marker/cache checks complement them. These are not exhaustive walking tests of every ramp, tunnel, parking garage, underpass, slope, edge fence, alley or hidden-roof access path. Some features are procedural architecture, not later police/vehicle gameplay. No complete risk-branch human playthrough has been performed.

### P-006 · Medium · Water and weather limits

Water uses real animated geometry, shader ripples, analytical sky/Fresnel color response and shore foam. This is **not** a scene-reflecting planar mirror, SSR or ray-traced reflection. Calendar weather/dusk switching is deterministic and tested. Rain is lightweight instanced streaks, not a complete splash/wet-reflection system; volumetric fog, motion blur, SSR and production bloom are not implemented. Quality-tier metadata for future effects is not counted as shipped effects.

### P-007 · Validation · Hardware, audio and touch

No physical Radeon 840M laptop, gamepad, wheel or rumble device is available. The twelve roster profiles derived from six recordings, retained RPM sweeps, actual fallback/output RMS, virtual controls and saved gain buses are tested numerically; no hands-on audible mix or handling review. Low-poly cabin/person studies are not final realistic art. Touch driving buttons/look exist, but a complete touch-only on-foot movement joystick is absent. Rapier's upstream WASM-init deprecation warning remains visible and is not suppressed as an app error.

### P-008 · External · GitHub source push

The **private** [sarang-cmd/crosstown](https://github.com/sarang-cmd/crosstown) repository, ID **1467794178**, was created with explicit user-authorized transient authentication; ten topics were applied. The credential was not saved. Connector lookup reports unsupported, and no current securely authenticated CLI/token environment is available, so the **source push is still pending**. No local commit or hosted CI result is invented.

The updated publisher checks the existing exact owner/ID/private state, matching clean origin and clean reviewed `main`, then performs a normal non-force push. It never creates/deletes a repository or changes visibility. The current Vercel deployment is independently verified compiled output, not a GitHub push or remote source build. [Details →](DEPLOYMENT.md)

## Measurement generations — do not mix these columns

| Evidence | What its maximum means | Recorded maximum |
|---|---|---:|
| `CITY-BROWSER-STATES-before-slicing.json` | Whole synchronous chunk install | 140.7 ms |
| `CITY-BROWSER-STATES-before-worker-bake.json` | Largest generator step; whole update separately | 65.6 ms step / 81.5 ms update |
| `CITY-BROWSER-STATES-before-shared-batch.json` | Worker-baked but per-block batch; largest step / update | 68.7 / 69.1 ms |
| `CITY-BROWSER-STATES-before-fixed-capacity.json` (shared batch tour) | Largest step / accumulated chunk / whole update | 21.3 / 22.1 / 21.9 ms |
| `CITY-BROWSER-STATES.json` (strict final WebGPU tour) | Largest step / accumulated chunk / whole update | **79.5 / 79.7 / 80.1 ms** |
| `PERFORMANCE-COMPARISON.json` (final forced-WebGL partial flight) | Largest step / whole update | 12.2 / 15.9 ms |

The exact values and phase samples live in JSON. Later reruns can have different maxima; they do not erase earlier outliers. The original paused software baseline (`PERFORMANCE-BEFORE.json`) is **not an FPS benchmark**. Accelerated physics test pilots and screenshots also are not FPS measurements.

## Scope, assets and safety

- Requested Steps **08 and 09** add twelve independent vehicles, damage/garage/paint/recovery and bounded traffic/pedestrians while retaining **01–07**. Weapons, police, driving challenges, deep radio and non-garage/paint commercial shops remain future scope.
- Original reference and historical 0.3.0 reports/archives are preserved. The new chooser is an explicit later user override, not an undisclosed edit to DESIGN.
- New city geometry, street objects, boats and aircraft are independently designed procedural fallbacks; no missing download boxes or external real-world brands. Bundled CC0 models, CC0/CC-BY engine recordings, OFL fonts and third-party software retain their licence evidence in CREDITS and `docs/assets/`. Recording RPM/load anchors are designed derivatives of lossy previews, not calibrated captures.
- Exact npm dependencies remain pinned and date-audited against 2026-11-22, with a 2026-11-08 cutoff. No secret is placed in the source archive, public build, screenshots or repository metadata.
