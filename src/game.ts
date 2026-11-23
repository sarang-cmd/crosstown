import "./ui/parkour.css";
import "./ui/crosstown.css";
import "./ui/vehicles.css";
import "./ui/adventure.css";
import { CityLife } from "./city-life";
import { driveRoute } from "./vehicles/ai-driver";
import { Economy } from "./save/economy";
import { Population } from "./npc";
import { VehicleServices } from "./vehicles/services";
import { CARS } from "./vehicles/cars";
import { Vehicles, type VehicleTarget } from "./vehicles";
import { VehicleHUD } from "./ui/vehicle-hud";
import type { DriveInput } from "./vehicles/engine";
import type { CarClass } from "./vehicles/cars";
import RAPIER from "@dimforge/rapier3d-compat";
import { Scene, DirectionalLight, HemisphereLight, Group, Mesh, Vector3 } from "three/webgpu";
import { APP } from "./config/app";
import { SessionStore, isRunLength } from "./config/session";
import { FixedStepLoop } from "./core/loop";
import { InputManager } from "./core/input";
import { QualityScaler } from "./core/quality";
import { createRenderer } from "./rendering/renderer";
import {resourceAudit}from"./rendering/resources";
import {FrameProfile}from"./rendering/profile";
import {CityPost} from "./rendering/post";
import {WorldEffects,type EffectCar} from "./rendering/world-effects";
import {effectPolicy,type EffectName} from "./rendering/effects-policy";
import {EffectsSettings} from "./ui/effects-settings";
import {roadHeightAt} from "./world/city/layout";
import { ChaseCamera } from "./player/chase-camera";
import { FlyCamera } from "./player/fly-camera";
import { AnimatedRunner } from "./player/runner";
import { emptyInput, type PlayerInput } from "./player/controller";
import { SaveStore, loadSettings } from "./save";
import { ParkourRun } from "./parkour/ParkourRun";
import { RouteBot } from "./parkour/bot";
import { ParkourAudio } from "./audio/parkour-audio";
import { ParkourHUD } from "./ui/parkour-hud";
import { SessionSetup } from "./ui/session-setup";
import { CityHUD, type ExploreMode } from "./ui/city-hud";
import { RooftopScene } from "./world/rooftops";
import { RouteWorker } from "./world/route-worker";
import { CityEnvironment } from "./world/city/environment";
import { CityStream } from "./world/city/stream";
import { StreetSession } from "./world/city/physics";
import { v3, type PowerType, type V3 } from "./parkour/types";

