# Crosstown · 0.13.0 / 13.001 handoff

**22 November 2026 · Steps 01–13 prototype.** Assumption: retain earlier features and browser saves, add the requested landing outside gameplay, and implement the four supplied follow-up steps without altering the original DESIGN.

## Start here

- **Landing:** [crosstown-sarang-dev.vercel.app](https://crosstown-sarang-dev.vercel.app) / `/` — responsive cream/forest coastal page; local images/fonts, no game engine before Play. Hero is disclosed AI-generated concept art; the three small views are actual game captures.
- **Game:** `/play` — immediate saved/default Quick run. `/play?setup` explicitly opens choices. Earlier `/?drive`, `?training`, `?length=full`, `?webgl` and other game query links remain compatible.
- **Local:** Node `^20.19.0` or `>=22.12.0`; `npm ci && npm run dev`. Prepared assets included. `npm run build && npm run preview` serves production output.
- **Public state:** see [DEPLOYMENT.md](DEPLOYMENT.md), not the presence of a URL in an old journal entry. Source ZIP: [SOURCE-ARCHIVE.md](SOURCE-ARCHIVE.md).

## Added in this follow-up

- Seven bounded, stylized weapons, six prepared CC0 models, actual hits/projectiles and free shooting-range practice; no gore.
- Sight-based police, last-seen/search states, 20 unseen simulated seconds per star, up to eight physical ground units plus helicopter. F8/F9 are debug stars/cones, not proof of normal-player escape.
- Circular minimap/waypoints, wanted/health/cash/ammo/challenge/radio HUD, paid gun/ammo/paint/garage/recovery services and nearest-hospital penalties; guarded saves retain earlier unlocks/bests.
- Six drive-in street activities, cash/top-three records, five ordinary-physics rival racers, and working rooftop starts. Final drift/stunt yards avoid earlier service/underpass conflicts; current-jump airtime prevents stale-airtime stunt credit.
- In-car procedural and Radio Browser stations, official visible link players, favourites/now-playing and an optional disabled-by-default Spotify PKCE path. [Setup and real provider limits](RADIO.md).
- Stable instanced matrix capacity and an analytical water mesh with **81.77% fewer water triangles**, without deleting the city/routes. These do **not** establish a lag fix.

## Verification and what is not finished

**125/125 unit/physics checks, 11/11 browser phases on each renderer, six recorded/paid physical activity finishes, and 204/204 anonymous public hashes pass.** Read [TESTING.md](TESTING.md) and [TEST-RESULTS.json](TEST-RESULTS.json) for the fixture boundaries, per-row provider outcomes, revision fingerprint and reproducible commands. All earlier failed/interrupted attempts are distinguished from final checks. [EVIDENCE-MANIFEST.json](EVIDENCE-MANIFEST.json) hashes runtime, verification code and artifacts; the packager detects drift.

**Reported gameplay lag is NOT considered solved.** Native near-60 FPS, three-star/five-rival performance, busy Balanced streets, strict traffic no-stuck/fairness, long GPU-memory/continuous-map soak, human handling/listening and physical devices remain unaccepted. Software fixed-step fixtures are not native FPS or human acceptance. YouTube/SoundCloud playback/skip and authenticated Spotify are not accepted without the actual observed/authorized provider tests. These limits must remain visible in any release summary.

## Controls worth knowing

WASD/arrows move, Space jumps, Shift sprints, E/F traverses or enters/exits a stopped car; B street, M map, P run choices, Esc settings. In a car: W/S pedals, A/D steer, Space handbrake, C view, I ignition, Y radio. Tab tools, J/click fire, R reload while armed, backtick holsters. Backspace abandons an activity. Full controls: [README](../README.md#controls).

## Next handoff

Prioritize a native-hardware populated pursuit/race profile, then a human driving/audio session and provider playback/skip from a permitted environment. The original `docs/DESIGN.md` is byte-identical. The existing private source repository remains unpushed without secure auth; no hosted CI pass is claimed. Do not reuse any retired one-time Vercel transfer descriptor or weaken access controls. [Detailed findings](FINDINGS.md) · [dated file map](PROGRESS.md).
