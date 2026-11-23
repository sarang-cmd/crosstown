# Asset pipeline

The Step 01 blank scene remains at `?sandbox` and only uses its procedural test cubes. Current Steps 01–09 use the prepared CC0 runner/pedestrian, ten Kenney cars and two original motorcycle GLBs, six class cabins and twelve profiles derived from six licensed engine recordings, with designed articulated/procedural/synthesized fallbacks on load failure. All asset work is done by the included scripts; the user does not need to find or prepare models.

## Reviewed fixtures

| Fixture | Author / licence | Prepared size | Geometry | Animation |
|---|---|---|---|---|
| Kenney Car Kit 3.1 sedan | Kenney, CC0-1.0 | 4.5 m length (+Z) | 2,032 triangles | None in source |
| RobotExpressive | Tomás Laulhé / Quaternius; Don McCurdy conversion, CC0-1.0 | 1.75 m height (+Y) | 3,237 triangles | All 14 clips preserved |
| Parkour runner derivative | Same source; original parkour extensions by the Crosstown project (formerly Coastline), CC0-1.0 | 1.75 m height (+Y), +Z forward | 3,237 triangles | 14 original + 13 added clips = 27 |

Sources, direct download URLs and SHA-256 pins are in `assets/fixtures.json`. The sedan is downloaded from the author's OpenGameArt upload and selected from its ZIP; its palette texture is embedded in the prepared GLB. The robot uses the Three.js r180 source tag and its asset-specific CC0 README.

- `public/models/test-car.glb`: approximately 75 KiB.
- `public/models/test-character.glb`: approximately 369 KiB.
- `public/models/parkour-runner.glb`: **402,984 B**; reproducibly derived from the hash-verified prepared character. `docs/assets/parkour-runner.json` and `.license.txt` record actual decoded bounds, all required clips, the source/extension license and checksums.
- `assets/sources/<id>/`: downloaded original model and relative resources, retained for inspection.
- `docs/assets/<id>.json`: before/after bounds, triangle counts, animation names, node-name mappings, missing nodes, dimensions, modifications and checksums.
- `docs/assets/<id>.license.txt`: asset-specific licence evidence snapshot.
- `CREDITS.md` and `public/CREDITS.md`: generated credits, plus fonts and software.

The two model licences were checked against the original publishers' pages/README before use. A general CC0 licence URL alone is not a substitute for verifying that a particular model is covered by it.

## Reproduce

```bash
npm ci
npm run assets:fixtures
npm run assets:runner
npm run assets:check
```

The fixture manifest pins both the downloaded archive and the individual GLB. Changed sources are rejected, not silently accepted. If a download fails, the importer exits clearly and existing prepared files remain usable. The game needs no runtime network download beyond its bundled public files; if a runtime model request fails, designed procedural/articulated models remain playable.

`tools/prepare-parkour-character.mjs` reads the prepared original, preserves its skin/14 clips, authors named run/sprint/jump/double-jump/slide/climb/fall/land/roll/wall-run/vault/zipline/swing tracks, serializes with Meshopt FILTER, then re-decodes and measures the output. It generates a standard report/license/credit entry, so regenerating either fixture does not silently remove the derivative's credits. `assets:check` now validates all **sixteen** prepared models and required added clip names.

Rooftop architecture, street props/palms, hazards, pickups and fireworks are original instanced procedural meshes; they do not depend on unreviewed external prop downloads. Parkour effects and finish music remain original Web Audio synthesis. Vehicle audio additionally uses six real recorded profiles, documented below. Source, modifications and CC0 dedication are listed in `CREDITS.md`.

## Steps 08–09 · roster and animated pedestrians

`tools/prepare-roster.mjs` independently selects **ten** CC0 Kenney Car Kit 3.1 GLBs from the reviewed archive. Source archive SHA-256 is `fac7dacac5c7874348cf19729af3ef205f3d366493edaf0a827d93f4fdf3d0c4`. Bounds, +Z direction, ground pivot, wheel nodes and triangle budgets are decoded/audited after preparation. Civilian Brim/Cinder derivatives have taxi/patrol roof pieces removed by `tools/trim-civilian-roof.mjs`. All twelve vehicle outputs stay below 2,500 triangles.

