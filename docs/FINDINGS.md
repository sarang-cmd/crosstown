# Crosstown · findings and acceptance limits

**0.14.0 / 14.002 · 22 November 2026 · Steps 01–14 prototype.** Implementation, executable observations and acceptance are different things. [Results](TEST-RESULTS.json) · [Reproduction](TESTING.md) · [Handoff](HANDOFF.md) · [Lighting](LIGHTING.md). The previous release's observations remain in [FINDINGS-0.13.0.md](FINDINGS-0.13.0.md).

## 1. Native 1080p60 / reported gameplay lag is not solved

This sandbox provides **SwiftShader software graphics and virtual CPUs**, not a Radeon 840M-class integrated GPU. Actual display intervals, not accelerated simulation, are measured at a 1920×1080 viewport. Low/Balanced internally render 1344×756 / 1632×918; High/Ultra render 1920×1080, DPR 1. The target remains unaccepted: software timings cannot validate native integrated-GPU performance.

The corrected busy-v3 frozen 0.13 Balanced baseline requests 60 cars/120 people, verified **Downtown**, rain, 18:15, three stars, helicopter and **four physical ground police**, with nine nearby chunks before and after. It observes **0.797 FPS**, 10 intervals over 12,549.5 ms, p50 **1,350.0 ms**, p95/max **2,483.2 ms**. Earlier nominal-downtown v1/v2 samples were actually Old Town after road-point interpolation; an Ultra setup there stalled before timing and the batch was stopped. Those attempts remain retained, not qualified as the requested location. The still-earlier 0.13 stars/heli sample also had zero physical ground police. [Current tier results and file map](PROGRESS.md) retain actual candidate intervals, counts, resolution and costs rather than replacing them with a target.

Verified cost controls preserve the city/gameplay: conditional 1/16-pixel post targets, no disabled optional shader branch/samples, bounded particle pools and six-nearest-car lighting, no per-lamp point-light swarm, texture-free luminous instances, shader windows, 512/1024/1536 shadow budgets, reduced refresh on Balanced, lazy/disposed mirrors, stable matrix backing and the existing bounded worker queue/transfers/resumable installation/LRU. These are structural savings, **not an isolated native FPS improvement claim**. The whole revision bundles shadow/detail/effect changes; older and new renderer-counter boundaries also differ.

Main-thread phase timers measure submission-side CPU elapsed time. Worker work, queue/delivery and roundtrip values include scheduling and are not synchronous main-thread blocking. Resource arithmetic covers scene-owned payload estimates, not driver residency, hidden caches, retired roots or measured overdraw. Native GPU time, bandwidth/overdraw and actual VRAM still need target-device tools. Some install slices exceed 8 ms: maximum-stall/no-popping and continuous-map acceptance remain open.

## 2. Lighting correctness and disabled-cost boundaries

Fourteen optional effects change actual isolated pixels on **both backends**. Real built-game checks separately cover windows, mirrors, car light/rain eligibility, saved settings/reduced motion, physical wall-impact sparks, city neon and resize/garbage collection. Final inspected windows-on/off images have the correct state labels; backend captures agree in broad composition. Final lighting reports contain no runtime/network errors and only the two existing Rapier deprecated-init warnings per backend, not the initial undefined-blending warnings.

Initial silhouette-copy shafts and marching-gap SSR were rejected. Filtered quarter-resolution shafts and soft-confidence rough SSR replace them; their earlier captures/failures are preserved, not relabelled as final passes. An initial WebGPU collector failed with a generic 404; explicit favicon and URL/status instrumentation preceded the clean final collectors. No browser report proves the absence of every possible visual glitch.

**Approximation limits:** SSR cannot reflect off-screen objects and can fade/soften at edges; camera blur is not per-object velocity blur; fog is an eight-sample single-scatter height approximation; head/brake cones and pools are not fully shadow-occluded volumetric spotlights. A six-nearest-car lighting budget and particle caps are visible quality compromises. The busy-scene captures also show overlapping near light/searchlight pools washing out some sidewalk highlights on both backends. Final highlight/art tuning is not accepted. Broad human art direction, moving-camera coverage and physical-device acceptance remain open.

**Off** removes corresponding optional graph branches/lookups, auxiliary targets/draws, effect-specific uniform updates, meshes/materials/particles/uploads and live mirror targets. Disabled lamps/neon dispose render objects even for retired roots; static generated records remain cached. The shared HDR beauty/grade/depth buffer, policy checks, original geometry/window pattern and static mirror housings remain. Literal zero total CPU/GPU cost or nanosecond-identical timing would be false. Short repeated toggles are not long-soak leak freedom.

## 3. Earlier features and provider gates remain

Landing `/` remains outside the engine; `/play` is immediate saved/default Quick, explicit setup/full and legacy queries remain. Saves, twelve cars/bikes, parkour, weapons/police, activities, sound and radio are retained. Full units, retained production pixels, both-backend city-life phases, activities and responsive landing were rerun. Historical full fleet/traffic suites remain explicitly historical rather than newly claimed whole-city coverage.

The current actual radio fixture has **five passing core rows and two failed-or-unavailable official-player rows**, without mocked providers/runtime exceptions. Local procedural stations and actual DE HTTPS Radio Browser stream progression/change pass. Official YouTube/SoundCloud PLAY and subsequent playing-title change are not established; inspect each current row's failure, rather than treating metadata, ready state or a successful `play()` return as playback. The previous run's YouTube error 2 remains historical, not a fabricated current result.

Spotify has no supplied client ID/Premium/allowlisted session; authenticated import/playback remains untested and no SDK/source appears without ID. Current endpoint compatibility and approval for synchronization with game visuals remain separate gates. Keep it disabled without the required authorization. [RADIO.md](RADIO.md). Browser progression/scheduling is not human listening.

## 4. Retained gameplay/soak limits

- Debug positioning, initial saves/wanted/density and accelerated fixed-step physical pilots are disclosed. Normal pedal/steering integration and actual rewards/collisions are tested; human handling, a manual waypoint-follow drive and normal-player garage sight-break escape still need review.
- Strict traffic no-stuck/fairness remains open. Earlier soaks saw raw stopped waits of **118.65 / 78.183 simulated seconds** despite no sampled overlap/red-entry/crossing violations. Preserve those waits and broaden occupied-car/intersection coverage.
- Human driving/audio, physical controller/wheel/rumble and complete touch-only on-foot controls are not accepted. Browser vibration is not native force feedback. Ninety-six roster loops are designed derivatives of six licensed field recordings, not twelve calibrated independent recordings.
- Pedestrian alignment/social/seating and low-poly art remain prototype-quality. No exhaustive risky-route/world traversal, continuous full-map no-popping or long driver-memory soak is claimed.
- Original DESIGN and historical fixed-name ZIPs/captures remain intact. The private repository is unpushed; no hosted CI success is claimed. The **local 0.14 candidate is not the published 0.13 deployment**. [Public state](DEPLOYMENT.md).

## Next work, in order

1. Capture native target-laptop frame/CPU/GPU traces in the qualified rainy-dusk pursuit and five-rival race; fix the largest measured cost without deleting content, faking cadence or presenting reduced internal resolution as native 1080p.
2. Review all lighting/effects on both real backends in motion, screen-edge SSR/cuts, long toggling and memory/streaming behavior; then human driving/drift/stunt/audio/device sessions.
3. Test actual official-player playback and observed track changes in a permitted environment. Use authenticated Spotify only with account/API/terms authorization.
4. Expand long traffic fairness/occupied-car and streaming/driver-memory coverage. Preserve failed attempts and raw outliers.
