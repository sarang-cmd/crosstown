# Step 08: The 12 cars, damage and garages

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

The full roster, each different.

## Build

- All 12 cars in 6 classes with fictional names, each with its own model chosen by you, its own data, paint options, and sound profile. Compact x2, sedan x2, muscle x2, supercar x2, truck or SUV x2, motorbike x2. Give the bike a lean model and its own interior and sound.
- Damage: dent deformation, broken lights and windows, smoke at low health, fire at zero health, a wreck, and small handling changes from damage.
- Parked cars and NPC cars can all be taken.
- Paint shops and garages as working buildings with simple in-world markers. Garages store up to 6 cars. The recovery option returns the last car you owned.
- The unlocked reward car from the parkour finish appears in the garage and in the street below the billboard.

## Acceptance tests

- Drive each of the 12 cars on the same test loop. Each one handles and sounds clearly different.
- Wreck a car on purpose and check each damage stage. Test recovery.
- A garage keeps 6 cars across a page reload.
- Frame rate stays near 60 fps with 10 cars loaded near the player.
