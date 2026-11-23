# DESIGN: Open-world driving and parkour game (reference spec)

Create a bright, kinetic, legible open-world driving and parkour game in a fictional coastal city inspired by Miami and Los Angeles. The map is one large fixed city of about 16 km² (4 km by 4 km). The player starts already running across a rooftop toward the first glowing ledge.

Do not create a title screen, menu, level select, onboarding overlay, or press-start state. The game is playable immediately.

Single idea: finish a long random rooftop parkour run, unlock a car at the street below, then drive, race, and explore the whole city with real physics, real engine sounds, a deep radio, and police who find you by line of sight.

Make it bright, kinetic, legible, and playable at once. Graphics quality is a top goal. Aim for the look of a polished modern browser open-world game, with real car and pedestrian models, strong lighting, and a living street.


This file is the reference spec for the whole project. Every step of the prompt chain builds one part of it. Save it as `docs/DESIGN.md` in step 1 and do not change it unless a step says so.

## The world: one fixed 16 km² city

- Generate the city once at load from a fixed seed, in workers, as streamed chunks of about 128 m. The map is 4 km by 4 km with a clear edge: open sea on one side, mountains and desert on the others. Block the edge in a natural way (water, cliffs, fences). Never show an invisible wall.
- Use fictional district and street names. Do not use real brand names or logos.
- Districts, laid out so each feels different and the drive between them is interesting:
  - Beachfront with palms, a promenade, lifeguard towers, and an Art Deco strip with neon.
  - Glass downtown with tall towers, plazas and the parkour route.
  - Port and industrial yards with cranes, containers and warehouses.
  - Canals with bridges, boats and waterfront houses.
  - Hills with villas, winding roads, and a viewpoint.
  - Old brick blocks with alleys, fire escapes and rooftop clutter.
  - Desert and farmland outskirts with slow open roads, gas stations and billboards.
  - A highway ring with ramps, tunnels and an overpass.
  - A mountain road with hairpin turns.
- Roads: build a real road graph with intersections, lane markings, crosswalks, traffic lights, medians, curbs, sidewalks and speed limits. Traffic and pedestrians use this graph.
- Terrain from a height map with beach, cliffs and water that has waves, reflections and foam at the shore.
- Buildings: generate varied facades with window grids that light up at dusk, balconies, roof props (water towers, vents, billboards, antennas, clotheslines, fire escapes), shop signs, awnings and murals.
- Place gas stations, gun shops, paint shops, garages, hospitals, and police stations. Place stunt ramps, hidden collectible spots on rooftops, tunnels, underpasses, and parking garages the player can hide in.
- Rooftop parkour start markers: place 6 around the city. The first run starts at the opening rooftop in the downtown district. The finish billboard has a street below with a car waiting.
- Add distant traffic on far roads, boats on the sea, and aircraft in the sky for life.
## Rooftop parkour: long, random and hard to finish

The player starts already running toward the first glowing rooftop ledge. The route is long, random, and never a straight line.

### Route
- Generate the route from a seed on every run. Stitch together at least 14 different segment types (gaps, ledges, wall runs, ziplines, fire escape climbs, water tower hops, billboard walks, clothesline swings, vent hops, crane arms, moving platforms, tilting platforms, crumbling ledges, rolling ball corridors, laser gate corridors, wind gust gaps).
- 25 to 30 checkpoints. A good run takes 8 to 12 minutes.
- Difficulty rises along the route. Add branches: a safe slow path and a risky fast path that rejoin later.
- Check that every jump is possible. Compute the player's maximum jump distance and height from the real movement settings, keep a safety margin, and reject any segment that fails the check.
- Place clear glowing landing markers on every ledge.
- The final target is a large billboard. A clear beam marks it.

### Movement
- Run, sprint, jump with coyote time and jump buffering, double jump from a power-up, slide, ledge grab and pull up, wall run, vault, zipline, and a roll on landing from a high fall.
- A close third-person camera that follows the run, looks ahead, and never clips through walls.

