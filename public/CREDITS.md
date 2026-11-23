# Crosstown — credits & licences

Steps 01–13 use the animated CC0 rooftop runner, ten reviewed Kenney vehicle derivatives, two original CC0 motorcycles an animated CC0 city-pedestrian derivative and six prepared CC0 Kenney Blaster Kit tools. The bat, helicopter, police liveries, ramps and bounded ragdolls are original code-built geometry. Models are re-proportioned in code, their licensed wheels are independently re-pivoted and source triangles are separated for opening doors where present. Civilian muscle derivatives have their taxi sign/patrol light bar removed offline. All six class cockpits, workshops and fallback objects are original code-built geometry. The original engine sandbox remains at `?sandbox`. All signs are fictional; no third-party brands or logos are used.

## Models

### Crosstown aerox — Kenney race derivative (`aerox`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/aerox.glb`
- **Source SHA-256:** `e1408c4c6e135f5a39c5f34cbfbcac9ae21c5c491e793fdee74bccac8334d942`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.5 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 1,952 triangles.
- **Licence snapshot:** `docs/assets/aerox.license.txt`

### Crosstown brim — Kenney taxi derivative (`brim`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/brim.glb`
- **Source SHA-256:** `3803539718ffd3b84b515dbce8ed6b489f1ff5be58edb1903d2c5db5c584bdc7`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.9 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression; Surveyed civilian roof cleanup: removed 10 taxi-sign / patrol-light triangles offline; no police/taxi markings or siren gameplay..
- **Geometry:** 2,062 triangles.
- **Licence snapshot:** `docs/assets/brim.license.txt`

### Crosstown cinder — Kenney police derivative (`cinder`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/cinder.glb`
- **Source SHA-256:** `a617b880594f56239b7ac4cf6fd4d74ebdae3ba6c5d842e77c76a5906eff352a`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.95 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression; Surveyed civilian roof cleanup: removed 22 taxi-sign / patrol-light triangles offline; no police/taxi markings or siren gameplay..
- **Geometry:** 2,282 triangles.
- **Licence snapshot:** `docs/assets/cinder.license.txt`

### Crosstown animated city pedestrian — CC0 RobotExpressive derivative (`city-pedestrian`)

- **Author:** Tomás Laulhé (Quaternius); conversion and facial morph targets by Don McCurdy
- **Licence:** [CC0-1.0](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/README.md)
- **Source:** https://github.com/mrdoob/three.js/tree/r180/examples/models/gltf/RobotExpressive
- **Download:** https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- **Prepared file:** `public/models/city-pedestrian.glb`
- **Source SHA-256:** `44efa4061264cb6d2a32eb2062fcb601058705a3b3b658f4a298edb6f31324ec`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 1.75 m height; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression; Six retained/renamed idle/walk/run/sit/chat/flee skeletal clips; flee is an explicitly retimed running derivative, not a newly recorded motion.
- **Geometry:** 3,237 triangles.
- **Licence snapshot:** `docs/assets/city-pedestrian.license.txt`

### Crosstown harbor-roster — Kenney sedan derivative (`harbor-roster`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/harbor-roster.glb`
- **Source SHA-256:** `b532ea7d2c59f7f6b22b138cf1955218a2c1898f1cea932af4d3fd563c3959b7`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.3 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,032 triangles.
- **Licence snapshot:** `docs/assets/harbor-roster.license.txt`

### Crosstown Kestrel Twin — original motorcycle (`kestrel`)

