// Fleet composition, ownership and garage integration. The city Rapier world still steps exactly once per fixed tick.
import { Group, Mesh, BoxGeometry, MeshStandardNodeMaterial, SpotLight, Vector3, type Object3D, type Scene, type Camera, type WebGPURenderer } from 'three/webgpu';
import type RAPIER from '@dimforge/rapier3d-compat';
import { SaveStore } from '../save';
import { v3, type RouteData, type V3 } from '../parkour/types';
import { roadHeightAt } from '../world/city/layout';
import type { CityLayout } from '../world/city/types';
import { findParking, installForecourt, type ParkingSpot } from './parking';
import type { InputManager } from '../core/input';
import type { QualityTier } from '../config/quality';
import type { ParkourAudio } from '../audio/parkour-audio';
import { VehicleAudio, profileFor, type SoundEmitter } from '../audio/vehicle-audio';
import { HARBOR, CABINS, CARS, ROSTER, type CarDefinition, type CarClass } from './cars';
import { neutralDrive, type DriveInput } from './engine';
import { Garage, type GarageCar } from './garage';
import { CarLibrary } from './library';
import { RaycastCar } from './physics';
import { CarVisual } from './visual';
import { Cockpit } from './cockpit';
import { VehicleCameras } from './cameras';
import { TestCircuit } from './circuit';