### Hazards and ways to fail
- Moving platforms that travel along paths, tilting platforms, crumbling ledges that fall a moment after you land, swinging cranes, rolling balls that knock you back, sweeping laser gates, wind gusts that push you sideways, and patrol drones that knock you off a ledge.
- Falling returns you to the last checkpoint with a 5 second time penalty. A knockback never kills you.
- The timer is generous but does not forgive careless play. Time pickups add seconds. If the timer ends, the run resets to the start of the same seed. A key starts a new seed.

### Power-ups and collectibles
- Double jump, slow motion, speed boost, and a magnet that pulls in collectibles. Each lasts about 10 seconds and shows a bar in the HUD.
- Collectibles on risky branches give cash.

### HUD
- Timer, checkpoint count out of the total, power-up bars, reset key hint, and compact controls.

### Finish: make it feel rewarding
- Reaching the billboard starts a camera flight over the city with fireworks and a short music swell.
- A small result panel shows the time, falls, collectibles, and a rank from C to S.
- You unlock a free car. It waits in the street below with a glowing arrow.
- A harder night route unlocks. A ghost of your best run appears on later runs.
- Save the best time per seed and per start marker.
## Cars: the biggest focus

### Physics and handling
- Use a Rapier raycast vehicle per car with real suspension (spring, damper, travel), wheel raycasts, weight transfer, tire friction curves, a drivetrain with an engine torque curve, gear ratios, a differential, and engine braking.
- Tune toward arcade with a little simulation. Cars are easy to drive with a keyboard, slide when you use the handbrake, and never feel like ice or glue. Add light steering assist and counter-steer help that you can turn off in settings.
- Add downforce on supercars, higher weight and body roll on trucks, and a lean model for motorbikes.
- Cars jump off ramps and land correctly. Cars flip, roll and bounce with believable weight.
- Build 12 cars. Give each its own mass, power, torque curve, gear count, grip, top speed, brake strength, suspension setup, engine type and sound profile. Store this in one data file, `cars.ts`.
  - Compact x2, sedan x2, muscle x2, supercar x2, truck or SUV x2, motorbike x2.
  - Use fictional names. Do not use real brand names or logos.
- Damage: dent deformation on the body mesh, broken lights and windows, smoke at low health, fire at zero health, then a wreck. Damage changes handling a little.
- Carjacking: walk up to an NPC car, press the enter key, the driver leaves the car or runs away.

### Cameras
- One key cycles four views: cockpit, hood, close chase, far chase. Cockpit is the default when you enter a car.
- On foot the camera is close third person.

### Interior (cockpit view)
- Build each class cockpit in code with its own dashboard shape and materials. Use the exterior glTF model for the other views.
- Gauges work: speedometer, tachometer, engine temperature, gear indicator, and warning lights that light up at the right times (check engine, oil, handbrake, damage).
- The steering wheel turns with your input and visible hands move with it. Add the shifter in manual mode.
- Mirrors show the real view behind the car. Use low resolution render targets, updated every second frame, with a quality tier that turns them off.
- A small dash screen shows the radio station and track name.
- Interior lighting follows the time of day. Dashboard lights glow at night.

### Steering and input
- Keyboard: smoothed steering with speed-sensitive lock, so low speed turns sharper and high speed turns softer.
- Mouse steering mode on a toggle key.
- Gamepad: analog steering with a dead zone, analog triggers for throttle and brake, and rumble where the browser supports it.
- Racing wheel: support USB wheels through the Gamepad API with an axis mapping screen in the pause overlay. Use a 900 degree steering lock.
- The visible steering wheel angle always matches the real steering angle.
- Automatic transmission by default. A toggle key turns on manual shifting with shift up and shift down keys.

### Start sequence
- Entering a car starts a full sequence: door opens and closes, key inserts with a click, ignition on (dashboard lights sweep and turn on, fuel pump hum), key turns, starter motor cranks with a low uneven RPM, engine catches, RPM flares and settles to idle.
- Cold starts crank longer and idle fast for about 20 seconds.
- Starting in the wrong state can stall a car, especially in manual mode.
- A key toggles the engine off and on. Turning it off plays the shutdown sound and the dashboard fades.

