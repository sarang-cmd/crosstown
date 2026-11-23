# Crosstown · findings and acceptance limits

**0.13.0 / 13.001 · 22 November 2026 · Steps 01–13 prototype.** Implementation, executable checks and acceptance are different things. [Current results](TEST-RESULTS.json) · [Reproduction](TESTING.md) · [Handoff](HANDOFF.md). The previous release's observations are preserved in [FINDINGS-0.9.0.md](FINDINGS-0.9.0.md).

## 1. Reported gameplay lag is not solved

The new `/` is a lightweight responsive landing, with no Three.js/Rapier/game scene downloads before Play. That improves the **landing/loading boundary**, not the playable scene's frame rate. `/play` still starts the saved/default run immediately; earlier game-query URLs remain valid.

Two measured rendering changes preserve the city, full routes, actors and gameplay:

- Moving instanced groups retain 1,024-capacity matrix buffers while using the exact live draw count. This removes sampled buffer-resize shader churn; the first isolated software comparison did **not** establish an FPS gain from that change alone. PCF shadows remain; the Basic-shadow experiment was rejected.
- Analytical shoreline/canal water replaces a dense 18,432-triangle surface with **3,360 triangles** (−81.77%). The interpolation/up-normal/winding/finite regression tests bound its visual error. In matched, stationary **population-OFF software** scenes, the water revision shows modest cadence gains. There are whole-scene WebGPU draw-count differences, so do not attribute every timing change solely to water.

| Earlier matched software scene | WebGL 2 FPS before → after | WebGPU FPS before → after |
|:--|:--|:--|
| Rooftop | 1.217 → 1.336 | 1.105 → 1.143 |
| Coast | 2.446 → 2.683 | 2.300 → 2.495 |

Raw reports: `evidence/crosstown-0.13.0/water-comparison-{webgl,webgpu}.json`. These comparisons predate final activity/model changes; they are not newly measured whole-release native benchmarks.

Final actual-display software observations are **2.053 FPS** in the three-star/heli-state scene and **1.438 FPS** with five active physical rivals (requested locked population 60 cars/120 people, errors `[]`). **The first fixture has zero physics-enabled ground police at both endpoints, so it is not a qualified active ground-pursuit load.** Full state/counts and intervals remain in `populated-performance-webgl.json.gz`; they are summarized rather than embedded a second time in TEST-RESULTS. Neither result establishes a native FPS pass or a lag fix.

**OPEN:** near-60 FPS on native target hardware, a three-star pursuit, five physical race rivals, ten near cars, busy Balanced streets, long GPU-memory soak, maximum ≤8 ms chunk stalls, and continuous-map no-stall/no-popping. Accelerated fixed steps, a quality/density fallback, or a small triangle count do not meet those gates. Profile on the actual target laptop before advertising a lag fix.

## 2. Provider support is not proof of playback

Four original procedural stations and actual HTTPS Radio Browser streams are exercised without mocked providers. Saved reports distinguish real media time/events from selected/ready states. These are browser observations, **not human listening**.

- The final tested public YouTube playlist receives **official error 2**; the SoundCloud set reports metadata but **no observed PLAY** in this environment. The underlying provider/parameter/availability cause is not established. Official visible IFrame/Widget integration, link parsing, controls and failure hiding exist; inspect the latest `radio-provider-acceptance.json` rows. **Playback and skipping on those providers are not accepted merely because an API is ready or a method returns.**
- Spotify has no supplied client ID/Premium account/allowlisted session, so authenticated import/playback remains untested. No SDK loads and no source is offered without a configured public client ID. No client secret is used.
- Spotify's current endpoint/permission compatibility and approval for use with game visuals are separate gates. Keep it disabled on the public build unless the use has the necessary approval. See [RADIO.md](RADIO.md).
- External stations can expire, be blocked, or require a user gesture. HTTPS pages filter out HTTP streams. Original local stations stay available when an external source fails.

## 3. Gameplay fixture boundaries

The new integration collectors run **actual production modules**: real colliders/projectiles, raycast sight, finite ammunition, paid UI transactions, stored VINs, shared-world stepping, hospitals and browser persistence. The physical route pilot uses normal steering/pedals; the drift pilot additionally countersteers from actual measured slip. Stunt qualification now uses the **current jump's** duration, never the chassis's cumulative lifetime airtime.

All use explicit debug positioning/initial saves and some accelerated simulation. They do **not** establish ordinary human handling, physical device inputs, real-time escape duration, by-ear sound or FPS acceptance. The original six rooftop starts remain; two-marker run checks are separate from street races.

Bugs found and corrected during this follow-up include: the first speed gate being too close to attain its target; activity yards conflicting with a service lot/raised underpass; garage sight colliders needing to be installed/stepped before live rays; stale cumulative stunt airtime; an undefined YouTube playlist video ID and overly optimistic external-player state. Failed/collector-interrupted attempts remain separately named evidence rather than silently becoming passes.

## 4. Retained open observations from earlier releases

- Strict traffic no-stuck/fairness is still open. Earlier sampled planner/loaded-city soaks saw no sampled overlaps/red-entry/crossing violations, but raw stopped waits reached **118.65 / 78.183 simulated seconds**. Two real wall-minute software watches advanced too little simulation to qualify many agents for starvation review. Do not replace those waits with a friendlier small counter.
- Human driving feel, physical controllers/wheels/rumble and complete touch-only on-foot controls are unaccepted. Browser vibration is not native force feedback.
- Ninety-six roster RPM loops are designed processing of six licensed field recordings; Zenith V10/Kestrel twin are explicitly designed derivatives, not independent calibrated recordings. Hash/decode/seam checks do not replace listening.
- Low-poly art, pedestrian seating/social/car-entry alignment, long-course scenic blending and exhaustive risky/street-feature traversal remain prototype-quality or need broader review.
- The existing private source repository is not pushed; no hosted CI pass is claimed. The source ZIP and public compiled-output deployment are different deliverables. See [deployment state](DEPLOYMENT.md).

## Next work, in order

1. Capture a native-hardware frame/CPU/GPU trace in actual populated, three-star and five-rival scenes; fix the largest verified cost without removing content or changing FPS telemetry.
2. Run a real player session covering driving/drifting/stunts, sight-break escapes, handling and audible mixes. Review collision-ground agreement beyond the corrected practice yards.
3. Test the official external players from a permitted network/device, including **observed playback and track change**. Use authorized account flows for Spotify only after terms/approval review.
4. Expand occupied-car/intersection/fairness and long memory/streaming coverage; preserve raw waits and failures.
