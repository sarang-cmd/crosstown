# Step 06: The first car: physics, cameras, steering and start sequence

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

One car that feels excellent to drive. Build it so the other 11 cars only need data.

## Build

- A data-driven car system: all values in `cars.ts` (mass, torque curve, gear ratios, grip, top speed, brakes, suspension, engine type, sound profile).
- The Rapier raycast vehicle with suspension, weight transfer, tire friction curves, a drivetrain, a differential and engine braking. Tune toward arcade with a little simulation, with steering assist you can turn off.
- Enter and exit the car with the enter key. Carjack an NPC-style parked car.
- The four cameras on one key: cockpit, hood, close chase, far chase.
- Interactive steering: smoothed keyboard steering with speed-sensitive lock, a mouse steering toggle, gamepad analog steering and triggers with rumble, USB racing wheel support with an axis mapping panel in the pause overlay, a 900 degree lock, and a visible steering wheel angle that matches.
- Automatic transmission by default with a manual shifting toggle.
- The full start sequence with door, key, ignition lights, starter crank, catch and idle. Cold starts and stalls. Engine on and off key.
- Use the real car glTF model from the asset pipeline. Wheels spin and steer. Lights work. The car arrives at the car waiting below the finish billboard.
- A test road loop with ramps, a slope, a gravel patch and a wall so you can check handling.

## Acceptance tests

- Drive the test loop with keyboard, then gamepad. The car does not feel like ice or glue.
- Handbrake slides, jumps and landings behave correctly. The car can flip and recover.
- Every camera works. The wheel angle matches the steering.
- The start sequence plays in order. Cold start and stall work.
- Enter and exit work in the street below the parkour roofs.
- Frame rate stays near 60 fps.
