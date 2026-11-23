# Step 02: The opening rooftop and player movement

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

Open the game and the player is already running across a rooftop toward a glowing ledge. No title screen, menu, level select, onboarding or press-start state.

## Build

- A bright stylized rooftop district with a skyline, water towers, vents, billboards, fire escapes, clotheslines, window grids and a street far below. Use instancing for repeated objects.
- The player character with a real animated glTF model (run, sprint, jump, double jump, slide, climb, fall, land, roll). Use the Rapier kinematic character controller.
- Movement as the Parkour section describes: coyote time, jump buffering, ledge grab and pull up, slide, wall run, vault, zipline, roll on high falls.
- The close third-person camera that looks ahead and never clips through walls.
- A short hand-built test route of about 8 checkpoints that ends at a billboard. Use clear glowing landing markers.
- HUD: timer, checkpoint count, reset key, compact controls.

## Acceptance tests

- The first frame shows the player running. There is nothing to click or press to start.
- Every movement action works and feels responsive. Test each one.
- The camera never shows the inside of a wall.
- Falling returns the player to the last checkpoint with the time penalty. Reset works.
- Frame rate stays near 60 fps.