### Sound: real engines, not generic synth
- Use a hybrid system. Each car has its own sample set: idle, low RPM, mid RPM, high RPM, with on throttle and off throttle loops. Crossfade the loops by RPM and load, and shift pitch with RPM.
- Search for free CC0 or CC-BY engine and car recordings and download them. Choose the right engine type per car: four cylinder for compacts, V6 for sedans, V8 for muscle, flat six or V10 for supercars, diesel for trucks, single or twin cylinder for bikes. Record the author and licence in `CREDITS.md`.
- Add synthesized layers on top: turbo whistle and blow-off valve, exhaust pops and crackle on deceleration, intake noise, supercharger or gear whine, diesel clatter.
- Add start sounds: key click, starter motor crank, engine catch, door open and close, indicator tick, handbrake ratchet, shutdown.
- Add driving sounds: tire squeal from slip, gravel and grass, wind noise from speed, suspension bumps, body creaks, collisions that depend on speed and material, glass break.
- Use spatial audio with `PannerNode` for NPC cars and sirens. Limit active voices to 16 and give the nearest cars priority.
- If a sample set fails to load, fall back to a physically based synthesized engine for that car.
- Let the person replace the sound of any car by putting files in `public/audio/cars/<carId>/`. Document this in the README.
## NPCs, traffic and pedestrians

- Traffic drives along the road graph. Cars keep lanes, obey traffic lights, yield at intersections, signal, brake, overtake, and honk. Each driver has a personality (cautious, normal, aggressive) that changes speed, following distance and patience.
- Traffic reacts to the player. Cars brake and swerve around crashes, pull over for sirens, and flee from gunfire.
- Pedestrians walk on sidewalks, use crossings when the light allows, stand in chatting groups, sit on benches, walk to destinations, and enter and exit parked cars. They flee from gunfire and from speeding cars.
- Behavior changes between day and night. Fewer people walk at night. More cars have headlights on.
- Density target near the player at medium quality: about 60 cars and 120 pedestrians. The quality scaler raises and lowers this. Far agents use simple instanced stand-ins. Full physics runs only within about 80 m of the player.
- Parked cars line the streets. Some can be taken.

## Lighting and effects

- Physically based sun and sky with atmosphere. Golden hour and a neon night.
- Headlight and brake light cones, street lamps, lit windows that switch on at dusk, neon signs, bloom, volumetric fog and sun shafts, reflections on wet roads, motion blur, heat haze over the asphalt, tire smoke, skid marks, sparks on collisions, rain splashes, lens flare.
- The time of day and weather start from the real calendar date. Seed a random generator with the date. It picks the starting hour and one of: clear, overcast, rain, fog. A full day cycle then runs in about 24 real minutes. Weather can shift slowly during the day.
- The quality scaler turns off the heaviest effects first.
## Weapons

- Stylized arcade combat with no blood and no gore. Bodies ragdoll and fade away after a few seconds.
- Seven weapons: bat, pistol, SMG, shotgun, rifle, grenade, rocket launcher. Each has a model, a firing sound, recoil, spread, damage, ammo count and reload time.
- A weapon wheel opens on a key. Aim with the mouse on foot. Passengers and drivers can shoot from the car window with a simple lock-to-side aim.
- Pedestrians can be hurt and ragdoll. Ammo is limited. Buy it at gun shops.

## Police and wanted level: line of sight

- Police work by sight, not by a circle on the map.
- Each officer has a vision cone: about 70 degrees wide, about 60 m long, blocked by buildings, cars and props (use raycasts). Headlights and a helicopter spotlight make the cone longer at night.
- A crime that an officer sees, or an officer seeing you with a wanted level, raises your stars. Stars fall when no officer has seen you for 20 seconds.
- States: unseen, seen, searching, lost. An officer who loses you goes to your last seen spot, then fans out to search nearby.
- You escape by breaking line of sight: hide behind buildings, drive through alleys and tunnels, enter a garage, drive under a bridge, or drive into water and swim out.
- Escalation: 1 star patrol cars, 2 stars roadblocks, 3 stars a helicopter with a moving spotlight cone, 4 stars armored vans, 5 stars heavy units.
- Show a small "seen / searching / lost" indicator in the HUD. Tint the cones on the minimap and fade them out as officers lose you.
- Officers shoot at 2 stars and above. Keep it arcade. No gore.

