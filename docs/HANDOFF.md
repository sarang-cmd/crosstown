# Crosstown · 0.14.0 / 14.002 source handoff

**Release label: 22 November 2026 · Steps 01–14 prototype.** Assumption: preserve the existing city, saves, routes and gameplay; add only the supplied Step 14 lighting/effects/scaler scope. The original DESIGN remains byte-identical. Exact recorded verification timestamps, distinct from the release label, are in [TESTING.md](TESTING.md).

## Start here

- **Local candidate:** `npm ci && npm run dev` with Node `^20.19.0` or `>=22.12.0`. Prepared models/fonts/audio are included; no new downloads or API key are needed to play. `npm run build && npm run preview` serves the built game.
- **Routes:** `/` is the lightweight landing; `/play` immediately starts saved/default Quick; `/play?setup` explicitly opens choices. Full/Standard/Quick, training, handling lab, callback and legacy root game-query URLs remain. Earlier save keys and the twelve-car roster remain.
- **Lighting controls:** Escape → **Light & atmosphere**, saved individual switches and reduced-motion handling. [LIGHTING.md](LIGHTING.md) explains eligibility, approximation limits and what “off” does and does not mean.
- **Public production is still 0.13.0:** [crosstown-sarang-dev.vercel.app](https://crosstown-sarang-dev.vercel.app). This Step 14 source/preview has **not** been deployed. [DEPLOYMENT.md](DEPLOYMENT.md) is the public-state record; do not interpret an old URL as the new runtime.
- **Portable source:** [SOURCE-ARCHIVE.md](SOURCE-ARCHIVE.md), `crosstown.zip` and `SHA256SUMS.txt`. The clean extraction proof compares candidate output, not stale production bytes.

## Added in Step 14

- Headlight/brake cones and ground pools; real wheel-contact smoke/skids, physical-impact sparks and rain splashes. Bounded pools and the six-nearest-car light budget include actual traffic/police/rivals without adding physics bodies.
- Original texture-free neon ribbons, warm street lamps and switchable emissive dusk windows; shared instanced/baked city geometry and derivative-filtered distant windows.
- Three r180 **PostProcessing / TSL**: conditional quarter-width/height bloom, filtered shafts and rough wet SSR; bounded height fog, camera blur, heat haze, sun-occluded flare and bright coastal/neon-night grade. No legacy GLSL or EffectComposer.
- Four laptop budgets and actual-display hysteresis. Auto sheds **fog → blur → wet reflections → bloom**, before tier budgets. Low/Balanced use 70%/85% internal resolution and all tiers cap DPR at 1; a 1080p viewport is not native 1080p at every tier.
- Lazy/disposable mirrors, bounded effect allocation/update work, explicit main-thread phase/resource estimates and real worker work/queue/roundtrip telemetry. Estimates are not GPU time or driver VRAM.

The earlier landing, parkour, fleet/cabins/audio, damage/garages, living streets, weapons/police, HUD/economy/activities and radio are retained. New effects are original code-built geometry/TSL; no additional third-party model/sound assets were needed.

## Verification and unfinished acceptance

**139/139 unit/physics tests; 6/6 retained production pixel cases; 9/9 lighting phases and 11/11 city-life phases on each backend; six physical activity finishes/rewards; four landing widths.** [TESTING.md](TESTING.md), [PROGRESS.md](PROGRESS.md) and [TEST-RESULTS.json](TEST-RESULTS.json) record actual run results, frame intervals, fixtures and remaining limits. [EVIDENCE-MANIFEST.json](EVIDENCE-MANIFEST.json) fingerprints source and artifacts; the packager refuses drift. Initial failed attempts remain separate.

**Not accepted:** native Radeon 840M-class 1080p60 / reported lag solved, exhaustive visual correctness, literal zero whole-frame cost when effects are off, long driver-memory/whole-map soak, strict traffic fairness/no-stuck, human handling/listening or physical input devices. Short software measurements and synthetic isolation pixels do not establish those gates. The common beauty/grade/depth buffer, policy dispatch, original city geometry and cached records still cost something when optional effects are disabled.

Actual radio rows remain **5 core passes / 2 failed-or-unavailable** for official YouTube/SoundCloud playback/skip. Spotify authentication is untested without client ID/Premium/authorized account; no SDK/source without ID. [RADIO.md](RADIO.md). Provider readiness is not observed playback.

## Next handoff

Run the supplied headed native benchmark on the target laptop, inspect the recorded adapter, then capture GPU/CPU traces in the populated rainy-dusk pursuit. Review all effects in motion and SSR/cone limitations, human driving/audio, physical controls, traffic fairness and long streaming/memory behavior. Preserve honest display cadence and all prior features. No Step 15 work, source push, hosted CI pass or new deployment is claimed. Do not reuse retired transfer descriptors or weaken access controls. [Detailed findings](FINDINGS.md) · [dated implementation/file map](PROGRESS.md).
