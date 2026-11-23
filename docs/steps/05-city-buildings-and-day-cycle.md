# Step 05: Buildings, props, districts and the day cycle

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

Fill the world with a living, detailed city and the full lighting cycle.

## Build

- Generate buildings for every district: varied facades, window grids that light at dusk, balconies, awnings, murals, shop signs, and roof props. Use instancing, `BatchedMesh`, impostors for far buildings.
- Street props: palms and trees, lamp posts, traffic lights, hydrants, signs, benches, bins, billboards, parked cars (static for now).
- Landmarks per district. Place gas stations, gun shops, paint shops, garages, hospitals and police stations as buildings with markers.
- Place stunt ramps, hidden rooftop collectible spots, alleys, tunnels, parking garages, underpasses.
- The parkour roofs now sit inside the real downtown. The route must still work.
- Add the six rooftop start markers around the city.
- The sky and light: physically based sun and sky, golden hour and neon night, street lamps, lit windows, a day cycle of about 24 real minutes, and weather seeded by the real calendar date (clear, overcast, rain, fog).
- Boats on the sea, aircraft in the sky, distant traffic on far roads as simple instanced movers.

## Acceptance tests

- Each district looks clearly different from the others.
- Lit windows and street lamps switch on at dusk. Weather changes with the date seed. Test two different dates.
- The parkour run from step 03 still finishes after the buildings change the roofs.
- Frame rate stays near 60 fps in the densest district at medium quality.