Two motorcycle candidates could not be downloaded with verifiable exact files (403/access failure). Instead, the project authors **original CC0 Wren/Kestrel motorcycle GLBs**, with separate wheels/body/details, not missing-model boxes and not misattributed downloaded models. `docs/assets/{wren,kestrel}.json` and their licence files describe the fallback. Running preparation needs no protected source access.

The **3,237-triangle CC0 RobotExpressive derivative** `city-pedestrian.glb` retains skinning and exports Walk/Idle/Run/Flee/Chat/Sit. Flee is a retimed Run and Chat an adapted greeting; no new mocap is claimed. Pedestrian AI/animation/near-pool/far instances live in `src/npc/`. Per-model JSON/licence reports are in `docs/assets/`; sources remain in `assets/sources/`.

`src/vehicles/geometry.ts` expands normalized/quantized/interleaved attributes to Float32 before baking world transforms. Wheels keep every transformed child/alloy; cached sources are immutable and live visuals own copied resources. These corrections are tested numerically and through actual rendering of every model on both backends.

```bash
npm run assets:roster
node tools/trim-civilian-roof.mjs
npm run assets:roster-audio
npm run credits
npm run assets:check
```

The twelve `public/audio/cars/<rosterId>/` folders contain **96** loops, selected by `cars.ts`. `prepare-roster-audio.py` checks the retained sources and makes per-car EQ/filter/saturation/harmonic derivatives, including explicitly **designed V10/twin** timbres. The sources are still six field recordings, not twelve calibrated multi-load sets. `docs/ROSTER-AUDIO-ASSETS.json` records output hashes/processing and the twelve manifests retain provenance. Historical cabin-study folders remain; preparation/playback and credits do not discard earlier audio work.

## Import another reviewed model

```bash
npm run assets:prepare -- \
  --id example-car \
  --url https://example.org/reviewed-model.glb \
  --kind car \
  --size 4.5 \
  --forward +Z \
  --author "Verified artist" \
  --license CC-BY-4.0 \
  --source https://example.org/model-page \
  --license-url https://example.org/asset-specific-LICENSE.txt
```

These example URLs are documentation placeholders, not download endpoints. For a real tested invocation, run `assets:fixtures`, which calls the same importer with the reviewed manifest.

Optional arguments:

- `--archive-entry "Models/GLB format/sedan.glb"` — load a particular GLB and its relative resources from a ZIP. Entries are never blindly extracted to the filesystem.
- `--sha256 <digest>` — reject an altered original model.
- `--node-map mapping.json` — explicit source-to-standard node-name overrides.
- `--forward +Z|-Z|+X|-X` — source forward direction. glTF sources must be Y-up.
- `--kind car|character|prop` — `--size` is car length or otherwise height, in metres.

Only CC0-1.0 and CC-BY-4.0 are accepted. Artist, source and asset-specific licence evidence are required. The script checks the evidence's licence declaration, but that is not an automatic legal audit; a new source must still be reviewed before being added to the fixture manifest.

## Processing steps

1. Download with timeout and size limits; check expected hashes when supplied.
2. Select the GLB from a ZIP if requested; read its public glTF 2.0 container and resolve only referenced buffers/images. Record resource hashes.
3. Measure the source and count rendered triangles and animation clips.
4. Add an **animation-safe root wrapper**: rotate the source forward to +Z, uniformly scale the desired dimension, and translate the ground-centred pivot to `(0,0,0)`. Animated bone transforms and clip tracks are not overwritten.
5. Detect and name available wheel, steering, door, glass, light and mirror nodes. Preserve original names in extras. Explicit overrides are supported.
6. Deduplicate/prune unused data. For an over-budget car, weld and simplify with a bounded error. Reject it if it still exceeds 60,000 triangles; do not silently ship an oversized model.
7. Resize images to at most 1024 × 1024 and compress to WebP. No image files are fabricated for vertex-coloured sources.
8. Reorder mesh data and apply `EXT_meshopt_compression` with the FILTER method. This preserves the mixed rigid/skinned robot's transforms; applying generic position-quantization transforms was specifically avoided after verifying the animation fixture.
9. Serialize, **re-decode the actual output**, and verify dimensions, ground pivot, triangle budget, +Z metadata and animation preservation. Write reports and credits only after validation succeeds.