- **Author:** Crosstown project (original procedural modelling)
- **Licence:** [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- **Source:** tools/prepare-roster.mjs
- **Download:** tools/prepare-roster.mjs
- **Prepared file:** `public/models/kestrel.glb`
- **Source SHA-256:** `4e35e14b4ccdc2e87416d11a6a02db21684a034c11ac647748a12f61e06d9e5d`
- **Modifications:** Original detailed two-wheel fictional motorcycle, authored as fallback after source access failed; Ground-centred +Z-forward glTF with fork, tank, engine, two axles, exhaust, controls, lamp and class-specific fairing or luggage rack; Meshopt FILTER geometry compression.
- **Geometry:** 1,232 triangles.
- **Licence snapshot:** `docs/assets/kestrel.license.txt`

### Crosstown meridian — Kenney sedan-sports derivative (`meridian`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/meridian.glb`
- **Source SHA-256:** `2889c428ca1dd9c975c3ff760eb8757883490410555ab60b818f712f583826d6`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.65 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,088 triangles.
- **Licence snapshot:** `docs/assets/meridian.license.txt`

### Crosstown mesa — Kenney suv derivative (`mesa`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/mesa.glb`
- **Source SHA-256:** `9df31f6e89e927a8176fc792aa125f0b19dc1ba29d2025bfef7c4f4d6ab1778a`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.9 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,474 triangles.
- **Licence snapshot:** `docs/assets/mesa.license.txt`

### Crosstown milo — Kenney van derivative (`milo`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/milo.glb`
- **Source SHA-256:** `ed4ed56e8e5ed98db050af09ed2062b3b6bb7b93eab1e563cb6774b387b233a1`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 3.85 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,082 triangles.
- **Licence snapshot:** `docs/assets/milo.license.txt`

### Crosstown runner — RobotExpressive parkour extension (`parkour-runner`)

- **Author:** Tomás Laulhé (Quaternius); conversion and facial morph targets by Don McCurdy
- **Licence:** [CC0-1.0](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/README.md)
- **Source:** https://github.com/mrdoob/three.js/tree/r180/examples/models/gltf/RobotExpressive
- **Download:** https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- **Prepared file:** `public/models/parkour-runner.glb`
- **Source SHA-256:** `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 1.75 m height; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression; 13 embedded original parkour clips: retimed skeletal animation, hanging/climbing arm poses and pivot-based forward rolls; new animation work released CC0-1.0 by the Crosstown project.
- **Geometry:** 3,237 triangles.
- **Licence snapshot:** `docs/assets/parkour-runner.license.txt`

### Crosstown pip — Kenney hatchback-sports derivative (`pip`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/pip.glb`
- **Source SHA-256:** `bd5c9d4c3b4bdd254a66b8426563a68b1487ae7a5076df3a2488e6ffed7be64f`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 3.6 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,088 triangles.
- **Licence snapshot:** `docs/assets/pip.license.txt`

### Crosstown summit — Kenney suv-luxury derivative (`summit`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/summit.glb`
- **Source SHA-256:** `9e2a79dc050189d4555a88d2e9da0f30ff946ba74f1d43b5b3bda3c193d1f7d7`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 5.15 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,086 triangles.
- **Licence snapshot:** `docs/assets/summit.license.txt`

### Sedan — Car Kit 3.1 pipeline fixture (`test-car`)

- **Author:** Kenney (www.kenney.nl)
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://kenney.nl/assets/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/test-car.glb`
- **Source SHA-256:** `b532ea7d2c59f7f6b22b138cf1955218a2c1898f1cea932af4d3fd563c3959b7`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.5 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,032 triangles.
- **Licence snapshot:** `docs/assets/test-car.license.txt`

### RobotExpressive — pipeline fixture (`test-character`)

- **Author:** Tomás Laulhé (Quaternius); conversion and facial morph targets by Don McCurdy
- **Licence:** [CC0-1.0](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/README.md)
- **Source:** https://github.com/mrdoob/three.js/tree/r180/examples/models/gltf/RobotExpressive
- **Download:** https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- **Prepared file:** `public/models/test-character.glb`
- **Source SHA-256:** `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 1.75 m height; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 3,237 triangles.
- **Licence snapshot:** `docs/assets/test-character.license.txt`

### Crosstown grenade — Kenney stylized blaster (`weapon-grenade`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/blaster-kit)
- **Source:** https://kenney.nl/assets/blaster-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- **Prepared file:** `public/models/weapon-grenade.glb`
- **Source SHA-256:** `8b67f9500005efee816f3fe72eb00bcded0282f7a9916f4436bf923877d8a89f`
- **Modifications:** Reviewed embedded CC0 License.txt; Y-up, +Z-forward, ground-centred wrapper; Uniformly scaled to 0.13 m height; Deduplicated/pruned and Meshopt FILTER geometry; Textures <=512px, WebP.
- **Geometry:** 200 triangles.
- **Licence snapshot:** `docs/assets/weapon-grenade.license.txt`

### Crosstown pistol — Kenney stylized blaster (`weapon-pistol`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/blaster-kit)
- **Source:** https://kenney.nl/assets/blaster-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- **Prepared file:** `public/models/weapon-pistol.glb`
- **Source SHA-256:** `d6d6fe0ec5baf21d7717449220799d45b95d2d663ace7b22612b255dc1a8b308`
- **Modifications:** Reviewed embedded CC0 License.txt; Y-up, +Z-forward, ground-centred wrapper; Uniformly scaled to 0.24 m height; Deduplicated/pruned and Meshopt FILTER geometry; Textures <=512px, WebP.
- **Geometry:** 470 triangles.
- **Licence snapshot:** `docs/assets/weapon-pistol.license.txt`

### Crosstown rifle — Kenney stylized blaster (`weapon-rifle`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/blaster-kit)
- **Source:** https://kenney.nl/assets/blaster-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- **Prepared file:** `public/models/weapon-rifle.glb`
- **Source SHA-256:** `d0d077820b8b840e0f41947dcb4d05960d94ede7431ae3c5e137847771a2f6a1`
- **Modifications:** Reviewed embedded CC0 License.txt; Y-up, +Z-forward, ground-centred wrapper; Uniformly scaled to 0.3 m height; Deduplicated/pruned and Meshopt FILTER geometry; Textures <=512px, WebP.
- **Geometry:** 548 triangles.
- **Licence snapshot:** `docs/assets/weapon-rifle.license.txt`

### Crosstown rocket — Kenney stylized blaster (`weapon-rocket`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/blaster-kit)
- **Source:** https://kenney.nl/assets/blaster-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- **Prepared file:** `public/models/weapon-rocket.glb`
- **Source SHA-256:** `ab0b5f51ecff405238727626d558414750a9946d5e255cd1dc8bf81eebe1f1e2`
- **Modifications:** Reviewed embedded CC0 License.txt; Y-up, +Z-forward, ground-centred wrapper; Uniformly scaled to 0.36 m height; Deduplicated/pruned and Meshopt FILTER geometry; Textures <=512px, WebP.
- **Geometry:** 524 triangles.
- **Licence snapshot:** `docs/assets/weapon-rocket.license.txt`

### Crosstown shotgun — Kenney stylized blaster (`weapon-shotgun`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/blaster-kit)
- **Source:** https://kenney.nl/assets/blaster-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- **Prepared file:** `public/models/weapon-shotgun.glb`
- **Source SHA-256:** `1c4c53f201597b2845c3d71717e0c465af1c21d8f8c30c0e1b4358dc33133d35`
- **Modifications:** Reviewed embedded CC0 License.txt; Y-up, +Z-forward, ground-centred wrapper; Uniformly scaled to 0.27 m height; Deduplicated/pruned and Meshopt FILTER geometry; Textures <=512px, WebP.
- **Geometry:** 388 triangles.
- **Licence snapshot:** `docs/assets/weapon-shotgun.license.txt`

### Crosstown smg — Kenney stylized blaster (`weapon-smg`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/blaster-kit)
- **Source:** https://kenney.nl/assets/blaster-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_blaster-kit_2.1.zip
- **Prepared file:** `public/models/weapon-smg.glb`
- **Source SHA-256:** `df3e35c9286d7bfe8bde2ff7231ef40ff89b1e7caa52fbf80ea685cb601de3ca`
- **Modifications:** Reviewed embedded CC0 License.txt; Y-up, +Z-forward, ground-centred wrapper; Uniformly scaled to 0.29 m height; Deduplicated/pruned and Meshopt FILTER geometry; Textures <=512px, WebP.
- **Geometry:** 802 triangles.
- **Licence snapshot:** `docs/assets/weapon-smg.license.txt`

### Crosstown Wren Single — original motorcycle (`wren`)

- **Author:** Crosstown project (original procedural modelling)
- **Licence:** [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- **Source:** tools/prepare-roster.mjs
- **Download:** tools/prepare-roster.mjs
- **Prepared file:** `public/models/wren.glb`
- **Source SHA-256:** `d3efceaf239f582551d532dbc8e63e2f71cef66490d3b0e2187ddb494c1c7c09`
- **Modifications:** Original detailed two-wheel fictional motorcycle, authored as fallback after source access failed; Ground-centred +Z-forward glTF with fork, tank, engine, two axles, exhaust, controls, lamp and class-specific fairing or luggage rack; Meshopt FILTER geometry compression.
- **Geometry:** 988 triangles.
- **Licence snapshot:** `docs/assets/wren.license.txt`

### Crosstown zenith — Kenney race-future derivative (`zenith`)

- **Author:** Kenney
- **Licence:** [CC0-1.0](https://opengameart.org/content/car-kit)
- **Source:** https://opengameart.org/content/car-kit
- **Download:** https://opengameart.org/sites/default/files/kenney_car-kit_3.1.zip
- **Prepared file:** `public/models/zenith.glb`
- **Source SHA-256:** `869e2a58d2c12de474e824aff137334491b8f234b97127cf23f1ea04e42deec6`
- **Modifications:** Y-up / +Z-forward normalization; uniform scale to 4.6 m length; ground-centred root wrapper preserving skins and animations; key-node names normalized where source geometry permits; textures resized to at most 1024 px and WebP-compressed where present; Meshopt FILTER geometry / animation compression.
- **Geometry:** 2,068 triangles.
- **Licence snapshot:** `docs/assets/zenith.license.txt`

## Fonts

- **Manrope** — Mikhail Sharanda and contributors. [SIL Open Font License 1.1](https://github.com/google/fonts/tree/main/ofl/manrope). Local font and licence in `public/fonts/`.
- **IBM Plex Mono** — IBM Corp. [SIL Open Font License 1.1](https://github.com/google/fonts/tree/main/ofl/ibmplexmono). Local font and licence in `public/fonts/`.

## Software

- [Three.js](https://github.com/mrdoob/three.js) r180, including RoundedBoxGeometry — MIT.
- [Rapier](https://github.com/dimforge/rapier.js) 0.19.0 — Apache-2.0.
- [Vite](https://github.com/vitejs/vite) — MIT. [TypeScript](https://github.com/microsoft/TypeScript) — Apache-2.0.
- [glTF Transform](https://gltf-transform.dev/) — MIT. [meshoptimizer](https://github.com/zeux/meshoptimizer) — MIT. [Draco](https://github.com/google/draco) — Apache-2.0. [Sharp](https://sharp.pixelplumbing.com/) — Apache-2.0. [fflate](https://github.com/101arrowz/fflate) — MIT. [Playwright](https://playwright.dev/) — Apache-2.0.

## Sounds

**Crosstown project — CC0-1.0.** All wind ambience, jumping/landing/rolling, collectible and checkpoint sounds, hazard/fall accents and the short finish chord/arpeggio swell are original code-built Web Audio synthesis in `src/audio/parkour-audio.ts`. These parkour cues use no recordings. The car system uses the separately licensed real recordings listed below, blended with original firing-model synthesis. Combat effects and four generative radio stations in `src/audio/combat-audio.ts` / `src/radio/procedural.ts` are also original synthesis. No commercial recordings are bundled as radio tracks. Optional external media remains with its provider and is not relicensed or downloaded by this project. Browser autoplay restrictions mean audio starts only after the first ordinary input gesture; the run itself never waits.

## Landing illustration

The coastal hero postcard in `public/images/coast-road*.webp` is AI-generated concept art made for this project, not an in-game screenshot. The three smaller landing images are real game captures.

## Original work

Application code, UI, terrain/road generation, the seven-district procedural city, parks/street props/parked cars, boat/aircraft fallbacks, grid/sky/water/roof node materials, facades/window grids, roof props, cloth, traversal structures, hazard models, route markings, fireworks, decals, vector mark and any articulated model fallback were created for this project. Those original visual/audio assets and the added runner animation poses are dedicated to the public domain under CC0-1.0. Runner source author and conversion credit remain as listed above. Fonts and software retain their separate licences.

## Real engine recordings — Steps 06–07

| Runtime engine | Recording author | Licence | Publisher source |
|---|---|---|---|
| i4 | **Ndheger** | [CC-BY-3.0](http://creativecommons.org/licenses/by/3.0/) | https://freesound.org/people/Ndheger/sounds/118100/ |
| v6 | **SkyernAklea** | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | https://freesound.org/people/SkyernAklea/sounds/623436/ |
| v8 | **overmedium** | [CC0-1.0](http://creativecommons.org/publicdomain/zero/1.0/) | https://freesound.org/people/overmedium/sounds/651534/ |
| flat6 | **mharo** | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | https://freesound.org/people/mharo/sounds/55727/ |
| diesel | **Iridiuss** | [CC0-1.0](http://creativecommons.org/publicdomain/zero/1.0/) | https://freesound.org/people/Iridiuss/sounds/399773/ |
| single | **dycmaster** | [CC-BY-3.0](http://creativecommons.org/licenses/by/3.0/) | https://freesound.org/people/dycmaster/sounds/353980/ |

**Modifications:** mono downmix, 32 kHz resampling, DC/high/low filtering, RMS normalization, periodic crossfade and designed on/off-load/RPM layers. The recordings were obtained as the publisher’s public lossy HQ MP3 previews, not original lossless dyno captures. Each set’s four RPM anchors and on/off-load variants are **processed derivatives**, not eight independently recorded, calibrated load states. Source MP3s, publisher HTML, SHA-256 checksums and exact per-loop derivation are retained under `assets/audio-sources/`, `public/audio/cars/*/manifest.json` and `docs/CAR-AUDIO-ASSETS.json`. The original authors do not endorse this game. Manufacturer names occur only in linked provenance, never as game branding.

The single-cylinder study uses dycmaster’s recording; the same publisher explicitly identifies their MT-03 as single-cylinder in [sound 368210](https://freesound.org/people/dycmaster/sounds/368210/), retained as `single-engine-evidence.html`. An earlier, unused cylinder-unspecified motorcycle recording by **poderarcano**, [CC0](https://creativecommons.org/publicdomain/zero/1.0/), [source](https://freesound.org/people/poderarcano/sounds/408624/), is archived as `motorcycle-unspecified.*` and is **not** the bike runtime set.

Original key/starter/catch/door/shutdown/indicator/handbrake/horn, tire/wind/suspension/creak/impact/glass, turbo/blowoff/exhaust/intake/whine/clatter layers in `src/audio/vehicle-audio.ts` are code-built synthesis, dedicated CC0-1.0. Engine-type synth fallback is not a claim to reproduce a specific commercial vehicle.

## Twelve per-car sound profiles — Step 08

The twelve replacement folders are `pip`, `milo` (Ndheger I4); `harbor`, `meridian` (SkyernAklea V6); `brim`, `cinder` (overmedium V8); `aerox`, `zenith` (mharo flat-six source); `mesa`, `summit` (Iridiuss diesel); `wren`, `kestrel` (dycmaster single-cylinder source). Each uses eight processed RPM/load loops. Step 08 adds per-car EQ, filtering, saturation, designed harmonics and runtime pitch/brightness tuning; the original six author/licence/source attributions above apply to these derivatives as well. **Zenith’s V10 and Kestrel’s twin timbres are designed transformations, not independent recordings of those cylinder counts.** See `docs/ROSTER-AUDIO-ASSETS.json` and `tools/prepare-roster-audio.py` for exact per-loop hashes and derivation; six older cabin studies are retained. No human listening/realism acceptance is implied.
