# Step 03: The long random parkour run and the finish

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

Replace the hand-built test route with the long random route, hazards, power-ups and the rewarding finish.

## Build

- Implement the whole Rooftop parkour section of `docs/DESIGN.md`: the seeded route generator with at least 14 segment types, 25 to 30 checkpoints, branching safe and risky paths, and the jump possibility check.
- All hazards (moving and tilting platforms, crumbling ledges, cranes, rolling balls, laser gates, wind gusts, patrol drones) and all power-ups, with HUD bars.
- Collectibles on risky branches.
- Build this as a `ParkourRun` class in `src/parkour/` with `start(seed)`, `reset()`, `newSeed()`, `update(dt)`, `dispose()` and events, so the city can call it later.
- The finish: camera flight with fireworks, the small result panel with a rank from C to S, a car model waiting on the street below, the harder night route unlock, the ghost of the best run, and saving per seed.
- Make the roofs of the opening district large enough that the route winds through the whole district and never runs in a line.

## Acceptance tests

- Simulate at least 20 seeds with the jump check. Every seed is possible.
- Play one full run by hand or with a test bot. It takes roughly 8 to 12 minutes at a normal pace.
- Every hazard and power-up works. Falls respawn. The timer ends the run correctly.
- The finish plays and the result is saved. The night route and the ghost appear on the next run.
- Frame rate stays near 60 fps.