## Loading prepared files later

Use `GLTFLoader` with `setMeshoptDecoder(MeshoptDecoder)` from `three/addons/libs/meshopt_decoder.module.js`. Images are embedded WebP. Both fixture models were also loaded in a browser: precise, skin-aware `Box3` measurements confirmed the 4.5 m car length, 1.75 m character height and ground alignment; the Running clip was evaluated successfully.

## Explicit limitations

- The source sedan has four independently named wheels but no authored independent door, steering, lights or mirror nodes. The source report truthfully lists them absent. Step 06 now re-pivots actual wheel geometry, splits 42 source-body triangles into a moving door, and supplies code-built lights/mirrors/person/rack/cabin geometry. This is an original rigging derivative, not a claim that the downloaded model had those nodes. Car visuals clone material/texture ownership; source and other-car resources are not disposed during cleanup.
- glTF Transform bounds are conservative for a mixed rigid/skinned character, so width can exceed the exact skinned rest-pose width. Browser tests independently verify actual height, ground alignment, skins and animation.
- WebP is download-size image compression, **not GPU block compression**. KTX2/Basis texture conversion, production LODs and a full asset catalogue belong to later asset/streaming steps. Nothing claims those systems are already implemented.
- The fixture importer accepts one-scene GLB sources (with embedded or relative resources), not FBX, OBJ or arbitrary scene archives. Multi-scene sources are rejected for explicit preprocessing.
- Steps 06–07 supplied six recordings / 48 loops and one sedan. Steps 08–09 extend this to twelve independent vehicles and 96 roster loops, with the historical study folders retained; an animated pedestrian population now exists. Drivers/riders and some transitions remain minimal code-built figures, not final realistic people.
- Required animation clips are present and Running is visible in browser pixels. Every parkour transition and articulated fallback appearance still needs hands-on animation-quality review; clip presence alone is not that review.

## Steps 04/05 city art

The city uses independently designed procedural architecture and props, not an unreviewed downloaded asset pack. Worker records define varied buildings/facades, roof equipment, awnings/signs/murals, street objects, palms/trees, service lots, cranes, bridges/tunnels/ramps and simple decorative boats/aircraft/traffic. Static street geometry is baked into transferable vertex-colored buffers; building/light volumes remain instanced and mixed moving geometry shares a `BatchedMesh`. Source records are retained. These models are present designed fallbacks, not missing-download placeholders; final art richness and distant silhouette repetition remain open in `FINDINGS.md`. The animated licensed runner is retained. The source reward sedan is now also used by the Step 06 raycast vehicle system; the scenery/city catalogue is not represented as a complete vehicle fleet.

## Steps 06–07 · real recordings, hybrid audio and cabin geometry

The retained Steps 06–07 study bank has six distinct licensed recording profiles and **48 actual WAV loops**, totaling **3,842,112 B** (audio only). Prepared format: mono PCM16 / 32 kHz / 1.25 seconds / 40,000 samples per loop. Every file has endpoint discontinuity ≤1 LSB and is hash-checked by the vehicle-system units. This numerical check is not click-free acoustic acceptance.