## Money, shops and saving

- Cash comes from challenges, races, collectibles and stunt jumps.
- Spend cash at gun shops, paint shops, garages and the hospital. Garages store up to 6 cars.
- If you die you respawn at the nearest hospital, pay a small fee, and lose some ammo. If your car is wrecked, a recovery option returns the last car you owned to a garage.
- Save progress to the browser (`localStorage`, with a try and catch around every call): cash, unlocked cars, garage cars, paint, best times, collectibles, radio favourites, settings, and the world seed where it applies. A reset key wipes the save after one confirmation.

## Driving challenges

- Street races against rival cars, time trial checkpoint circuits, drift zones with a score, stunt jump packages, delivery runs with a damage limit, and speed trap gates with a bonus.
- Each starts when you drive into a glowing marker. Each keeps your best three runs.
- Rooftop parkour start markers are placed around the city. Walking into one starts a new random parkour run.
## Radio: deep integration from the first version

One in-car radio wheel switches between five source types. It opens with a key. A small now-playing display shows in the HUD and on the dash screen. The radio plays only in cars. Favourites save to the browser.

1. Internet radio stations from the free Radio Browser API.
   - Find a server by resolving `all.api.radio-browser.info`, or use a known mirror like `de1.api.radio-browser.info`, `nl1.api.radio-browser.info` and `at1.api.radio-browser.info`. Pick one at random and fall back to the next if it fails.
   - Browse by country code, language and genre tag. Use the `countrycode` field, not the old `country` field. Hide stations that are marked broken. Send a clear app name with each request.
   - Play streams through an `HTMLAudioElement`. Many streams have no CORS headers, so do not route them through the Web Audio analyser. When the page runs on https, only use https streams.
   - Include a country picker with at least Germany, the United States, the United Kingdom, France, Spain, Italy, Brazil, Japan, and a "world" option.
2. Procedural Web Audio stations: four generative stations (lo-fi, synthwave, funk, ambient) built in code, with short synthesized station idents.
3. Static between stations: when you change station, crossfade through procedural static and tuning noise.
4. Spotify with full playback.
   - Use the Authorization Code with PKCE flow and the Web Playback SDK. Do not use a client secret.
   - Read the client ID from one config value (`VITE_SPOTIFY_CLIENT_ID`, documented in the README and in `.env.example`). Use a loopback redirect URI such as `http://127.0.0.1:5173/callback`, not `localhost`, and document it.
   - Spotify requires a Premium account for the app owner and for playback. Development Mode apps allow only a few users. Write the README steps to create a Spotify developer app and to set the redirect URI.
   - Features: log in, import the person's playlists and liked songs, list tracks, play, pause, skip, seek, queue, shuffle, volume, and show the track name and art.
   - The SDK connection can hang in Development Mode. Use an 8 second timeout. If it fails, or no client ID exists, hide this source and show nothing else. Do not show an error screen.
5. YouTube and SoundCloud.
   - A paste-a-link box accepts a YouTube video or playlist link, or a SoundCloud track or playlist link.
   - Use the official YouTube IFrame Player API and the SoundCloud Widget API in small hidden players. Skip, previous, pause, volume and shuffle work for both.
   - Save pasted links as custom stations.

If a source is not set up or fails, hide it. The other sources keep working. Duck the radio volume during police sirens and when the engine starts.
## HUD, map and controls