declare global {
  interface Window {
    __parkour?: ReturnType<typeof createTestAPI>;
    __city?: Record<string, any>;
    __vehicles?: Record<string, any>;
    __population?: Record<string, any>;
    __life?: Record<string, any>;
    __weapons?: Record<string, any>;
    __police?: Record<string, any>;
    __challenges?: Record<string, any>;
    __radio?: Record<string, any>;
    __renderProbe?: Record<string, any>;
    __effects?: Record<string,any>;
  }
}
function createTestAPI(
  run: ParkourRun,
  view: ChaseCamera,
  runner: AnimatedRunner,
  details: () => Record<string, unknown>,
  pause: (value: boolean) => void,
  restart: (seed?: number) => Promise<void>,
  suspendRendering: (value: boolean) => void,
) {
  return {
    snapshot: () => ({
      seed: run.seed,
      marker: run.marker,
      length: run.length,
      state: run.state,
      night: run.night,
      checkpoint: run.checkpoint,
      total: run.route.checkpoints.length,
      elapsed: run.elapsed,
      remaining: run.remaining,
      penalty: run.penalty,
      falls: run.falls,
      cash: run.cash,
      collectibles: run.collectibles,
      powers: { ...run.powers },
      position: { ...run.player.position },
      velocity: { ...run.player.velocity },
      grounded: run.player.grounded,
      motion: run.player.motion,
      height: run.player.height,
      modelLoaded: runner.loaded,
      modelFallback: runner.fallback,
      clips: runner.clips,
      ghostFrames: run.ghost.length,
      ghostVisible: runner.ghostRoot.visible,
      carUnlocked: run.store.data.car,
      nightUnlocked: run.store.data.night,
      result: run.result,
      finishTime: run.finishTime,
      camera: view.camera.position.toArray(),
      cameraYaw: view.yaw,
      cameraLimited: view.collisionLimited,
      cameraClearance: view.clearance,
      activeColliders: run.stage.world.colliders.len(),
      streamMs: run.stage.streamMs,
      routeMetres: run.route.distance,
      expectedSeconds: run.route.expectedSeconds,
      valid: run.route.validation,
      events: { ...run.eventCounts },
      ...details(),
    }),
    pause,
    reset: () => run.reset(),
    start: restart,
    respawn: () => run.respawn(),
    setRemaining: (seconds: number) => {
      run.remaining = seconds;
    },
    setNight: (value: boolean) => run.setNight(value),
    teleport: (p: V3) => {
      run.player.respawn(p);
      view.reset(run.player.facing);
    },
    fixture: () => ({
      spawn: run.route.spawn,
      direction: run.route.spawnDirection,
      jumps: run.route.jumps,
      checkpoints: run.route.checkpoints,
      pickups: run.route.pickups,
      hazards: run.route.hazards,
      slabs: run.route.slabs,
      interactions: run.route.interactions,
      goal: run.route.goal,
      car: run.route.carPosition,
    }),
    step: (ticks: number, input: Partial<PlayerInput> = {}) => {
      pause(true);
      for (let i = 0; i < Math.min(1200, Math.max(0, ticks)); i++) {
        run.setInput({
          ...emptyInput(),
          ...input,
          jump: i === 0 && !!input.jump,
          interact: i === 0 && !!input.interact,
        });
        run.update(1 / 60);
      }
    },
    botRun: async () => {
      pause(true);
      suspendRendering(true);
      const bot = new RouteBot(run);
      const start = performance.now();
      let ticks = 0;
      try {
        while (run.state === "running" && ticks < 90000) {
          for (let n = 0; n < 300 && run.state === "running"; n++, ticks++) {
            run.setInput(bot.input());
            run.update(1 / 60);
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        suspendRendering(false);
      }
      return {
        ticks,
        normalPaceSeconds: ticks / 60,
        wallSeconds: (performance.now() - start) / 1000,
        state: run.state,
        result: run.result,
        falls: run.falls,
        checkpoint: run.checkpoint,
      };
    },
    activatePower: (type: PowerType) => {
      const pickup = run.route.pickups.find((p) => p.type === type);
      if (pickup) return run.collect(pickup.id);
      return false;
    },
  };
}
async function boot(): Promise<void> {
  const bootStarted = performance.now();
  let firstRenderMs = 0;
  const query = new URLSearchParams(location.search),
    training = query.has("training");
  const seedText = query.get("seed"),
    seed = seedText && /^\d+$/.test(seedText) ? Number(seedText) >>> 0 : 84173;
  const host = document.querySelector<HTMLElement>("#scene")!,
    status = document.querySelector<HTMLElement>("#boot-status")!;
  document.title = "Crosstown — Take the long way home";
  host.setAttribute(
    "aria-label",
    "Crosstown: rooftop parkour and a streamed coastal city",
  );
  const save = new SaveStore(),
    settings = loadSettings(save),
    preferences = new SessionStore(),
    quality = new QualityScaler();
  if (isRunLength(query.get("length")))
    preferences.value.length = query.get(
      "length",
    ) as typeof preferences.value.length;
  if (settings.quality === "auto") quality.tier = 1;
  quality.setMode(settings.quality);
  save.write(settings);
  const worker = new RouteWorker(),
    audio = new ParkourAudio(),
    runner = new AnimatedRunner();
  status.textContent = "Finding your side of town…";
  const [context] = await Promise.all([
    createRenderer(host, quality.current),
    RAPIER.init(),
    runner.load(),
  ]);
  const run = new ParkourRun({
    training,
    length: preferences.value.length,
    routeFactory: worker.generate,
  });
  await run.start(seed);
  let world = new RooftopScene(run.route, true);
  await world.build();
  world.externalLighting = true;
  const scene = new Scene(),
    sun = new DirectionalLight("#ffe6bf", 2.6),
    ambient = new HemisphereLight("#c4e4ed", "#8c9871", 1.7);
  scene.add(
    world.root,
    sun,
    sun.target,
    ambient,
    runner.root,
    runner.ghostRoot,
  );
  sun.castShadow = quality.current.shadows;
  sun.shadow.mapSize.set(
    quality.current.shadowMapSize,
    quality.current.shadowMapSize,
  );
  Object.assign(sun.shadow.camera, {
    left: -37,
    right: 37,
    top: 37,
    bottom: -37,
    near: 1,
    far: 220,
  });
  sun.shadow.autoUpdate=false; sun.shadow.needsUpdate=true;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.035;
  const environment = new CityEnvironment(
      scene,
      sun,
      ambient,
      query.get("date") ?? undefined,
    ),
    city = new CityStream(scene, environment);
  await city.initialize(); environment.applyQuality(quality.current);
  city.physics.setOpening(run.route);
  await city.prime(run.player.position);
  world.applyQuality(quality.current);
  city.applyQuality(quality.current);
  const view = new ChaseCamera(),
    fly = new FlyCamera();
  view.reset(run.route.spawnDirection);
  view.update(run, 1 / 60, true);
  runner.update(run, 1, 0);
  context.renderer.toneMappingExposure = 1.04;
  const { renderer } = context,
    input = new InputManager(
      renderer.domElement,
      settings.bindings,
      settings.wheel,
    );
  renderer.domElement.setAttribute(
    "aria-label",
    "Crosstown. WASD move; Space jump; Shift sprint; X slide; E traverse; B walk; V fly; M map; P run choices; Escape settings.",
  );
  const frameProfile=new FrameProfile(query.has("test"));
  const post=new CityPost(renderer),worldEffects=new WorldEffects();scene.add(worldEffects.root);
  let effectiveEffects=effectPolicy(quality.current,settings.disabledEffects,environment.weather,settings.reducedMotion,environment.night.value);
  post.configure(effectiveEffects);worldEffects.configure(effectiveEffects);city.configureEffects(effectiveEffects);
  renderer.info.autoReset=false;let sceneDraws=0,sceneTriangles=0;const effectCandidates:EffectCar[]=[];
  let loop: FixedStepLoop,
    hud: ParkourHUD,
    cityHUD: CityHUD,
    setup: SessionSetup,
    paused = false,
    rebuilding = false,
    choosing = false,
    autoRun = true,
    pendingJump = false,
    pendingInteract = false,
    mode: ExploreMode = "parkour",
    street: StreetSession | undefined,
    vehicleHUD: VehicleHUD,
    cityWorldSteps = 0,
    waypoint: V3 | undefined;
  let frame = input.frame,
    hudClock = 1,
    previousTime: number | undefined,
    environmentTime: number | undefined,
    manualControl: PlayerInput | undefined;
  const abort = new AbortController(),
    persist = () => save.write(settings),
    applyPreferences = () => {
      if (quality.mode !== settings.quality) quality.setMode(settings.quality);
      view.sensitivity = preferences.value.sensitivity;
      view.smoothing = preferences.value.cameraSmoothing;
      view.invertX = preferences.value.invertX;
      preferences.save();
      persist();
    };
  applyPreferences();
  const economy = new Economy(run.store);
  const vehicles = new Vehicles(city.physics.world, audio, text => hud?.notify(text));
  await vehicles.loadModels();
  vehicles.onSurfaceEvent=(car,event)=>{if(event.type==='collision'||event.type==='glass')worldEffects.impact(car,event.intensity);};
  vehicles.feedback = strength => void input.rumble(strength);
  vehicles.configure(run.route, world.car, run.store.data.car, city.layout);
  world.car.visible = false; scene.add(vehicles.root);
  const population=new Population(vehicles,city.layout,quality.current);population.enabled=query.get('population')!=='off';
  await population.initialize(run.player.position);vehicles.dynamics=population;vehicles.extraEmitters=()=>population.emitters();scene.add(population.visuals.root);
  const blocked = () => paused || rebuilding || choosing || document.hidden;
  const setPause = (value: boolean): void => {
    paused = value;
    loop?.setPaused(blocked());
    hud?.setPause(value);
    audio.pause(value);
    quality.resetMonitor();
    previousTime = undefined;
  };
  const reset = () => {
    if (mode === "drive") { vehicles.recover(); return; }
    if (mode !== "parkour") setMode("parkour");
    run.reset();
    autoRun = true;
    pendingJump = pendingInteract = false;
    view.reset(run.route.spawnDirection);
    if (paused) setPause(false);
    hud?.notify("Same skyline. Fresh momentum.");
  };
  const resize = () => {
    context.resize(host.clientWidth, host.clientHeight, quality.current);
    view.resize(host.clientWidth, host.clientHeight);
    fly.resize(host.clientWidth, host.clientHeight);
    vehicles.cameras.resize(host.clientWidth, host.clientHeight);
    view.camera.far = 6500;
    view.camera.updateProjectionMatrix();
  };
  const setMode = (next: ExploreMode): void => {
    if (next === mode) return;
    let exited: V3 | undefined;
    if (mode === "drive" && next !== "drive") exited = vehicles.exit(true);
    if (next === "drive" && !vehicles.active) return;
    if (next === "parkour" || next === "fly") vehicles.inLab = false;
    input.clear();
    pendingJump = pendingInteract = false;
    if (street) street.player.body.setEnabled(next === "street");
    if (next === "fly") {
      const anchor =
        mode === "street" && street
          ? street.player.position
          : run.player.position;
      fly.enter(anchor, view.yaw);
    }
    if (next === "street") {
      let p: V3;
      if (exited) p = exited;
      else if (mode === "fly") {
        const f = fly.camera.position;
        p = v3(
          Math.max(-1580, Math.min(1850, f.x)),
          0,
          Math.max(-1850, Math.min(1850, f.z)),
        );
        p = city.physics.landingAt({ ...p, y: f.y });
      } else
        p = v3(
          run.route.roofs[0]!.center.x + run.route.roofs[0]!.width / 2 + 4,
          0,
          run.route.spawn.z,
        );
      street?.dispose();
      street = new StreetSession(city.physics, p, {
        goal: run.route.goal,
        carPosition: run.route.carPosition,
      });
      city.physics.stream(p, true);
      view.reset(run.player.facing);
    }
    mode = next;
    runner.root.visible = next !== "fly" && next !== "drive";
    runner.ghostRoot.visible = false;
    if (next === "parkour") view.reset(run.player.facing);
    cityHUD?.setMode(next);
    hud?.notify(
      next === "parkour"
        ? "Back above the city."
        : next === "fly"
          ? "Free flight · Space up / X down · Shift fast"
          : next === "drive" ? `${vehicles.active?.car.definition.name??"Your car"} · your rooftop run is on hold.` : "The street is yours. Your rooftop run is on hold.",
    );
  };
  const createStreet = (p: V3): void => {
    street?.dispose();
    street = new StreetSession(city.physics, p, { goal: run.route.goal, carPosition: run.route.carPosition });
    city.physics.stream(p, true); mode = "street"; cityHUD?.setMode(mode); runner.root.visible = true; runner.ghostRoot.visible = false;
    view.reset(v3(0, 0, 1)); input.clear(); pendingJump = pendingInteract = false;
  };
  vehicles.onStore=createStreet;
  const enterCar = (entry: VehicleTarget): boolean => {
    if (!vehicles.enter(entry.car.id)) return false;
    if (street) street.player.body.setEnabled(false);
    mode = "drive"; cityHUD?.setMode(mode); runner.root.visible = runner.ghostRoot.visible = false;
    input.clear(); pendingJump = pendingInteract = false; return true;
  };
  const exitDriving = (): boolean => {
    const p = vehicles.exit(); if (!p) return false;
    createStreet(p); return true;
  };
  const services=new VehicleServices(vehicles,city.layout,value=>{setPause(value);if(value)hud?.setPause(false);},entry=>{enterCar(entry);},text=>hud?.notify(text),cost=>{const ok=economy.spend(cost);if(!ok)hud?.notify(`This service costs $${cost}. Find a cache or finish an activity first.`);return ok;});scene.add(services.root);
  const findCar = (id?:string): void => {
    if (vehicles.active) vehicles.exit(true);
    vehicles.inLab=false;
    const owned=vehicles.garage.data.lastOwned,liveOwned=[...vehicles.cars.values()].find(e=>e.car.id!=='lab'&&e.vin===owned?.vin);
    let entry=vehicles.cars.get(id??liveOwned?.car.id??(owned?'':run.store.data.car?'reward':'parked'));
    const savedVin=id==='reward'?'parkour-reward':id===undefined?owned?.vin:undefined;
    if(!entry&&savedVin&&vehicles.garage.data.slots.some(c=>c.vin===savedVin))entry=vehicles.retrieve(savedVin,services.zones.find(z=>z.type==='garage')!.spawn);
    entry??=vehicles.cars.get('parked')!;
    const p=entry.car.exitPosition()??v3(entry.car.position.x+2.3,entry.car.position.y-.55,entry.car.position.z);
    createStreet(p);if(paused)setPause(false);
    hud?.notify(`${entry.car.definition.name} is waiting. Walk to the door and press E.`);
  };
  const openLab = async (definition?:string): Promise<void> => {
    if (rebuilding) return;
    rebuilding = true; loop?.setPaused(true);
    // Opening from a pause button resumes the lab, but Escape DURING the async
    // compile must remain the user's pause choice, not be undone on completion.
    if (paused) setPause(false);
    hud?.notify("Opening the handling proving ground…");
    try {
      await vehicles.lab(definition); if (street) street.player.body.setEnabled(false);
      mode = "drive"; cityHUD?.setMode(mode); runner.root.visible = runner.ghostRoot.visible = false;
      world.root.visible = city.root.visible = false;
      vehicles.render(1, 0, environment.night.value, settings.reducedMotion, view.camera);
      await renderer.compileAsync(scene, vehicles.cameras.camera);
      hud?.notify("Handling lab · clockwise loop, gravel, central jump, slope and an impact wall · Esc for cabin studies");
    } catch (error) { console.error("Handling lab could not open:", error); hud?.notify("The handling lab could not be prepared. The city is still available."); }
    finally { rebuilding = false; input.clear(); loop?.setPaused(blocked()); loop?.resetClock(); previousTime = undefined; }
  };
  const restart = async (nextSeed?: number) => {
    if (rebuilding) return;
    rebuilding = true;
    vehicles.exit(true); vehicles.inLab = false;
    loop?.setPaused(true);
    hud?.notify("Charting your next line…");
    try {
      run.length = preferences.value.length;
      if (nextSeed === undefined) await run.newSeed();
      else await run.start(nextSeed);
      const next = new RooftopScene(run.route, true);
      await next.build();
      next.externalLighting = true;
      scene.remove(world.root);
      world.scene.add(world.root);
      world.dispose();
      world = next;
      vehicles.configure(run.route, world.car, run.store.data.car, city.layout); world.car.visible = false;
      scene.add(world.root);
      world.applyQuality(quality.current);
      city.physics.setOpening(run.route);
      mode = "parkour";
      cityHUD?.setMode(mode);
      runner.root.visible = true;
      view.reset(run.route.spawnDirection);
      view.update(run, 1 / 60, true);
      runner.update(run, 1, 0);
      world.update(run, 0, settings.reducedMotion);
      await renderer.compileAsync(scene, view.camera);
      autoRun = true;
      const url = new URL(location.href);
      url.searchParams.set("seed", String(run.seed));
      url.searchParams.set("length", run.length);
      history.replaceState(null, "", url);
    } catch (error) {
      console.error("Route rebuild failed:", error);
      hud?.notify("Could not rebuild the district. Reload to retry.");
    } finally {
      rebuilding = false;
      loop?.setPaused(blocked());
      loop?.resetClock();
      previousTime = undefined;
    }
  };
  const startAtMarker = async (id: string, nextSeed?: number) => {
    const marker = city.layout.markers.find(
      (m) => m.id === id && m.type === "parkour",
    );
    if (!marker) return false;
    run.marker = marker.id;
    run.origin = { ...marker.position };
    await restart(nextSeed);
    return true;
  };
  const openSetup = async () => {
    if (choosing || rebuilding) return;
    choosing = true;
    loop?.setPaused(true);
    if (paused) setPause(false);
    input.clear();
    const changed = await setup.show();
    if (changed) await restart(run.seed);
    applyPreferences();
    choosing = false;
    input.clear();
    loop?.setPaused(blocked());
    loop?.resetClock();
    previousTime = undefined;
  };
  hud = new ParkourHUD(
    document.querySelector<HTMLElement>("#interface")!,
    input,
    settings,
    {
      pause: () => setPause(!paused),
      reset,
      impulse: () => {
        pendingJump = true;
      },
      camera: () => vehicles.active ? hud.notify(vehicles.cameras.cycle()) :
        view.reset(
          mode === "street" && street
            ? street.player.facing
            : run.player.facing,
        ),
      settingsChanged: persist,
      quality: (q) => {
        quality.setMode(q);
        settings.quality = q;
        persist();
      },
      resetSave: () => {
        if (
          !confirm(
            "Reset all Crosstown settings, best times, ghosts, cash, cars/garage, paint, weapons/ammo, activities, hidden caches and radio favourites/session? Other projects are not affected.",
          )
        )
          return;
        run.store.clear();
        city.clearSave();
        save.clear();
        preferences.storage.clear();
        vehicles.storage.clear(); vehicles.garage.clear(); new SaveStore("crosstown:audio:v1").clear();
        life.resetSave();
        location.reload();
      },
    },
    audio,
  );
  hud.setBackend(context.backend);
  hud.controls(settings.diagnostics);
  setup = new SessionSetup(preferences, settings, applyPreferences);
  cityHUD = new CityHUD(
    city.layout,
    environment,
    setMode,
    () => void openSetup(),
    (p) => {
      waypoint = { ...p };
      hud.notify(`Waypoint set · ${Math.round(p.x)}, ${Math.round(p.z)}`);
    },
  );
  vehicleHUD = new VehicleHUD(vehicles, input, openLab, () => findCar(), () => findCar("parked"));
  services.mount(document.querySelector<HTMLElement>('#interface')!);
  const life = new CityLife(vehicles,population,city.layout,audio,economy,()=>{
    const player=mode==='street'&&street?street.player:run.player;
    return {mode,position:mode==='fly'?fly.camera.position:mode==='drive'&&vehicles.active?vehicles.active.car.position:player.position,body:mode==='drive'&&vehicles.active?vehicles.active.car.body:player.body,collider:mode==='drive'&&vehicles.active?vehicles.active.car.collider:player.collider,camera:mode==='drive'?vehicles.cameras.camera:mode==='fly'?fly.camera:view.camera,worlds:mode==='parkour'?[run.stage.world,city.physics.world]:[city.physics.world],night:environment.night.value,paused:blocked(),mapOpen:cityHUD.mapOpen};
  },{notify:text=>hud.notify(text),pause:value=>{setPause(value);if(value)hud.setPause(false);},respawn:p=>{vehicles.exit(true);vehicles.inLab=false;createStreet(p);if(paused)setPause(false);},startParkour:id=>startAtMarker(id),waypoint:p=>cityHUD.setWaypoint(p)});
  scene.add(life.root);
  const effectsSettings=new EffectsSettings(settings,persist);
  await life.load();
  const carButton = document.createElement("button"); carButton.id = "city-find-car"; carButton.title = "Find the parked sedan; E to enter"; carButton.innerHTML = '◇ <span>Cars</span>';
  carButton.onclick = () => findCar(); cityHUD.root.querySelector(".city-tools")!.append(carButton);
  const garageButton=document.createElement('button');garageButton.id='city-find-garage';garageButton.title='Route to the nearest working garage';garageButton.innerHTML='▱ <span>Garage</span>';garageButton.onclick=()=>{const p=vehicles.active?.car.position??street?.player.position??run.player.position,zone=services.zones.filter(z=>z.type==='garage').sort((a,b)=>Math.hypot(a.position.x-p.x,a.position.z-p.z)-Math.hypot(b.position.x-p.x,b.position.z-p.z))[0]!;waypoint={...zone.position};hud.notify(`${zone.name} marked · M for the connected-road route · E / F in the glowing bay`);};cityHUD.root.querySelector('.city-tools')!.append(garageButton);
  const trafficTools=document.createElement('div');trafficTools.innerHTML='<p class="setting-note traffic-note" id="population-readout">Living streets · medium target 60 cars / 120 people · adaptive density</p><label class="switch-row"><span>Siren reaction test<small>Real sight-based police now use this reaction hook.</small></span><input type="checkbox" id="siren-test" role="switch"></label>';document.querySelector('.driving-settings')!.append(trafficTools);trafficTools.querySelector<HTMLInputElement>('#siren-test')!.onchange=e=>population.siren((e.target as HTMLInputElement).checked);
  window.addEventListener("crosstown-find-car", e => findCar((e as CustomEvent<string>).detail), { signal: abort.signal });
  window.addEventListener("crosstown-settings-changed", persist, { signal: abort.signal });
  quality.onChange = () => {
    world.applyQuality(quality.current);
    city.applyQuality(quality.current); population.applyQuality(quality.current); environment.applyQuality(quality.current);sun.shadow.needsUpdate=true;
    sun.castShadow = quality.current.shadows;
    if (sun.shadow.mapSize.x !== quality.current.shadowMapSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(
        quality.current.shadowMapSize,
        quality.current.shadowMapSize,
      );
    }
    resize();
  };
  resize();
  run.on("movement", (e) => audio.effect(String(e.action)));
  run.on("checkpoint", () => {
    audio.effect("checkpoint");
    void input.rumble();
    hud.notify(
      `Checkpoint ${run.checkpoint + 1} / ${run.route.checkpoints.length} · ${run.route.checkpoints[run.checkpoint]!.name}`,
    );
  });
  run.on("fall", () => {
    audio.effect("fall");
    view.reset(run.player.facing);
    hud.notify("Back at your checkpoint · +5s penalty");
  });
  run.on("hazard", () => {
    audio.effect("hazard");
    void input.rumble();
  });
  run.on("pickup", (e) => {
    const p = e.pickup as { type: string };
    audio.effect(p.type === "coin" ? "coin" : "power");
    if (p.type === "time") hud.notify("+20 seconds · keep your line");
  });
  run.on("timeout", () => {
    autoRun = true;
    view.reset(run.route.spawnDirection);
    hud.notify("Time is up. Same seed, another shot.");
  });
  run.on("finish", () => {
    vehicles.unlock();
    audio.finish();
    void input.rumble();
  });
  run.on("locked", () =>
    hud.notify("Finish this run to unlock the night skyline."),
  );
  run.on("night", () => {
    autoRun = true;
    view.reset(run.route.spawnDirection);
    hud.notify(
      run.night
        ? "Blue hour · faster hazards, tighter clock"
        : "Back in the sunshine",
    );
  });
  run.on("reset", () => {
    autoRun = true;
  });
  window.addEventListener("resize", resize, { signal: abort.signal });
  window.addEventListener("parkour-new-seed", () => void restart(), {
    signal: abort.signal,
  });
  document.addEventListener(
    "visibilitychange",
    () => {
      loop.setPaused(blocked());
      loop.resetClock();
      previousTime = undefined;
      quality.resetMonitor();
      input.clear();
    },
    { signal: abort.signal },
  );
  loop = new FixedStepLoop(
    {
      beforeFrame(dt) {
        frameProfile.begin();
        frame = input.poll();
        if (!choosing) {
          if (input.pressed("pause")) {
            if (life.closeOverlay()) { /* the active radio/service closes first */ }
            else if (services.opened) services.close();
            else if (cityHUD.mapOpen) cityHUD.toggleMap(false);
            else setPause(!paused);
          }
          if (input.pressed("diagnostics")) {
            settings.diagnostics = !settings.diagnostics;
            hud.controls(settings.diagnostics);
            persist();
          }
          if (!paused && !rebuilding) {
            life.beforeFrame(input);
            if (input.pressed("reset")&&!life.armed) reset();
            if (input.pressed("newSeed") && mode === "parkour") void restart();
            if (input.pressed("night") && mode === "parkour")
              run.setNight(!run.night);
            if (input.pressed("ghost")) {
              run.ghostEnabled = !run.ghostEnabled;
              hud.notify(`Best-run ghost ${run.ghostEnabled ? "on" : "off"}`);
            }
            if (input.pressed("camera") && vehicles.active) hud.notify(vehicles.cameras.cycle());
            else if (input.pressed("camera"))
              view.reset(
                mode === "street" && street
                  ? street.player.facing
                  : run.player.facing,
              );
            if (input.pressed("fly"))
              setMode(mode === "fly" ? "parkour" : "fly");
            if (input.pressed("street"))
              setMode(mode === "street" ? "parkour" : "street");
            if (input.pressed("map")) cityHUD.toggleMap();
            if (input.pressed("session")) void openSetup();
            pendingJump ||= input.pressed("impulse");
            pendingInteract ||= input.pressed("interact");
            if (!cityHUD.mapOpen) {
              if (mode === "fly")
                fly.update(
                  frame,
                  dt,
                  input.isHeld("impulse"),
                  input.isHeld("slide"),
                );
              else if (mode !== "drive") view.look(frame, dt);
              if (mode === "drive") vehicles.handleActions(input, dt);
            }
            if (Math.abs(frame.moveX) + Math.abs(frame.moveY) > 0.01)
              autoRun = false;
          }
        }
        input.endFrame();frameProfile.mark("input");
      },
      fixedUpdate(dt) {
        if (rebuilding || choosing || cityHUD.mapOpen) return;
        life.fixed(dt);
        if(mode === "fly"){population.simulateOnly(dt,fly.camera.position);return;}
        if (mode === "drive" && vehicles.active) {
          if (pendingInteract) { pendingInteract = false; if(!life.interact()&&!services.interact(vehicles.active.car.position))exitDriving();pendingJump = false; return; }
          city.physics.update(vehicles.active.car.position);
          vehicles.preStep(dt, vehicles.active.car.position); city.physics.world.step(); cityWorldSteps++; vehicles.postStep(dt);
          pendingJump = pendingInteract = false; return;
        }
        const movement = view.movement(frame.moveX, frame.moveY);
        if (mode === "parkour" && autoRun && run.elapsed < 1.25) {
          movement.x = run.route.spawnDirection.x;
          movement.z = run.route.spawnDirection.z;
        }
        const control = manualControl ?? {
          ...movement,
          jump: pendingJump,
          sprint: frame.sprint,
          slide: input.isHeld("slide"),
          interact: pendingInteract,
          traverse: input.isHeld("interact"),
        };
        if (mode === "street" && street) {
          if(pendingInteract&&(life.interact()||services.interact(street.player.position))){pendingJump=pendingInteract=false;return;}
          if (pendingInteract) { const near = vehicles.nearest(street.player.position); if (near && enterCar(near)) { pendingJump = pendingInteract = false; return; } }
          street.update(dt, control, vehicles); cityWorldSteps++;
          const found = city.collectAt(street.player.position);
          if (found.length) {
            run.store.data.cash += found.length * 50;
            run.store.storage.write(run.store.data);
            hud.notify(`Hidden cache found · +${found.length * 50} cash`);
            audio.effect("coin");
          }
          if (pendingInteract) {
            const marker = city.layout.markers.find(
              (m) =>
                m.type === "parkour" &&
                Math.hypot(
                  m.position.x - street!.player.position.x,
                  m.position.z - street!.player.position.z,
                ) < 10 &&
                Math.abs(m.position.y - street!.player.position.y) < 4,
            );
            if (marker) {
              void startAtMarker(marker.id);
            }
          }
        } else {
          run.setInput(control);
          run.update(dt);
          if (!blocked()) { vehicles.preStep(dt, run.player.position); city.physics.world.step(); cityWorldSteps++; vehicles.postStep(dt); }
        }
        pendingJump = pendingInteract = false;
      },
      render(alpha, dt) {
        frameProfile.mark("fixedUpdate");
        if (rebuilding) return;
        const now = performance.now();
        renderer.info.reset();
        if (
          !paused &&
          !choosing &&
          !document.hidden &&
          previousTime !== undefined
        )
          quality.sample((now - previousTime) / 1000);
        previousTime = now;
        const subject = mode === "street" && street ? street : run,
          anchor =
            mode === "fly" ? fly.camera.position : mode === "drive" && vehicles.active ? vehicles.active.car.position : subject.player.position;
        let activeCamera: import("three/webgpu").Camera = mode === "fly" ? fly.camera : view.camera;
        if (mode !== "fly" && mode !== "drive") {
          runner.update(subject, alpha, paused || choosing ? 0 : dt);
          view.update(
            subject,
            Math.min(dt, 0.1),
            settings.reducedMotion,
            alpha,
          );
        } else runner.ghostRoot.visible = false;
        const realEnvironmentDelta =
          environmentTime === undefined
            ? 0
            : Math.min(5, Math.max(0, (now - environmentTime) / 1000));
        environmentTime = now;
        environment.update(
          paused || choosing || document.hidden ? 0 : realEnvironmentDelta,
          anchor,
          run.night && mode === "parkour",
        );
        world.root.visible = city.root.visible = !vehicles.inLab;
        world.update(
          run,
          run.elapsed + run.finishTime,
          settings.reducedMotion,
          anchor,
        );
        world.applyDay(environment.night.value);
        world.car.visible = false;
        const reward = vehicles.cars.get("reward"); if (reward) { world.carArrow.position.x = reward.car.position.x; world.carArrow.position.z = reward.car.position.z; world.carArrow.position.y = reward.car.position.y + 4.2; world.carArrow.visible = run.store.data.car && !reward.car.engine.occupied; } else world.carArrow.visible=false;
        frameProfile.mark("cameraEnvironmentRoofs");
        if (!vehicles.inLab) city.update(anchor, dt, mode === "street" || mode === "drive");
        frameProfile.mark("cityStreaming");
        population.render(anchor,alpha,paused||choosing||document.hidden?0:dt,environment.night.value,now);
        frameProfile.mark("populationRender");
        activeCamera = vehicles.render(alpha, paused || choosing ? 0 : dt, environment.night.value, settings.reducedMotion, activeCamera);
        effectiveEffects=effectPolicy(quality.current,settings.disabledEffects,environment.weather,settings.reducedMotion,environment.night.value);
        post.configure(effectiveEffects);worldEffects.configure(effectiveEffects);city.configureEffects(effectiveEffects);
        const candidates=effectCandidates;candidates.length=0;
        if(effectiveEffects.lightCones||effectiveEffects.tireSmoke||effectiveEffects.skidMarks){
          if(vehicles.active)candidates.push({car:vehicles.active.car,headlights:vehicles.active.visual.headlights});
          for(const entry of vehicles.cars.values())if(entry!==vehicles.active&&entry.car.body.isEnabled())candidates.push({car:entry.car,headlights:entry.visual.headlights});
          for(const proxy of population.fullCars.values())candidates.push({car:proxy.car,headlights:environment.night.value>.4});
          for(const unit of life.police.units)if(unit.active&&unit.car.body.isEnabled())candidates.push({car:unit.car,headlights:environment.night.value>.4});
          for(const rival of life.challenges.rivals)if(rival.car.body.isEnabled())candidates.push({car:rival.car,headlights:environment.night.value>.4});
        }
        worldEffects.update(paused||choosing?0:dt,activeCamera,anchor,candidates,environment.weather==='rain',environment.night.value,roadHeightAt);
        vehicles.headlight.visible=effectiveEffects.lightCones&&!!vehicles.active&&vehicles.headlight.intensity>0;
        vehicles.mirrors(renderer, scene, quality.current,effectiveEffects.mirrors);
        frameProfile.mark("vehicleEffectsMirrors");
        // Medium shadows refresh at 15 Hz; High+ remain every display frame.
        if(quality.current.shadows&&(quality.tier>=2||vehicles.frame%4===0))sun.shadow.needsUpdate=true;
        hudClock += dt;
        if (hudClock > 0.1) {
          hud.update(
            run,
            quality,
            activeCamera,
            host.clientWidth,
            host.clientHeight,
            save.available && run.store.storage.available,
            paused,
            sceneDraws,
          );
          cityHUD.update(anchor);
          services.update(anchor);
          const populationReadout=document.querySelector('#population-readout');if(populationReadout)populationReadout.textContent=`Living streets · ${population.traffic.cars.length} moving cars / ${population.pedestrians.agents.length} people · ${Math.round(population.budget.factor*100)}% density budget`;
          vehicleHUD.update(mode === "street" && street ? street.player.position : undefined);
          if(paused)effectsSettings.update(effectiveEffects,quality.current.name,quality.frameMs);
          hudClock = 0;
        }
        life.render(alpha,paused||choosing?0:dt,activeCamera,cityHUD.navigation.route,cityHUD.navigation.target);
        frameProfile.mark("hudLife");
        post.render(scene,activeCamera,environment,realEnvironmentDelta,roadHeightAt(anchor.x,anchor.z));
        frameProfile.mark("renderSubmit");frameProfile.end();
        sceneDraws=renderer.info.render.drawCalls;sceneTriangles=renderer.info.render.triangles;
        if(firstRenderMs===0)firstRenderMs=performance.now()-bootStarted;
        document
          .querySelector(".run-controls")
          ?.classList.toggle(
            "is-dim",
            run.elapsed > 10 && !settings.diagnostics,
          );
      },
    },
    APP.fixedStep,
    APP.maxFrameDelta,
    APP.maxSubsteps,
  );
  status.textContent = "Catching the sunlight…";
  world.update(run, 0);
  city.update(run.player.position, 1, false);
  environment.update(0, run.player.position, false);
  // Compile every material variant (road shadows, emissive instances, rain and ghost included) before play.
  // The off-camera representative block contains both road and building variants; compilation is not a streaming task.
  const warm: {
    object: import("three/webgpu").Object3D;
    culled: boolean;
    visible: boolean;
  }[] = [];
  scene.traverse((object) => {
    warm.push({
      object,
      culled: object.frustumCulled,
      visible: object.visible,
    });
    object.frustumCulled = false;
    object.visible = true;
  });
  await renderer.compileAsync(scene, view.camera);
  for (const item of warm) {
    item.object.frustumCulled = item.culled;
    item.object.visible = item.visible;
  }
  // Warm the actual restored light/visibility set too; forcing every hidden
  // object on above must not leave first-play variants to synchronous compile.
  await renderer.compileAsync(scene, view.camera);
  // Compile/render the actual post graph under the existing boot status, never
  // let the first playable frame pay a surprise full-screen shader build.
  post.render(scene,view.camera,environment,1/60,roadHeightAt(run.player.position.x,run.player.position.z));
  const startupReadyMs = performance.now() - bootStarted;
  status.remove();
  document.documentElement.dataset.ready = "true";
  document.documentElement.dataset.backend = context.backend;
  renderer.setAnimationLoop(loop.frame);
  if (import.meta.env.DEV || query.has("test")) {
    window.__parkour = createTestAPI(
      run,
      view,
      runner,
      () => ({
        backend: context.backend,
        startupReadyMs,
        firstRenderMs,
        workerReady: worker.ready,
        fps: quality.fps,
        frameMs: quality.frameMs,
        effects:{post:post.snapshot(),world:worldEffects.snapshot(),policy:{...effectiveEffects}},
        quality: quality.current.name,
        paused,
        choosing,
        ticks: loop.ticks,
        draws: sceneDraws,
        triangles: sceneTriangles,
        worldBuilt: world.built,
        activeChunks: world.chunks.filter((c) => c.root.visible).length,
        input: input.lastEvent,
        device: input.deviceKind,
        moveX: frame.moveX,
        moveY: frame.moveY,
        initialStreamMs: run.stage.initialStreamMs,
        audioState: audio.context?.state ?? "awaiting-browser-gesture",
        mode,
        vehicle: vehicles.active?.car.snapshot() ?? null,
        city: city.snapshot(),
        environment: environment.snapshot(), population:{cars:population.traffic.cars.length,pedestrians:population.pedestrians.agents.length,budget:population.budget.snapshot()},
      }),
      setPause,
      restart,
      (value) => renderer.setAnimationLoop(value ? null : loop.frame),
    );
    Object.assign(window.__parkour, {
      input: (value: PlayerInput | undefined) => {
        manualControl = value;
      },
    });
    let rearMarker: Group | undefined;
    window.__vehicles = {
      snapshot: () => ({ ...vehicles.snapshot(), mode, cityWorldSteps, rewardGuidance: { route: { ...run.route.carPosition }, arrow: world.carArrow.position.toArray() }, backend: context.backend, draws: sceneDraws, triangles: sceneTriangles, fps: quality.fps }),
      services: () => services.snapshot(),
      roster: () => Object.values(CARS),
      damage: (speedChange:number) => vehicles.active?.car.damageState.hit(speedChange),
      paint: (value:string) => vehicles.paint(value),
      store: () => vehicles.storeActive(),
      retrieve: (vin:string) => { const zone=services.zones.find(z=>z.type==='garage')!; const entry=vehicles.retrieve(vin,zone.spawn);if(entry)return enterCar(entry);return false; },
      recoverOwned: () => {const zone=services.zones.find(z=>z.type==='garage')!;const entry=vehicles.recoverOwned(zone.spawn);if(entry)return enterCar(entry);return false;},
      quality: (mode: 0 | 1 | 2 | 3) => { quality.setMode(mode); settings.quality = mode; persist(); },
      mirrorPixels: async () => {
        const results = [];
        for (const mirror of vehicles.cabin?.mirrors ?? []) {
          if (!mirror.updates || !mirror.target) { results.push({ updates: 0,allocated:!!mirror.target }); continue; }
          const pixels = await renderer.readRenderTargetPixelsAsync(mirror.target, 0, 0, mirror.target.width, mirror.target.height); let hash = 2166136261, magenta = 0, lo = 255, hi = 0;
          for (let i = 0; i < pixels.length; i++) { hash = Math.imul(hash ^ Number(pixels[i]), 16777619) >>> 0; if (i % 4 !== 3) { lo = Math.min(lo, Number(pixels[i])); hi = Math.max(hi, Number(pixels[i])); } if (i % 4 === 0 && Number(pixels[i]) > 130 && Number(pixels[i + 1]) < 60 && Number(pixels[i + 2]) > 100) magenta++; }
          results.push({ updates: mirror.updates, hash, magentaPixels: magenta, range: hi - lo, dimensions: [mirror.target.width, mirror.target.height] });
        }
        return results;
      },
      mirrorBounds: () => (vehicles.cabin?.mirrors ?? []).map(m => {
        m.mesh.updateWorldMatrix(true, false); const attr = m.mesh.geometry.getAttribute('position'), points = [];
        for (let i = 0; i < attr.count; i++) { const p = new Vector3().fromBufferAttribute(attr, i).applyMatrix4(m.mesh.matrixWorld).project(vehicles.cameras.camera); points.push({ x: (p.x * .5 + .5) * host.clientWidth, y: (-p.y * .5 + .5) * host.clientHeight }); }
        const left = Math.min(host.clientWidth, Math.max(0, Math.floor(Math.min(...points.map(p => p.x))))), top = Math.min(host.clientHeight, Math.max(0, Math.floor(Math.min(...points.map(p => p.y)))));
        return { left, top, width: Math.max(0, Math.min(host.clientWidth, Math.ceil(Math.max(...points.map(p => p.x)))) - left), height: Math.max(0, Math.min(host.clientHeight, Math.ceil(Math.max(...points.map(p => p.y)))) - top) };
      }),
      rearMarker: async (visible: boolean) => {
        if (rearMarker) { rearMarker.removeFromParent(); rearMarker.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); (o.material as import("three/webgpu").Material).dispose(); } }); rearMarker = undefined; }
        if (visible && vehicles.active) {
          const { BoxGeometry, MeshBasicNodeMaterial } = await import("three/webgpu"); rearMarker = new Group();
          for (const [height, color] of [[2.4, '#ff00cc'], [.1, '#00e7ff']] as const) { const bar = new Mesh(new BoxGeometry(3.5, .6, .4), new MeshBasicNodeMaterial({ color, toneMapped: false })); bar.quaternion.copy(vehicles.active.car.rotation); bar.position.copy(new Vector3(0, height, -9).applyQuaternion(vehicles.active.car.rotation).add(vehicles.active.car.position)); rearMarker.add(bar); }
          scene.add(rearMarker);
        }
      },
      velocity: (v: V3) => vehicles.active?.car.body.setLinvel(v, true),
      ground: (p: V3) => {
        const hits: unknown[] = [];
        city.physics.world.intersectionsWithRay(new RAPIER.Ray(v3(p.x, p.y + 10, p.z), v3(0, -1, 0)), 40, true, hit => { hits.push({ y: p.y + 10 - hit.timeOfImpact, normal: { ...hit.normal }, shape: hit.collider.shape.type, metadata: hit.collider.parent()?.userData }); return true; }, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
        return { hits, step: city.physics.world.timestep, gravity: { ...city.physics.world.gravity } };
      },
      lab: openLab,
      find: findCar,
      enter: (id: string) => { const entry = vehicles.cars.get(id); return entry ? enterCar(entry) : false; },
      exit: exitDriving,
      exitProbe: () => vehicles.active?.car.exitPosition() ?? null,
      audioBudget: () => {
        const car = vehicles.active?.car; if (!car) return null;
        const p = vehicles.cameras.camera.position;
        vehicles.sound.update(Array.from({ length: 24 }, (_, i) => ({ id: `budget-${i}`, car, engine: car.definition.engine, profile: car.definition.soundProfile, position: v3(p.x + i * .5, p.y, p.z), priority: i === 23 ? 1 : 0 })), vehicles.cameras.camera, 1 / 60, 'budget-23');
        for (let i = 0; i < 24; i++) vehicles.sound.effect('horn', .05);
        const state = vehicles.sound.snapshot(); vehicles.sound.update([], vehicles.cameras.camera, 0); return state;
      },
      camera: (index?: number) => index === undefined ? vehicles.cameras.cycle() : vehicles.cameras.reset(index),
      cabin: (id: CarClass) => vehicles.setCabin(id),
      assist: (value: boolean) => vehicles.setAssist(value),
      input: (value?: Partial<DriveInput>) => vehicles.testInput(value),
      ignition: () => vehicles.active?.car.engine.toggleIgnition(),
      manual: () => vehicles.active?.car.engine.toggleManual(),
      shift: (n: number) => vehicles.active?.car.engine.shift(n),
      gear: (n: number) => { if (vehicles.active) vehicles.active.car.engine.gear = Math.round(Math.max(-1, Math.min(6, n))); },
      fallback: (value: boolean) => vehicles.testFallback(value),
      recover: () => vehicles.recover(),
      teleport: (p: V3, yaw = 0) => { vehicles.active?.car.teleport(p, yaw); vehicles.cameras.reset(); },
      flip: () => vehicles.active?.car.body.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true),
      lights: () => { if (vehicles.active) vehicles.active.visual.headlights = !vehicles.active.visual.headlights; },
      step: (ticks: number, value: Partial<DriveInput> = {}) => {
        setPause(true); vehicles.testInput(value);
        for (let i = 0; i < Math.min(18000, Math.max(0, ticks)); i++) {
          if (vehicles.active) { vehicles.preStep(1 / 60, vehicles.active.car.position); city.physics.world.step(); cityWorldSteps++; vehicles.postStep(1 / 60); }
          else if (mode === "street" && street) { street.update(1 / 60, emptyInput(), vehicles); cityWorldSteps++; }
        }
        vehicles.testInput(undefined);
      },
    };
    window.__effects={
      profile:()=>frameProfile.snapshot(),profileReset:()=>frameProfile.reset(),
      resources:()=>({...resourceAudit(scene),post:post.snapshot().estimatedTargetBytes,shadow:{enabled:sun.castShadow,size:sun.shadow.mapSize.toArray(),estimatedDepthBytes:sun.castShadow?sun.shadow.mapSize.x*sun.shadow.mapSize.y*4:0,refresh:quality.tier>=2?"every frame":"every fourth frame"},mirrors:vehicles.cabin?.snapshot().mirrorTargets??0}),
      sun:()=>({direction:environment.sky.sunPosition.value.clone().normalize().toArray(),hour:environment.hour}),
      snapshot:()=>({quality:quality.snapshot(),policy:{...effectiveEffects},post:post.snapshot(),world:worldEffects.snapshot(),city:city.snapshot().lighting,rendererMemory:{...renderer.info.memory},wholeFrameDraws:sceneDraws,wholeFrameTriangles:sceneTriangles}),
      toggle:(name:EffectName,enabled:boolean)=>{settings.disabledEffects=settings.disabledEffects.filter(k=>k!==name);if(!enabled)settings.disabledEffects.push(name);persist();},
      all:(enabled:boolean)=>{settings.disabledEffects=enabled?[]:Object.keys(quality.current.effects)as EffectName[];persist();},
      fixture:(name:EffectName)=>{const a=vehicles.active?.car.position??street?.player.position??run.player.position;return worldEffects.fixture(name,{x:a.x,y:a.y-.55,z:a.z+4});},
      bypass:(value:boolean)=>{post.bypass=value;},
      draw:()=>{renderer.info.reset();effectiveEffects=effectPolicy(quality.current,settings.disabledEffects,environment.weather,settings.reducedMotion,environment.night.value);post.configure(effectiveEffects);worldEffects.configure(effectiveEffects);city.configureEffects(effectiveEffects);post.render(scene,vehicles.active?vehicles.cameras.camera:mode==='fly'?fly.camera:view.camera,environment,1/60,roadHeightAt(city.anchor.value.x,city.anchor.value.z));sceneDraws=renderer.info.render.drawCalls;sceneTriangles=renderer.info.render.triangles;return post.snapshot();},
    };
    window.__life = {
      snapshot:()=>life.snapshot(),hurt:(n:number)=>life.hurt(n),shop:()=>life.interact(),
      purchase:(id:import('./weapons/catalog').WeaponId,ammo=false)=>life.weapons.arsenal.buy(id,cost=>economy.spend(cost),ammo),
      waypoint:(p:V3)=>cityHUD.setWaypoint(p),navigation:()=>cityHUD.navigation,
      stepCity:(ticks:number)=>{setPause(false);for(let i=0;i<Math.min(3600,Math.max(0,ticks));i++){life.fixed(1/60);const p=vehicles.active?.car.position??street?.player.position??run.player.position;city.physics.update(p);vehicles.preStep(1/60,p);city.physics.world.step();cityWorldSteps++;vehicles.postStep(1/60);}},
    };
    window.__weapons={snapshot:()=>life.weapons.snapshot(),select:(id:import('./weapons/catalog').WeaponId|'unarmed')=>life.weapons.select(id),fire:(aim?:{origin:V3;direction:V3})=>life.weapons.fire(aim),reload:()=>life.weapons.reload()};
    window.__police={snapshot:()=>life.police.snapshot(),stars:(n:number)=>life.police.wanted.setStars(n,life.context().position),cones:(v:boolean)=>life.police.debugCones=v,report:(p:V3)=>life.police.report(p),sight:(origin:V3,feet:V3)=>life.police.probeSight(origin,feet),clear:()=>life.police.clear()};
    window.__challenges={snapshot:()=>life.challenges.snapshot(),start:(id:string)=>life.challenges.start(id),cancel:()=>life.challenges.cancel(),
      // Ordinary pedal/steering integration pilot; no teleports, impulses,
      // hidden steps, timer/score edits or reward injection inside this loop.
      pilot:(ticks:number,speed=20)=>{setPause(false);for(let i=0;i<Math.min(1200,Math.max(0,ticks));i++){const car=vehicles.active?.car,activity=life.challenges.active;if(!car||activity?.state!=='running')break;const goal=activity.activity.route[activity.gate];if(goal)driveRoute(car,activity.activity.route,activity.gate,speed);life.fixed(1/60);city.physics.update(car.position);vehicles.preStep(1/60,car.position);city.physics.world.step();cityWorldSteps++;vehicles.postStep(1/60);}return life.challenges.active?.snapshot();},
    };
    window.__radio={snapshot:()=>life.radio.snapshot(),open:()=>life.radio.toggle(true),select:(id:string)=>{const s=[...life.radio.stations,...life.radio.custom,...life.radio.favourites,...[{id:'lofi',kind:'procedural',name:'Slow Lane'},{id:'synthwave',kind:'procedural',name:'Night Drive'},{id:'funk',kind:'procedural',name:'Side Street'},{id:'ambient',kind:'procedural',name:'Far Shores'}]as import('./radio/sources').Station[]].find(s=>s.id===id);return s?life.radio.select(s):false;},paste:(url:string)=>life.radio.paste(url),browse:()=>life.radio.browse(),action:(a:'toggle'|'next'|'previous'|'shuffle')=>life.radio.action(a),favourite:()=>life.radio.favourite()};
    // Explicit stationary isolation only, never used by gameplay or FPS telemetry.
    // It stops the normal loop, preserves all visibility, then restores it exactly.
    let probeState: { object: import('three/webgpu').Object3D; visible: boolean }[] | undefined;
    const probeCamera=()=>vehicles.active?vehicles.cameras.camera:mode==='fly'?fly.camera:view.camera;
    window.__renderProbe={
      begin:()=>{if(probeState)return;renderer.setAnimationLoop(null);probeState=[];scene.traverse(object=>probeState!.push({object,visible:object.visible}));},
      objects:()=>{const groups=new Map<string,{objects:number;triangles:number}>();scene.traverse(o=>{if(o instanceof Mesh){const key=o.name||o.parent?.name||'unnamed',g=groups.get(key)??{objects:0,triangles:0};g.objects++;g.triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position')?.count??0)/3*((o as import('three/webgpu').InstancedMesh).isInstancedMesh?(o as import('three/webgpu').InstancedMesh).count:1);groups.set(key,g);}});return [...groups].sort((a,b)=>b[1].triangles-a[1].triangles);},
      only:(name:string)=>{for(const s of probeState??[])s.object.visible=s.visible;for(const [key,object] of [['city',city.root],['roofs',world.root],['life',life.root],['runner',runner.root],['vehicles',vehicles.root],['population',population.visuals.root]] as const)if(name!=='all'&&key!==name)object.visible=false;},
      shadows:(value:boolean)=>{sun.castShadow=value;renderer.shadowMap.enabled=value;sun.shadow.needsUpdate=true;},
      draw:()=>{renderer.info.reset();renderer.render(scene,probeCamera());return{draws:renderer.info.render.drawCalls,triangles:renderer.info.render.triangles};},
      end:()=>{for(const s of probeState??[])s.object.visible=s.visible;probeState=undefined;sun.castShadow=quality.current.shadows;renderer.shadowMap.enabled=quality.current.shadows;sun.shadow.needsUpdate=true;renderer.setAnimationLoop(loop.frame);loop.resetClock();previousTime=undefined;},
    };
    window.__population = {
      snapshot:()=>population.snapshot(),
      observe:(observer?: (state:Population)=>void)=>{population.afterStep=observer;},
      siren:(value:boolean)=>population.siren(value),gunfire:(p:V3)=>population.gunfire(p),
      density:(cars?:number,pedestrians?:number)=>population.density(cars,pedestrians),
      prime:(p:V3)=>{population.traffic.prime(p);population.pedestrians.prime(p);},
      find:(id:string)=>{const car=population.traffic.cars.find(c=>c.id===id)??population.traffic.parked.find(c=>c.id===id);if(!car)return false;createStreet(v3(car.position.x+Math.cos(car.yaw)*2.3,car.position.y-.55,car.position.z-Math.sin(car.yaw)*2.3));return true;},
      step:(ticks:number,p?:V3,observe?:(state:Population)=>void)=>{setPause(true);const anchor=p??(vehicles.active?.car.position??street?.player.position??run.player.position);for(let i=0;i<Math.min(18000,Math.max(0,ticks));i++){city.physics.update(anchor);vehicles.preStep(1/60,anchor);city.physics.world.step();cityWorldSteps++;vehicles.postStep(1/60);observe?.(population);}},
      rendering:(value:boolean)=>renderer.setAnimationLoop(value?loop.frame:null),
    };
    window.__city = {
      snapshot: () => ({
        mode,
        position: {
          ...(mode === "fly"
            ? fly.camera.position
            : mode === "drive" && vehicles.active ? vehicles.active.car.position : mode === "street" && street
              ? street.player.position
              : run.player.position),
        },
        waypoint,
        stream: city.snapshot(),
        environment: environment.snapshot(), population:{cars:population.traffic.cars.length,pedestrians:population.pedestrians.agents.length,budget:population.budget.snapshot()},
      }),
      mode: setMode,
      startMarker: startAtMarker,
      collect: (p: V3) => city.collectAt(p),
      clearCitySave: () => city.clearSave(),
      layout: () => city.layout,
      date: (value: string) => environment.setDate(value),
      hour: (value: number | null) => environment.setHour(value),
      weather:(value:import("./world/city/environment").Weather)=>{if(["clear","overcast","rain","fog"].includes(value)){environment.weather=value;environment.setHour(environment.hour);}},
      fly: (p: V3, target?: V3) => {
        setMode("fly");
        fly.teleport(p, target);
      },
      street: (p: V3) => {
        setMode("street");
        street!.player.respawn(p);
        city.physics.stream(p, true);
        view.reset(v3(0, 0, 1));
      },
      step: (ticks: number, value: Partial<PlayerInput> = {}) => {
        setPause(true);
        if (!street) setMode("street");
        for (let i = 0; i < Math.min(10000, ticks); i++)
          { street!.update(1 / 60, {
            ...emptyInput(),
            ...value,
            jump: i === 0 && !!value.jump,
          }, vehicles); cityWorldSteps++; }
      },
      setup: openSetup,
      flush: async (p: V3) => {
        for (const c of [...city.chunks.values()]) {
          void c;
        }
        const cx = Math.floor((p.x + 2000) / 128),
          cz = Math.floor((p.z + 2000) / 128);
        for (let x = cx - 1; x <= cx + 1; x++)
          for (let z = cz - 1; z <= cz + 1; z++)
            if (x >= 0 && x < 32 && z >= 0 && z < 32) {
              const data = await city.worker.chunk(x, z, 0);
              city.physics.provide(data);
            }
        city.physics.stream(p, true);
      },
      movement: (x: number, y: number) => view.movement(x, y),
    };
  }
  if (query.has("drive")) await openLab();
  if(query.get("explore")==="street")setMode("street");
  // /play has no onboarding / start state. Explicit old ?setup is still usable.
  if(query.has("setup")&&!query.has("drive"))void openSetup();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    abort.abort();
    input.dispose();
    worker.dispose();
    vehicles.onSurfaceEvent=undefined;post.dispose();worldEffects.dispose();effectsSettings.dispose();
    life.dispose();population.dispose();services.dispose();
    vehicles.dispose();
    vehicleHUD.dispose();
    audio.dispose();
    street?.dispose();
    run.dispose();
    setup.dispose();
    cityHUD.dispose();
    city.dispose();
    environment.dispose();
    scene.remove(runner.root, runner.ghostRoot, world.root);
    runner.dispose();
    world.scene.add(world.root);
    world.dispose();
    sun.dispose();
    renderer.dispose();
    context.gpuHandles?.device.destroy();
    delete window.__parkour;
    delete window.__city;
    delete window.__vehicles; delete window.__population; delete window.__life;
    delete window.__weapons; delete window.__police; delete window.__challenges; delete window.__radio; delete window.__renderProbe;
  };
  import.meta.hot?.dispose(dispose);
  window.addEventListener(
    "pagehide",
    (e) => {
      if (!e.persisted) dispose();
    },
    { signal: abort.signal },
  );
}
boot().catch((error) => {
  console.error("Crosstown initialization failed:", error);
  const status = document.querySelector<HTMLElement>("#boot-status");
  if (!status) return;
  status.classList.add("error");
  status.textContent =
    "The city engine could not initialize. Hardware acceleration and WebGPU or WebGL 2 are needed.";
  const button = document.createElement("button");
  button.textContent = "Try WebGL 2";
  button.onclick = () => {
    const u = new URL(location.href);
    u.searchParams.set("webgl", "");
    location.href = u.href;
  };
  status.append(button);
});
