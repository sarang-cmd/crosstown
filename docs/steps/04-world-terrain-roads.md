# Step 04: The 16 km² world: terrain, roads and streaming

Read `docs/DESIGN.md` and `docs/PROGRESS.md` first. Keep every earlier feature working. Build only the scope of this step. Find, check and prepare any models or sounds you need yourself, as `docs/DESIGN.md` describes, and fall back to code-built objects if a download fails.

When you finish: run the game, test every item under "Acceptance tests", fix every error, then add a dated entry to `docs/PROGRESS.md` (what exists, the file map, known issues, what the next step needs). Reply with a short summary of what you built, what you could not build and why. Do not ask questions before you build. State any assumption in one line.

## Goal

A large streamed world below the roofs with terrain, water and a road network. No buildings detail yet.

## Build

- The fixed 4 km by 4 km map from the world section of `docs/DESIGN.md`: sea on one side, mountains and desert on the other sides, natural edges and no invisible walls.
- Chunks of about 128 m generated in workers from a fixed seed, streamed in and out, with level of detail and a physics bubble around the player.
- Terrain from a height map with beach, cliffs, hills, canals and water with waves, reflections and foam.
- The road graph: arterial roads, local streets, the highway ring, ramps, bridges, tunnels, the mountain road. Intersections, lane markings, crosswalks, curbs, sidewalks, medians and speed limits stored in the graph.
- Place the district zones (beachfront, glass downtown, port, canals, hills, old blocks, outskirts) as regions on the map. Put the opening rooftop district in the downtown zone.
- A temporary flying debug camera on a key so you can inspect the whole map.
- A simple street-level walking mode, so the player can leave the rooftop and walk on roads.

## Acceptance tests

- The fly camera crosses the whole map with no gaps, popping or long stalls.
- Frame rate stays near 60 fps while moving fast over the map.
- The main thread never stalls for more than 8 ms during streaming.
- Roads connect all districts. Every intersection has valid lanes.
- The player can walk from the street below the parkour roofs to the beach.