export interface VehicleEntry { car: RaycastCar; visual: CarVisual; locked: boolean; vin?: string; npc?: boolean }
interface Preferences { assist: boolean; mouseSteering: boolean; manual: boolean; cabin: CarClass }
export interface ExternalCar { id:string; definition:string; position:V3; yaw:number; npc:boolean; damage:number; paint?:string; retire():void }
export interface VehicleTarget {car:Pick<RaycastCar,'id'|'definition'|'position'|'carjacked'>&{damageState:{drivable:boolean}};locked:boolean;npc?:boolean}
export class Vehicles {
  readonly root = new Group(); readonly cars = new Map<string, VehicleEntry>(); readonly cameras = new VehicleCameras();
  readonly garage = new Garage(); readonly library = new CarLibrary();
  dynamics?:{preStep(dt:number,anchor:V3):void;postStep(dt:number):void}; extraEmitters?:()=>SoundEmitter[];
  externalNearest?: (p:V3,radius:number)=>ExternalCar|undefined; onTake?: (entry:VehicleEntry)=>void; onStore?: (position:V3)=>void;
  readonly headlight = new SpotLight('#ffedc3',0,44,.47,.35,1.4); private lightPoint = new Vector3();
  readonly sound: VehicleAudio; readonly circuit: TestCircuit;
  readonly storage = new SaveStore('crosstown:driving:v1');
  readonly preferences: Preferences = { assist: true, mouseSteering: false, manual: false, cabin: 'sedan' };
  feedback?: (strength: number) => void;
  onSurfaceEvent?:(car:RaycastCar,event:{type:string;intensity:number})=>void;
  active?: VehicleEntry; inLab = false; cabin?: Cockpit; elapsed = 0; fixedTicks = 0; frame = 0;
  private pendingExternal?:ExternalCar;
  private forecourts: { root: Group; body: RAPIER.RigidBody }[] = [];
  private cabins = new Map<CarClass, Cockpit>(); private source?: Object3D; private anchor = v3();
  get isCabinStudy():boolean {return this.cabinStudy;}
  private cabinStudy = false; private indicator = 0; private lights = false; private manualInput?: DriveInput; private fallbackProfile = false;
  constructor(readonly world: RAPIER.World, readonly audio: ParkourAudio, readonly notify: (text: string) => void) {
    this.root.add(this.headlight,this.headlight.target);
    this.root.name = 'Crosstown · twelve-model raycast fleet'; this.sound = new VehicleAudio(audio); this.circuit = new TestCircuit(world); this.root.add(this.circuit.root);
    const raw = this.storage.read<Partial<Preferences>>({});
    if (raw && typeof raw === 'object') {
      for (const key of ['assist', 'mouseSteering', 'manual'] as const) if (typeof raw[key] === 'boolean') this.preferences[key] = raw[key]!;
      if (CABINS.some(c => c.id === raw.cabin)) this.preferences.cabin = raw.cabin!;
    }
  }
  async loadModels():Promise<void> { await this.library.load(); }
  configure(route: RouteData, model: Object3D, unlocked: boolean, layout: CityLayout): void {
    this.clearCars(); this.source = model.clone(true); this.source.position.set(0, 0, 0); this.source.rotation.set(0, 0, 0);
    const r = route.roofs[0]!, preferred = v3(r.center.x + r.width / 2 + 9.2, 0, route.spawn.z + 10);
    const parked = findParking(route, layout, preferred), reward = findParking(route, layout, route.carPosition, parked.position);
    // Keep the finish flight, map and the glowing arrow aimed at the actual waiting vehicle.
    Object.assign(route.carPosition, reward.position);
    for (const spot of [parked, reward]) if (spot.road === null) this.addForecourt(spot);
    this.add('parked', parked.position, parked.yaw, false, true); this.add('reward', reward.position, reward.yaw, !unlocked, false);
    this.setCabin(this.preferences.cabin, true); if(unlocked) this.grantRewardOnce();
  }
  private addForecourt(spot: ParkingSpot): void {
    const root = new Group(), p = spot.position;
    root.name = 'Clear rooftop-street parking forecourt'; root.position.set(p.x, .055, p.z); root.rotation.y = spot.yaw;
    const pavement = new Mesh(new BoxGeometry(10, .08, 14), new MeshStandardNodeMaterial({ color: '#596d68', roughness: .95 })); root.add(pavement);
    const markings = new MeshStandardNodeMaterial({ color: '#ddd7ae', roughness: .9 });
    for (const x of [-1.7, 1.7]) { const line = new Mesh(new BoxGeometry(.08, .012, 6), markings); line.position.set(x, .048, 0); root.add(line); }
    const stop = new Mesh(new BoxGeometry(3.5, .012, .11), markings); stop.position.set(0, .048, -3); root.add(stop);
    const body = installForecourt(this.world, spot);
    this.root.add(root); this.forecourts.push({ root, body });
  }
  private add(id: string, p: V3, yaw = 0, locked = false, npc = false, definition:CarDefinition=HARBOR): VehicleEntry {
    const car = new RaycastCar(this.world, p, id, definition, yaw), visual = new CarVisual(car, this.library.get(definition.id) ?? (definition.id==='harbor' ? this.source : undefined), npc);
    car.assist = this.preferences.assist; car.engine.manual = this.preferences.manual; const entry:VehicleEntry = { car, visual, locked, npc };
    this.cars.set(id, entry); this.root.add(visual.root); return entry;
  }
  private grantRewardOnce():void { const entry=this.cars.get('reward'); if(entry)entry.vin='parkour-reward'; if(!this.garage.data.rewardGranted)this.garage.grantReward(); }
  unlock(): void { const reward = this.cars.get('reward'); if (reward) reward.locked = false; this.grantRewardOnce(); }
  nearest(p: V3, radius = 3.8): VehicleTarget | undefined {
    const near=[...this.cars.values()].filter(c=>Math.hypot(c.car.position.x-p.x,c.car.position.z-p.z)<radius&&Math.abs(c.car.position.y-p.y)<2.7&&Math.abs(c.car.speed)<1.4).sort((a,b)=>Math.hypot(a.car.position.x-p.x,a.car.position.z-p.z)-Math.hypot(b.car.position.x-p.x,b.car.position.z-p.z))[0];
    const external=this.externalNearest?.(p,radius);
    if(external&&(!near||Math.hypot(external.position.x-p.x,external.position.z-p.z)<Math.hypot(near.car.position.x-p.x,near.car.position.z-p.z))) {
      this.pendingExternal=external;return {car:{id:external.id,definition:CARS[external.definition]??HARBOR,position:external.position,carjacked:false,damageState:{drivable:external.damage<1}},locked:false,npc:external.npc};
    }
    this.pendingExternal=undefined;return near;
  }
  enter(id: string): boolean {
    if (this.active) return false;let entry = this.cars.get(id);
    if(!entry&&this.pendingExternal?.id===id){const target=this.pendingExternal;if(target.damage>=1)return false;this.pendingExternal=undefined;target.retire();entry=this.add(target.id,target.position,target.yaw,false,target.npc,CARS[target.definition]??HARBOR);entry.car.damage=target.damage;if(target.paint)entry.visual.setPaint(target.paint);}
    if (!entry) return false;
    if (!entry.car.damageState.drivable) { this.notify('Wrecked · use recovery at a garage to return your last owned car.'); return false; }
    if (entry.locked) { this.notify('Your reward is waiting. Finish a rooftop run to take the keys.'); return false; }
    this.active = entry; this.cabinStudy=false; this.setCabin(entry.car.definition.class,true);
    if(!entry.vin)entry.vin=this.garage.make(entry.car.definition.id,entry.visual.paint).vin; if(id!=='lab')this.garage.own(this.record(entry)); this.onTake?.(entry); this.inLab = id === 'lab'; entry.car.body.setEnabled(true); entry.car.engine.enter();
    if (entry.npc && !entry.car.carjacked) { entry.car.carjacked = true; entry.visual.carjack(); this.notify(`The driver leaves. ${entry.car.definition.name} · now your last owned car.`); }
    else this.notify(`${entry.car.definition.name} · cockpit · W / RT accelerate · C cycles four cameras`);
    this.cameras.reset(0); this.manualInput = undefined;
    if (this.cabin) entry.visual.root.add(this.cabin.root); return true;
  }
  exit(force = false): V3 | undefined {
    const entry = this.active; if (!entry) return undefined;
    if (!force && Math.abs(entry.car.speed) > 1.4) { this.notify('Slow below 5 km/h before opening the door.'); return undefined; }
    const position = entry.car.exitPosition();
    if (!position && !force) { this.notify('Door blocked. Move to a clearer space before getting out.'); return undefined; }
    this.garage.update(this.record(entry)); entry.car.engine.exit(); entry.car.setInput(neutralDrive()); entry.visual.exterior.visible = true; entry.visual.door.visible = true;
    if (this.cabin) { this.cabin.root.visible = false; this.cabin.root.removeFromParent(); }
    this.active = undefined; this.manualInput = undefined; if (this.cabin) this.root.add(this.cabin.root); this.sound.effect('exit-door', .6);
    return position ?? v3(entry.car.position.x + 2.2, entry.car.position.y, entry.car.position.z);
  }
  setCabin(id: CarClass, initial = false): boolean {
    if (!initial) this.cabinStudy=true;
    if (!CABINS.some(c => c.id === id)) return false;
    if (!initial && this.active && Math.abs(this.active.car.speed) > 1) { this.notify('Park first to switch the cabin study.'); return false; }
    if (this.cabin) { this.cabin.root.visible = false; this.cabin.root.removeFromParent(); }
    let cabin = this.cabins.get(id); if (!cabin) { cabin = new Cockpit(id); this.cabins.set(id, cabin); }
    this.cabin = cabin; this.preferences.cabin = id; this.storage.write(this.preferences);
    if (this.active) { this.active.visual.root.add(cabin.root); this.sound.resetVoice(this.active.car.id); this.cameras.reset(this.cameras.view); } else this.root.add(cabin.root);
    if (!initial) this.notify(`${cabin.trim.label} · interior / engine study on the selected chassis`); return true;
  }
  setAssist(value: boolean): void { this.preferences.assist = value; for (const entry of this.cars.values()) entry.car.assist = value; this.storage.write(this.preferences); }
  handleActions(input: InputManager, dt: number): void {
    const active = this.active; if (!active) return;
    if (input.pressed('engine')) active.car.engine.toggleIgnition();
    if (input.pressed('transmission')) { active.car.engine.toggleManual(); this.preferences.manual = active.car.engine.manual; this.storage.write(this.preferences); this.notify(active.car.engine.manual ? 'Manual · , / . shift · Q clutch · start in N or hold clutch' : 'Automatic · hold S / LT to brake, then reverse'); }
    if (input.pressed('shiftUp')) active.car.engine.shift(1); if (input.pressed('shiftDown')) active.car.engine.shift(-1);
    if (input.pressed('mouseSteer')) { this.preferences.mouseSteering = !this.preferences.mouseSteering; this.storage.write(this.preferences); this.notify(`Mouse steering ${this.preferences.mouseSteering ? 'on · move across the canvas to steer' : 'off · drag to look'}`); }
    if (input.pressed('headlights')) { this.lights = !this.lights; active.visual.headlights = this.lights; }
    if (input.pressed('indicator')) this.indicator = this.indicator ? 0 : -1;
    if (input.pressed('horn')) this.sound.effect('horn', .8);
    const frame = input.frame, steer = input.deviceKind === 'none' ? Number(input.isHeld('right')) - Number(input.isHeld('left')) : frame.steering || Number(input.isHeld('right')) - Number(input.isHeld('left'));
    active.car.setInput(this.manualInput ?? { throttle: Math.max(input.isHeld('forward') ? 1 : 0, frame.throttle), brake: Math.max(input.isHeld('backward') ? 1 : 0, frame.brake), steering: this.preferences.mouseSteering ? frame.pointerSteer : steer, handbrake: input.isHeld('impulse'), clutch: input.isHeld('clutch'), directSteer: input.deviceKind === 'wheel' });
    active.visual.indicator = this.indicator; this.cameras.look(frame, dt, this.preferences.mouseSteering);
  }
  preStep(dt: number, anchor = this.anchor): void {
    this.dynamics?.preStep(dt,anchor);
    this.fixedTicks++; this.elapsed += dt; this.anchor = { ...anchor };
    for (const entry of this.cars.values()) {
      const nearby = entry === this.active || Math.hypot(entry.car.position.x - anchor.x, entry.car.position.z - anchor.z) < 80&&Math.abs(entry.car.position.y-anchor.y)<12;
      if (entry.car.body.isEnabled() !== nearby) entry.car.body.setEnabled(nearby);
      if (nearby) entry.car.preStep(dt);
    }
  }
  postStep(dt: number): void {
    for (const entry of this.cars.values()) if (entry.car.body.isEnabled()) {
      entry.car.postStep(dt);
      for (const event of entry.car.events.splice(0)) {this.onSurfaceEvent?.(entry.car,event);if (entry === this.active) { this.sound.effect(event.type, event.intensity, event.material ?? event.surface); if (['collision', 'glass', 'suspension'].includes(event.type)) this.feedback?.(event.intensity * .55); }}
      if (entry.car.position.y < -4 && entry === this.active) { this.resetPosition(); this.notify('Deep water · the recovery truck returned your car.'); }
    }
    this.dynamics?.postStep(dt);
  }
  render(alpha: number, dt: number, night: number, reducedMotion: boolean, listener: Camera): Camera {
    this.frame++;
    for (const entry of this.cars.values()) { const visible=entry===this.active||Math.hypot(entry.car.position.x-this.anchor.x,entry.car.position.z-this.anchor.z)<320; entry.visual.root.visible=visible; if(visible) { if(entry!==this.active)entry.visual.headlights=night>.4;entry.visual.render(alpha,dt); } }
    this.headlight.intensity=this.active?.visual.lamp.intensity??0;
    if(this.active){const a=this.active.car;this.headlight.position.copy(this.lightPoint.set(0,.21,a.definition.halfLength).applyQuaternion(a.rotation).add(a.position));this.headlight.target.position.copy(this.lightPoint.set(0,-.23,20).applyQuaternion(a.rotation).add(a.position));}
    let camera = listener;
    if (this.active && this.cabin) {
      const a = this.active; a.visual.exterior.visible = this.cameras.view !== 0; a.visual.door.visible = this.cameras.view !== 0;
      this.cabin.root.visible = this.cameras.view === 0; this.cabin.update(a.car, night, a.visual.headlights, this.indicator, this.elapsed, dt);
      this.cameras.update(a.car, this.cabin.eye, dt, alpha, reducedMotion); camera = this.cameras.camera;
    }
    this.sound.update([...this.cars.values()].map<SoundEmitter>(e => ({ id: e.car.id, car: e.car, position: e.car.position, engine: e === this.active && this.cabin && this.cabinStudy ? this.cabin.trim.engine : e.car.definition.engine, profile: e === this.active && this.fallbackProfile ? 'deliberately-missing' : e === this.active && this.cabin && this.cabinStudy ? profileFor(this.cabin.trim.engine) : e.car.definition.soundProfile, priority: e === this.active ? 1 : 0 })).concat(this.extraEmitters?.()??[]), camera, dt, this.active?.car.id, this.indicator);
    return camera;
  }
  mirrors(renderer: WebGPURenderer, scene: Scene, quality: QualityTier, enabled=true): void {for(const cabin of this.cabins.values())if(cabin!==this.cabin||!this.active||!quality.effects.mirrors||!enabled)cabin.releaseMirrors();if(this.active&&this.cabin)this.cabin.renderMirrors(renderer,scene,this.active.visual.exterior,quality.effects.mirrors&&enabled,this.frame);}
  async lab(definition=HARBOR.id): Promise<void> {
    await this.circuit.build(); this.exit(true);
    let entry = this.cars.get('lab'); if(entry&&entry.car.definition.id!==definition){this.remove('lab');entry=undefined;} if (!entry) entry = this.add('lab', this.circuit.data!.spawn, this.circuit.data!.yaw,false,false,CARS[definition]??HARBOR);
    entry.car.teleport(this.circuit.data!.spawn, this.circuit.data!.yaw); this.enter('lab'); this.inLab = true;
  }
  resetPosition(): void {
    if (!this.active) return;
    if (this.inLab && this.circuit.data) this.active.car.teleport(this.circuit.data.spawn, this.circuit.data.yaw);
    else { const p = this.cars.get('parked')?.car.position ?? this.active.car.position; this.active.car.teleport(v3(p.x, roadHeightAt(p.x, p.z) + 1.0, p.z)); }
    this.cameras.reset();
  }
  private record(entry:VehicleEntry):GarageCar { return {vin:entry.vin??entry.car.id,definition:entry.car.definition.id,paint:entry.visual.paint,damage:entry.car.damage,reward:entry.vin==='parkour-reward'}; }
  storeActive():boolean { const a=this.active;if(!a)return false;if(this.inLab){this.notify('Take a street car to a garage; handling-lab loan cars cannot be stored.');return false;}if(Math.abs(a.car.speed)>1.4){this.notify('Park before storing.');return false;}const ok=this.garage.store(this.record(a));if(ok){const outside=this.exit(true)!;this.remove(a.car.id);this.onStore?.(outside);}this.notify(ok?`${a.car.definition.name} stored inside · ${this.garage.data.slots.length}/6 spaces`:'Garage full · release a stored car first.');return ok; }
  paint(value:string):boolean {const a=this.active;if(!a||Math.abs(a.car.speed)>1.4)return false;const ok=a.visual.setPaint(value);if(ok)this.garage.update(this.record(a));return ok;}
  retrieve(vin:string,position:V3,yaw=0):VehicleEntry|undefined {if(!this.garage.data.slots.some(c=>c.vin===vin))return;this.exit(true);const saved=this.garage.retrieve(vin)!;for(const[id,e]of this.cars)if(e.vin===saved.vin)this.remove(id);const id=`garage-${saved.vin}`;const entry=this.add(id,position,yaw,false,false,CARS[saved.definition]!);entry.vin=saved.vin;entry.visual.setPaint(saved.paint);entry.car.damage=saved.damage;return entry;}
  recoverOwned(position:V3,yaw=0):VehicleEntry|undefined {if(!this.garage.data.lastOwned){this.notify('Take a street car first; recovery remembers the last one you owned.');return;}this.exit(true);const saved=this.garage.recover()!;for(const [id,e]of this.cars)if(e.vin===saved.vin)this.remove(id);const entry=this.add(`recovery-${saved.vin}`,position,yaw,false,false,CARS[saved.definition]!);entry.vin=saved.vin;entry.visual.setPaint(saved.paint);this.notify(`${entry.car.definition.name} recovered at the garage · repaired`);return entry;}
  recover(): void {if(this.active&&!this.active.car.damageState.drivable){this.notify('This car is a wreck. Garage → Recover last owned car.');return;}this.active?.car.recover();this.cameras.reset();this.notify(this.active?.car.bike?'Back on two wheels.':'Back on four wheels.');}
  remove(id:string):void {const entry=this.cars.get(id);if(!entry||entry===this.active)return;this.sound.resetVoice(id);entry.visual.root.removeFromParent();entry.visual.dispose();entry.car.dispose();this.cars.delete(id);}

