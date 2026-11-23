# Step 09: Traffic and pedestrians

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

A street that feels alive.

## Build

- Traffic on the road graph with lanes, lights, yielding, signaling, braking, overtaking, and honking. Three driver personalities.
- Traffic reacts to the player: braking and swerving around crashes, pulling over for sirens, fleeing from gunfire (gunfire arrives in step 10, so build the hook now).
- Pedestrians with sidewalks, crossings, chatting groups, benches, destinations, and entering and leaving parked cars. Use animated glTF models with walk, idle, run and flee.
- Day and night behavior: fewer people and more headlights at night.
- Density target of about 60 cars and 120 pedestrians near the player at medium quality, driven by the quality scaler. Far agents use instanced stand-ins. Full physics only within about 80 m.

## Acceptance tests

- Leave the car parked for two minutes and watch. No cars get stuck, overlap, or drive through each other. Lights are obeyed.
- Crash into a car and see the reactions. Drive with a siren test flag on and see cars pull over.
- Pedestrians cross only when allowed.
- Frame rate stays near 60 fps in the busiest district at medium quality. The scaler lowers density when it must.