| Engine | Runtime folder | Source and licence |
|:--|:--|:--|
| I4 / compact | `public/audio/cars/cabin-compact/` | Ndheger, Freesound 118100, CC-BY-3.0 |
| V6 / sedan | `public/audio/cars/harbor/` | SkyernAklea, 623436, CC-BY-4.0 |
| V8 / muscle | `public/audio/cars/cabin-muscle/` | overmedium, 651534, CC0-1.0 |
| Flat-six / supercar | `public/audio/cars/cabin-supercar/` | mharo, 55727, CC0-1.0 |
| Diesel / SUV | `public/audio/cars/cabin-suv/` | Iridiuss, 399773, CC0-1.0 |
| Single / motorbike | `public/audio/cars/cabin-motorbike/` | dycmaster, 353980, CC-BY-3.0; corroborating publisher licence evidence 368210 |

Exact source URLs/authors/licence evidence, source format/hash and modifications are in `assets/audio-sources/*.json`, `docs/assets/audio-*.license.txt`, `docs/CAR-AUDIO-ASSETS.json`, the six runtime manifests and CREDITS. Archived rejected source 408624 is **not used by a runtime profile**. The active single-cylinder source is **353980 / CC-BY-3.0**, not that archived CC0 candidate.

**Source boundary:** public publisher HQ MP3 previews were downloaded without bypassing login/access controls. They are lossy field recordings, not the login-only original WAVs. Four selected windows per source are filtered into designed on/off-load states; they are not eight independently recorded, measured-RPM/dyno load captures. Equal-power load/RPM interpolation and smoothed bounded playback pitch are combined with engine-specific firing synthesis/intake/whine/turbo/diesel and driving/one-shot effects. No human by-ear comparison or final realism acceptance has occurred.

### Optional offline reproduction

```bash
# Use a separate Python environment if needed; these are producer dependencies,
# not game/runtime dependencies. Prepared audio is already bundled.
python3 -m pip install numpy scipy soundfile
npm run assets:audio
# Verify actual shipped PCM hashes/seams, licensing and runtime helpers:
npm test
```

`tools/prepare-car-audio.py` checks retained source hashes, downmixes/resamples, filters/DC-corrects, equalizes RMS, crossfades/tapers periodic edges, writes/decode-checks WAVs, then regenerates manifests/provenance/credits. Preparation depends on the installed offline DSP library versions; shipped per-file hashes describe the actual prepared output, not a promise of cross-version bit-identical DSP. The general model importer accepts CC0/BY4; this **separate reviewed audio pipeline** also supports CC-BY-3.0.

### Replace a recording set

1. Obtain a verified CC0 or CC-BY source (or your own recording), retain asset-specific licence/author/source and document modifications.
2. Put the eight `idle|low|mid|high` × `off|on` WAVs in the intended `public/audio/cars/<carId>/` folder. Mono, modest-size, seamless loops are recommended. Filenames must match the supplied manifest convention.
3. Keep exactly eight `loops` records in the existing band/load order with valid `file` and `anchorRpm`; prefer measured anchors for improved realism. Keep the correct engine/folder identity and update hashes/provenance/CREDITS. Chassis data selects `soundProfile` in `src/vehicles/cars.ts`; cabin studies map engine type in `src/audio/vehicle-audio.ts`.
4. Test repeated sweeps/load transitions **by ear and numerically**, the fallback, both rendering paths and saved sliders. The runtime decodes all eight; a manifest/request/decode failure chooses per-engine synthesis without blocking gameplay. Current acceptance deliberately withholds/restores one real file as well as returning 404.

The spatial budget is 16 engine emitters, prioritizing the controlled car then distance; transient effects have their own 16-one-shot cap. Master/engine/effects/radio and retained music gains persist. No radio station source/catalogue is bundled.

### Models/interiors

All six cabins, instruments/hands/manual shifters, warning lamps, mirror housings, radio screens and their unique silhouettes are authored as code geometry. Live rear views are actual render targets, not reference photos. These are six visual/audio studies on **one** chassis, not downloaded finished realistic interiors or six complete vehicles. Prototype proportions/person/hand detail and physical hardware/long-soak GPU-memory review remain open.
