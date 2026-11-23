# Step 07: Cockpit interior and real engine sound

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

Cockpit view that looks and sounds real.

## Build

- A code-built cockpit for each of the 6 car classes with its own dashboard shape: working speedometer, tachometer, temperature gauge, gear display, warning lights, a turning steering wheel with hands, a shifter in manual mode, mirrors that show the real view behind the car (low resolution render targets updated every second frame, with a tier that turns them off), a small dash screen for the radio, and interior lighting that follows the time of day.
- The hybrid engine audio system: per-car sample sets with idle, low, mid and high RPM loops for on and off throttle, crossfaded by RPM and load, pitch shifted by RPM. Find real CC0 or CC-BY engine recordings for each engine type and credit them.
- The synthesized layers: turbo whistle and blow-off, exhaust pops, intake, gear whine, diesel clatter.
- Start sounds: key click, starter, catch, doors, indicator, handbrake, shutdown.
- Driving sounds: tire squeal by slip and surface, wind by speed, suspension bumps, body creaks, collisions by speed and material, glass break.
- Spatial audio with `PannerNode`, a limit of 16 voices, nearest first.
- The synth fallback engine for any car whose samples fail. The `public/audio/cars/<carId>/` replacement folder, documented in the README.
- Volume buses: master, engine, effects, radio, in the pause overlay.

## Acceptance tests

- Compare three engine types by ear and by RPM sweep. They sound different from each other and follow RPM smoothly with no clicks at the loop points.
- Every gauge reads correctly. Mirrors show the road behind.
- Delete one sample file on purpose and confirm the fallback synth plays and nothing crashes.
- Frame rate stays near 60 fps in cockpit view.