- No title screen, menu, level select, onboarding overlay or press-start state. The game starts mid-action. A pause and settings overlay opens only on Esc.
- HUD: a circular minimap, a full map on a key with a road route line when you set a waypoint, speedometer and gear, health, wanted indicator, cash, active challenge timer, radio now playing, and a compact controls hint that fades after 10 seconds and returns on a key.
- Pause overlay: quality tier, volume per bus (engine, effects, radio, master), key bindings, controller and wheel mapping, radio sources, and a save reset.
- Controls: WASD or arrows, mouse look on foot, Space jump, Shift sprint, C camera, E enter and exit, F horn or interact, R radio wheel, Tab weapon wheel, M map, Esc pause, and a reset key for parkour runs. Gamepad and racing wheel as described above.
## Models and assets: find them yourself

You find, choose, check and prepare every 3D model. The person using this game does not do any of it.

- Search for free glTF or GLB models under CC0 or CC-BY licences (for example from Kenney, Quaternius, Poly Pizza, Sketchfab downloadable CC models, and similar public sources). Download them into the project.
- Check the licence of every model before you use it. Do not use anything with a non-commercial, no-derivatives or unclear licence.
- Choose models for: 12 cars across 6 classes (compact, sedan, muscle, supercar, truck or SUV, motorbike), pedestrians with walk, run, idle and flee animations, a player character with run, jump, slide, climb, fall and land animations, police cars, a helicopter, trees and palms, street props, signs, hydrants, lamps, billboards, water towers, fire escapes, boats, and weapon models.
- Prepare each model with a script: measure its bounding box, scale it to real size (a car is about 4.5 m long, a pedestrian about 1.75 m tall, a lamp post about 8 m), fix the orientation so forward is the same axis for every model, put the pivot on the ground, find the wheel, steering wheel, door, light and mirror nodes and give them standard names, and compress textures.
- Reject models that are too heavy for the performance target. A car must stay under about 60k triangles after you reduce it.
- Write a `CREDITS.md` file with the author, licence and source link for every model and sound. Show one small credit line in a screen corner that links to this file.
- If a download fails, or you have no network access, build that object in code instead so the game still runs. Never leave a missing model or a placeholder box.
- Make each car look different. Use different paint, wheels and lights per car even when two cars share a base model.
## Stack

- Build a Vite and TypeScript project in several files. Run `npm create vite` style scaffolding yourself, install dependencies, and make `npm run dev` start the game. Write a short README with the run steps, the controls, the config files, and the credits.
- Rendering: Three.js with `WebGPURenderer` imported from `three/webgpu`. WebGPU is the default and the automatic WebGL 2 fallback must work. Before you write code, read the current Three.js WebGPURenderer manual and check the import paths and the installed version. Do not use `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` or `EffectComposer`. They do not work on this renderer. Write custom materials with node materials and TSL. Write post-processing as a TSL node chain.
- Physics: Rapier (`@dimforge/rapier3d-compat`). Use its raycast vehicle controller for cars and a kinematic character controller for the player on foot.
- Audio: Web Audio API only. No audio library.
- Use Web Workers for world generation so the main thread never stalls.
- Pin exact package versions. Pick versions that are at least two weeks old.
- Keep the code in clear modules: `world`, `vehicles`, `player`, `npc`, `police`, `weapons`, `audio`, `radio`, `ui`, `save`, `parkour`, `config`.
## Performance target

- Target 60 fps at 1080p on an integrated GPU laptop (AMD Radeon 840M class, 16 GB RAM). Test with that budget in mind, not with a desktop GPU.
- Use instancing and `BatchedMesh` for buildings, props, trees, lamps and traffic. Use level of detail, impostors for far buildings, frustum and occlusion culling, KTX2 compressed textures, and Draco or Meshopt compressed models.
- Stream the world in chunks around the player. Generate chunks in workers. Keep only chunks near the player in the physics world.
- Limit shadow cascades. Use cheap or baked lighting at a distance.
- Build an automatic quality scaler with at least four tiers. It watches frame time and changes resolution scale, shadow quality, view distance, traffic and pedestrian density, and heavy effects. It turns off the heaviest effects first: volumetric fog, motion blur, wet road reflections, then bloom.
- Show a small fps and quality readout in one screen corner.
- Never block the main thread for more than 8 ms during streaming.
