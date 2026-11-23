# Fleet, damage and workshops · Steps 08–09

Assumption: fictional, low-poly prototype vehicles; preserve the existing parkour/city, six class cockpits, inputs, mirrors and save keys. No weapons, police or radio expansion.

## Twelve independent playable definitions

`src/vehicles/cars.ts` is the source of truth for mass, dimensions, torque curve, gears/final drive, driven axles/differential, top speed, braking, suspension, tires, steering, aero, paint and sound tuning.

| Class | Model / replacement-audio folder | Engine design |
|---|---|---|
| Compact | `pip` / `milo` | I4 / I4 |
| Sedan | `harbor` / `meridian` | V6 / V6 |
| Muscle | `brim` / `cinder` | V8 / V8 |
| Supercar | `aerox` / `zenith` | flat-six / designed V10 |
| SUV | `mesa` / `summit` | diesel / diesel |
| Motorbike | `wren` / `kestrel` | single / designed twin |

Ten actual CC0 Kenney models are prepared by `tools/prepare-roster.mjs`. The two detailed original CC0 bike GLBs are reproducible fallbacks after source access failed, not downloaded third-party motorcycles. Each bike has exactly **two** Rapier wheel rays, active roll/lean control, its own chassis data and the exposed-instrument motorbike cockpit. They have no hidden support wheels. All vehicles are under 2,500 triangles; the animated pedestrian is 3,237. Reports, archived sources and licences live in `docs/assets/` and `assets/sources/`.

`tools/trim-civilian-roof.mjs` removes 10 taxi-sign and 22 patrol-roof-bar triangles offline from the two civilian muscle derivatives. Provenance names are not game branding. `decodedGeometry` expands normalized/quantized/interleaved attributes **before** world-space baking; live cars own their geometry/material/texture copies. Wheel children retain their own transforms and alloy pieces. Cached glTF sources are immutable.

## Handling and sound verification boundary

Run `npx tsx tools/accept-roster.ts`. All twelve use ordinary throttle/brake/steering through the same installed ~0.8 km, 44-segment circuit, without helper impulses or respawns. The current numerical run traverses at least 850 m per car, with maximum centerline error under 0.74 m and no damage. Bikes lean approximately 0.44–0.46 rad. A separate asphalt straight avoids the optional gravel strip when measuring acceleration and brakes.

The measured three-second speeds range from about **10.57 to 24.66 m/s**. From 13 m/s, full service-brake stopping distances range from about **3.47 to 6.61 m**. These measurements demonstrate tuning differences; a speed-limited automatic pilot is **not a human handling-feel judgment**.

Twelve distinct replacement folders contain **96** reviewed-recording-derived WAV loops. Six historical cabin studies remain available. These are six licensed field recordings processed with per-car EQ/saturation/harmonics plus engine-specific synthesis, **not twelve independent dyno recordings**. The V10/twin profiles are designed timbres derived from flat-six/single sources. Hash/PCM/seam/profile checks and actual browser decoding are useful but do not replace by-ear distinction/realism/click review.

## Damage

- Dents begin at 0.10 damage and deform owned body/door vertices locally at impact points.
- Windows disappear at 0.38; front lamps fail at 0.48; smoke begins at 0.68; rear lamps fail at 0.78.
- At 1.00, drive power stops; fire lasts seven simulated seconds, then a dark wreck remains.
- Degradation is intentionally modest: maximum −15% power, −8% grip and a small rack bias.
- A chassis struck from rest takes actual contact damage too; the pre/post-contact impulse test is covered by a parked-impact unit and a loaded-city player/NPC collision.
- Damaged near NPC cars are promoted from the shared batch to an owned deformable visual only when needed. Their actual dynamic body and damage remain authoritative. Intact traffic stays batched.
- Only the garage recovery service repairs a wreck. The normal R upright-recovery key does not silently repair it.

## Street ownership and garage

Walk to a stopped parked/NPC car and press **E/F**. Merely displaying a prompt never removes or materializes an NPC car. Actual entry retires its traffic proxy, preserves damage/paint, creates one playable car and lets an occupied driver leave. NPC cars must slow below 5 km/h before entry.

Garage and paint-shop signs/rings use the existing city service buildings and cleared forecourts. Stop inside a ring and press **E/F**. The Garage toolbar button marks the nearest garage on the full map, rather than teleporting the player.

`crosstown:garage:v1` contains six unique-VIN slots, paint, damage, last-owned recovery data and a one-time reward flag. Storage access is guarded; blocked storage remains usable for the session. Saves reject invalid models/VINs, duplicate records and nonfinite damage. Successful storage removes the live vehicle into the garage and leaves the player outside, avoiding stacks of physical cars at the same bay. Retrieval removes any matching live VIN first. Recovery exits/saves the old car **before** repairing its record, so exit cannot overwrite the repair.

The parkour reward initially appears both in the garage and on the street below the billboard. When all six slots are occupied, its garage record is queued until a slot is released; it remains available on the street. Taking/storing/retrieving it does not generate another reward. Lab loan vehicles do not replace the last owned street car and cannot be stored. Existing `crosstown:*` saves and older migration keys are retained.

## File map

- `src/vehicles/{cars,engine,physics,damage}.ts`: roster and actual dynamics/stages.
- `geometry.ts`, `library.ts`, `visual.ts`: immutable sources, decoded/owned geometry, paint, wheels, dents and effects.
- `garage.ts`, `services.ts`, `src/ui/{vehicle-hud,vehicles.css}`: versioned ownership and mounted workshop UI.
- `src/audio/{engine-mix,vehicle-audio}.ts`: profiles, hybrid sound and spatial budgets.
- `tools/prepare-roster*.{mjs,py}`, `trim-civilian-roof.mjs`: reproducible acquisition/preparation.
- `tools/accept-roster.ts`, `tests/unit/fleet*.test.ts`, `tests/browser/fleet.spec.ts`: physical loops, geometry/ownership/audio/storage and real UI checks.

See `TEST-RESULTS.json` and `evidence/crosstown-0.9.0/` for observed runs and revision boundaries. Near-60 FPS, native input hardware, subjective handling and human listening are not accepted by numerical tests.