  testInput(input?: Partial<DriveInput>): void { this.manualInput = input ? { ...neutralDrive(), ...input } : undefined; if (this.active && this.manualInput) this.active.car.setInput(this.manualInput); }
  testFallback(value: boolean): void { this.fallbackProfile = value; if (this.active) this.sound.resetVoice(this.active.car.id); }
  snapshot() { return { active: this.active?.car.id ?? null, inLab: this.inLab, roster: ROSTER.map(c=>({id:c.id,name:c.name,class:c.class,model:c.model,engine:c.engine,mass:c.mass,paints:c.paints,soundProfile:c.soundProfile})), garage:this.garage.snapshot(), cabinStudy:this.cabinStudy, resources: { models:this.library.models.size,modelFallbacks:[...this.library.failures], cars: this.cars.size, forecourts: this.forecourts.length, cachedCabins: this.cabins.size }, preferences: { ...this.preferences }, camera: this.cameras.snapshot(), cabin: this.cabin?.snapshot(), audio: this.sound.snapshot(), ticks: this.fixedTicks, renderFrames: this.frame, elapsed: this.elapsed, circuit: this.circuit.data ? { path: this.circuit.data.path, spawn: this.circuit.data.spawn, features: this.circuit.data.features, colliders: this.circuit.data.colliders.length } : null, cars: [...this.cars.values()].map(e => ({ ...e.car.snapshot(), locked: e.locked, visual: e.visual.snapshot() })) }; }
  private clearCars(): void {
    this.exit(true);this.pendingExternal=undefined; const seen = new Set<unknown>();
    for (const court of this.forecourts) { court.root.removeFromParent(); court.root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); const m = o.material as MeshStandardNodeMaterial; if (!seen.has(m)) { seen.add(m); m.dispose(); } } }); this.world.removeRigidBody(court.body); } this.forecourts = []; for (const entry of this.cars.values()) { this.sound.resetVoice(entry.car.id); entry.visual.root.removeFromParent(); entry.visual.dispose(seen); entry.car.dispose(); } this.cars.clear(); this.inLab = false;
  }
  dispose(): void { this.clearCars(); this.sound.dispose(); for (const cabin of this.cabins.values()) cabin.dispose(); this.cabins.clear(); this.circuit.dispose(); this.library.dispose(); this.headlight.dispose(); this.root.clear(); }
}
export { HARBOR, CABINS, RaycastCar, neutralDrive };
