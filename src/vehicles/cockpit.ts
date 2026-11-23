// Six genuinely different code-built cabins. No photo overlay: instruments, hands and mirrors are scene geometry.
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, PlaneGeometry,
  MeshStandardNodeMaterial, MeshBasicNodeMaterial, CanvasTexture, SRGBColorSpace, DoubleSide,
  RenderTarget, PerspectiveCamera, Vector3, type Object3D, type Material, type WebGPURenderer, type Scene,
} from 'three/webgpu';
import { texture, uv, vec2 } from 'three/tsl';
import { CABINS, clamp, type CarClass } from './cars';
import type { RaycastCar } from './physics';
import { mergeStaticParts } from './visual';

type Trim = typeof CABINS[number];
const TAU = Math.PI * 2;
export interface InstrumentReadings {
  speed: number; rpm: number; temperature: number; gear: string; wheelRadians: number; shifter: number;
  lamps: { oil: boolean; engine: boolean; handbrake: boolean; damage: boolean; left: boolean; right: boolean; lights: boolean };
  ignition: number; sweep: number; night: number;
}
export function instrumentReadings(car: RaycastCar, night: number, lights: boolean, indicator: number, time: number, redline = car.definition.redline): InstrumentReadings {
  const e = car.engine, bulbCheck = e.phase === 'ignition', powered = !['off', 'shutdown'].includes(e.phase), sweep = e.phase === 'ignition' ? e.sweep : 0;
  return {
    speed: sweep ? sweep * 240 : Math.abs(car.speed) * 3.6,
    rpm: sweep ? sweep * redline : e.rpm,
    temperature: e.temperature, gear: e.gear < 0 ? 'R' : e.gear === 0 ? 'N' : String(e.gear),
    wheelRadians: car.wheelAngle, shifter: e.gear,
    lamps: { oil: powered && !e.running, engine: powered && (!e.running || car.damage > 0.75), handbrake: bulbCheck || car.input.handbrake || !e.occupied, damage: bulbCheck || car.damage > 0.3, left: indicator < 0 && Math.floor(time * 1.5) % 2 === 0, right: indicator > 0 && Math.floor(time * 1.5) % 2 === 0, lights },
    ignition: e.phase === 'shutdown' ? Math.max(0, 1 - e.phaseTime / .8) : powered ? 1 : 0,
    sweep, night,
  };
}
function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasMaterial(c: HTMLCanvasElement): [CanvasTexture, MeshBasicNodeMaterial] { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return [t, new MeshBasicNodeMaterial({ map: t, toneMapped: false, side: DoubleSide })]; }
class Dial {
  readonly root = new Group(); readonly needle = new Group(); value = 0; angle = 0;
  constructor(readonly label: string, readonly maximum: number, radius: number, readonly pale: boolean, make: (geometry: TorusGeometry | PlaneGeometry | BoxGeometry | CylinderGeometry, color: string, basic?: boolean) => Mesh) {
    const c = canvas(320, 320), ctx = c.getContext('2d')!, center = 160;
    ctx.fillStyle = pale ? '#dddcc5' : '#122b29'; ctx.fillRect(0, 0, 320, 320);
    ctx.strokeStyle = pale ? '#24483f' : '#dbe2c2'; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 40; i++) {
      const a = (-220 + i / 40 * 260) * Math.PI / 180, major = i % 5 === 0;
      ctx.strokeStyle = i >= 34 && label !== 'KM/H' ? '#d88b67' : pale ? '#426057' : '#b7c5a8'; ctx.lineWidth = major ? 3 : 1.3;
      ctx.beginPath(); ctx.moveTo(center + Math.cos(a) * (major ? 119 : 128), center + Math.sin(a) * (major ? 119 : 128)); ctx.lineTo(center + Math.cos(a) * 142, center + Math.sin(a) * 142); ctx.stroke();
      if (major) { ctx.font = '500 21px monospace'; const v = Math.round(maximum * i / 40); ctx.fillText(String(v), center + Math.cos(a) * 98, center + Math.sin(a) * 98); }
    }
    ctx.font = '600 16px monospace'; ctx.fillStyle = pale ? '#405c50' : '#a9bd9f'; ctx.fillText(label, 160, 221); ctx.font = '10px monospace'; ctx.fillText('C R O S S T O W N', 160, 247);
    const [t, material] = canvasMaterial(c), face = new Mesh(new PlaneGeometry(radius * 2, radius * 2), material); face.userData.ownedTexture = t;
    this.root.add(face); const bezel = make(new TorusGeometry(radius, radius * .055, 6, 48), '#b8b99b'); bezel.position.z = -.001; this.root.add(bezel);
    const needle = make(new BoxGeometry(radius * .035, radius * .90, radius * .025), '#efba7a', true); needle.position.set(0, radius * .36, .008); this.needle.add(needle); this.root.add(this.needle);
    const hub = make(new CylinderGeometry(radius * .09, radius * .09, .014, 16), '#304b40'); hub.rotation.x = Math.PI / 2; hub.position.z = .014; this.root.add(hub);
  }
  update(value: number) { this.value = value; this.angle = (130 - clamp(value / this.maximum) * 260) * Math.PI / 180; this.needle.rotation.z = this.angle; }
}
interface Mirror { mesh: Mesh; target?: RenderTarget; pixelWidth:number;camera: PerspectiveCamera; live?: MeshBasicNodeMaterial; off: MeshBasicNodeMaterial; local: Vector3; direction: Vector3; updates: number }
export class Cockpit {
  readonly root = new Group(); readonly wheel = new Group(); readonly shifter = new Group();
  readonly trim: Trim; readonly eye = new Vector3();
  readonly gauges: Dial[] = []; readonly mirrors: Mirror[] = []; readonly handRoots: Group[] = [];
  readonly screen: HTMLCanvasElement = canvas(512, 256); readonly screenTexture: CanvasTexture;
  readonly lamps = new Map<string, MeshBasicNodeMaterial>();
  readonly key = new Group(); readings?: InstrumentReadings; mirrorFrames = 0; mirrorEnabled = false;
  private materials = new Map<string, MeshStandardNodeMaterial | MeshBasicNodeMaterial>();
  private dashLight: MeshStandardNodeMaterial;
  private radioTitle = 'RADIO OFF';
  setRadio(title:string):void { const value=title.slice(0,110); if(value===this.radioTitle)return;this.radioTitle=value;this.lastScreen='';this.paintScreen(this.readings); }
  private lastScreen = ''; private screenGear = '—'; private digital = false; private resources = new Set<{ dispose(): void }>();
  private point = new Vector3(); private direction = new Vector3();
  constructor(id: CarClass = 'sedan') {
    this.trim = CABINS.find(c => c.id === id)!; const p = this.trim, w = p.dashWidth;
    this.root.name = `${id} · hand-built cabin`; this.root.position.y = -.55; this.eye.set(id === 'motorbike' ? 0 : .40, p.eye - .55, id === 'motorbike' ? -.64 : -.48);
    this.dashLight = new MeshStandardNodeMaterial({ color: p.trim, roughness: .82, emissive: p.accent, emissiveIntensity: .02 }); this.resources.add(this.dashLight);
    const b = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string, parent: Object3D = this.root) => { const m = this.make(new BoxGeometry(sx, sy, sz), c); m.position.set(x, y, z); parent.add(m); return m; };
    // The unique dashboard silhouette is geometry, not merely a changed paint swatch.
    if (id === 'compact') {
      const dash = this.make(new SphereGeometry(1, 28, 12), p.trim); dash.scale.set(w / 2, .23, .43); dash.position.set(0, .86, .72); this.root.add(dash);
      b(0, .83, .44, w * .95, .22, .20, '#d7d6bf'); b(0, .77, .33, w * .95, .035, .05, p.accent);
      b(.40, 1.015, .31, .90, .31, .13, '#273e34');
    } else if (id === 'muscle') {
      b(0, .91, .65, w, .24, .48, p.trim); b(0, .83, .385, w * .96, .20, .045, '#72523c'); b(0, 1.04, .63, w * 1.01, .04, .50, '#3f4033');
      for (const x of [.16, .48, .78]) { const pod = this.make(new CylinderGeometry(.153, .16, .22, 24), '#1a2d2a'); pod.rotation.x = Math.PI / 2; pod.position.set(x, 1.025, .50); this.root.add(pod); }
    } else if (id === 'supercar') {
      b(0, .83, .69, w, .22, .59, p.trim).rotation.z = -.035;
      b(.40, .99, .63, .83, .33, .26, '#17282a').rotation.x = -.12;
      b(-.31, .79, .37, .42, .30, .16, '#2c403d').rotation.z = -.24;
      for (let i = 0; i < 9; i++) { const m = this.make(new BoxGeometry(.028, .014, .012), i < 6 ? '#d6e39b' : '#df916f', true); m.position.set(.22 + i * .043, 1.16, .48); this.root.add(m); }
      this.digital = true;
    } else if (id === 'suv') {
      b(0, 1.00, .77, w, .44, .42, p.trim); b(0, 1.23, .89, w, .06, .25, '#3b4b3d'); b(-.36, .92, .48, .54, .47, .15, '#243a32');
      b(-.78, 1.13, .45, .38, .055, .06, p.accent); b(-.95, 1.06, .45, .045, .17, .06, p.accent); b(-.61, 1.06, .45, .045, .17, .06, p.accent);
    } else if (id === 'motorbike') {
      const tank = this.make(new SphereGeometry(1, 20, 12), '#668b78'); tank.scale.set(.25, .24, .58); tank.position.set(0, .72, -.03); this.root.add(tank);
      b(0, .94, .45, .64, .035, .05, '#b7b99c'); for (const x of [-.27, .27]) b(x, 1.01, .45, .026, .16, .03, '#9aaa90');
      for (const x of [-.19, .19]) { const fork = this.make(new CylinderGeometry(.022, .022, .65, 10), '#afbea3'); fork.position.set(x, .68, .72); fork.rotation.x = -.27; this.root.add(fork); }
      this.digital = true;
    } else {
      b(0, .88, .76, w, .31, .61, p.trim); b(0, .88, .43, w * .97, .24, .05, '#243832'); b(0, .775, .38, w * .97, .024, .025, p.accent);
      b(.41, 1.06, .71, .76, .16, .39, '#1e352f'); b(-.32, .96, .43, .48, .26, .08, '#172e29');
    }
    if (id !== 'motorbike') {
      // Door cards, stitched seats, windscreen frame and A-pillars retain an open, road-first view.
      b(0, .31, -.2, w * .98, .12, 1.7, '#263b32'); b(0, 1.85, -.30, w, .10, 1.45, '#cccbb2');
      b(0, 1.72, 1.02, w * .99, .07, .10, '#b4b9a1');
      for (const side of [-1, 1]) {
        const pillar = b(side * (w / 2 - .05), 1.37, .91, .065, .77, .07, '#a6b6a1'); pillar.rotation.x = -.36;
        b(side * w / 2, .77, -.22, .065, .48, 1.65, p.trim); b(side * (w / 2 - .035), .87, -.22, .045, .035, .7, p.accent);
        b(side * (w / 2 - .065), .77, -.08, .07, .055, .28, '#283e34');
        const seat = b(side * .43, .53, -.61, .42, .15, .56, '#3d5141'); seat.rotation.x = .05;
        b(side * .43, .83, -.91, .43, .57, .14, '#3d5141').rotation.x = -.13;
        b(side * .43, 1.21, -.97, .29, .21, .13, '#3d5141');
        for (let k = 0; k < 3; k++) b(side * .43 + (k - 1) * .07, .91, -1.00, .005, .3, .009, '#9a9c7b');
      }
      // Centre tunnel, actual manual shifter and two seats rather than an empty camera rig.
      b(0, .51, -.05, .27, .35, .95, '#2b3f34'); b(0, .71, -.14, .22, .03, .32, p.accent);
      const stem = this.make(new CylinderGeometry(.012, .018, .17, 10), '#aeb89b'); stem.position.y = .08; this.shifter.add(stem);
      const knob = this.make(new SphereGeometry(.034, 12, 8), '#e2d4b2'); knob.position.y = .18; this.shifter.add(knob); this.shifter.position.set(.02, .73, -.13); this.root.add(this.shifter);
      // Fine vents and tactile switches; none are generic UI images.
      for (const x of [-w * .40, -.09, -.49]) { b(x, .98, .405, .15, .072, .025, '#152d28'); for (let j = 0; j < 4; j++) b(x, .953 + j * .017, .385, .14, .003, .007, '#8c9b81'); }
      for (let k = 0; k < 4; k++) { const knob = this.make(new CylinderGeometry(.018, .018, .018, 12), '#b3b79a'); knob.rotation.x = Math.PI / 2; knob.position.set(-.1 - k * .09, .784, .355); this.root.add(knob); }
    }
    const make = (g: TorusGeometry | PlaneGeometry | BoxGeometry | CylinderGeometry, c: string, basic?: boolean) => this.make(g, c, basic);
    const addDial = (label: string, max: number, radius: number, x: number, y: number, z: number, pale = false) => { const d = new Dial(label, max, radius, pale, make); d.root.position.set(x, y, z); d.root.rotation.y = Math.PI; this.root.add(d.root); this.gauges.push(d); return d; };
    if (id === 'motorbike') { addDial('RPM ×1000', 10, .13, .06, 1.115, .52); addDial('KM/H', 240, .080, -.14, 1.095, .49); addDial('°C', 130, .045, -.29, 1.075, .49); }
    else if (id === 'suv') { addDial('KM/H', 240, .128, .59, 1.115, .53); addDial('RPM ×1000', 7, .128, .28, 1.115, .53); addDial('°C', 130, .055, .055, 1.09, .52); }
    else if (id === 'muscle') { addDial('KM/H', 240, .129, .76, 1.025, .374); addDial('RPM ×1000', 7, .129, .45, 1.025, .374); addDial('°C', 130, .115, .15, 1.025, .374); }
    else if (id === 'supercar') { addDial('KM/H', 240, .10, .67, 1.035, .473); addDial('RPM ×1000', 9, .10, .41, 1.035, .473); addDial('°C', 130, .047, .20, 1.005, .472); }
    else { const z = id === 'compact' ? .225 : .395; addDial('KM/H', 240, .135, .61, 1.015, z, id === 'compact'); addDial('RPM ×1000', 8, .135, .28, 1.015, z, id === 'compact'); addDial('°C', 130, .047, .045, .992, z, id === 'compact'); }
    // A turning rack, leather rim, spokes and attached gloved hands. Display angle IS the physical rack angle.
    this.wheel.name = '900 degree physical steering wheel with hands'; this.wheel.position.set(id === 'motorbike' ? 0 : .43, id === 'suv' ? 1.10 : .94, id === 'motorbike' ? .21 : .06); this.wheel.rotation.x = -.18;
    const rotating = new Group(); rotating.name = 'rack'; this.wheel.add(rotating); this.root.add(this.wheel);
    if (id === 'motorbike') { b(0, 0, 0, .78, .035, .035, '#aeb59c', rotating); for (const s of [-1, 1]) b(s * .37, 0, -.018, .15, .055, .06, '#1f332a', rotating); }
    else {
      const rim = this.make(new TorusGeometry(.208, .019, 8, 48), '#26362d'); if (id === 'supercar') rim.scale.y = .82; rotating.add(rim);
      for (const a of [0, TAU / 3, TAU * 2 / 3]) { const spoke = b(Math.sin(a) * .075, Math.cos(a) * .075, 0, .027, .15, .019, p.accent, rotating); spoke.rotation.z = -a; }
      const hub = this.make(new CylinderGeometry(.052, .052, .04, 24), p.trim); hub.rotation.x = Math.PI / 2; rotating.add(hub);
      b(0, 0, -.025, .04, .006, .003, p.accent, rotating).rotation.z = -.7;
    }
    for (const side of [-1, 1]) {
      const hand = new Group(); hand.position.set(side * (id === 'motorbike' ? .37 : .196), .035, -.01);
      const palm = this.make(new SphereGeometry(.038, 12, 8), '#cfab7e'); palm.scale.set(.75, 1.1, .8); hand.add(palm);
      for (let k = 0; k < 4; k++) { const finger = b((k - 1.5) * .012, -.008, .026, .010, .033, .025, '#cfab7e', hand); finger.rotation.x = .65; }
      const cuff = b(side * .018, -.055, -.045, .061, .09, .067, '#dfe1c7', hand); cuff.rotation.z = side * -.22;
      rotating.add(hand); this.handRoots.push(hand);
    }
    // The screen shares real now-playing state with the optional radio providers.
    const [screenTexture, screenMaterial] = canvasMaterial(this.screen); this.screenTexture = screenTexture; this.resources.add(screenTexture); this.resources.add(screenMaterial);
    const screenMesh = new Mesh(new PlaneGeometry(id === 'motorbike' ? .20 : .30, id === 'motorbike' ? .10 : .15), screenMaterial); screenMesh.rotation.y = Math.PI; screenMesh.position.set(id === 'motorbike' ? -.08 : -.30, id === 'suv' ? 1.045 : .935, id === 'motorbike' ? .38 : id === 'compact' ? .23 : id === 'supercar' ? .26 : .352); this.root.add(screenMesh);
    const lampY = id === 'suv' ? .925 : id === 'motorbike' ? .97 : .847, lampZ = id === 'motorbike' ? .37 : .346;
    for (const [i, name] of ['oil', 'engine', 'handbrake', 'damage', 'left', 'right', 'lights'].entries()) {
      const material = new MeshBasicNodeMaterial({ color: '#263a30', toneMapped: false }); this.lamps.set(name, material); this.resources.add(material);
      const lamp = new Mesh(new PlaneGeometry(.024, .012), material); lamp.rotation.y = Math.PI; lamp.position.set((id === 'motorbike' ? .17 : .68) - i * .061, lampY, lampZ); this.root.add(lamp);
    }
    const keyStem = b(0, 0, 0, .03, .006, .04, '#aeb69d', this.key); keyStem.rotation.y = -.3; b(0, -.02, -.028, .028, .04, .008, '#233b2e', this.key); this.key.position.set(.23, .825, .21); this.root.add(this.key);
    if (id !== 'motorbike') { b(.02, 1.66, .77, .035, .17, .035, '#344b3c'); this.addMirror(new Vector3(.02, 1.57, .72), .32, .10, new Vector3(0, 0, -1)); }
    for (const side of [-1, 1]) {
      const x = side * (id === 'motorbike' ? .46 : w / 2 + .04), y = id === 'motorbike' ? 1.25 : 1.10;
      b(x, y - .05, .49, .02, .14, .025, '#475c47'); this.addMirror(new Vector3(x, y, .48), id === 'motorbike' ? .145 : .15, .105, new Vector3(side * .22, -.03, -1));
    }
    mergeStaticParts(this.root); this.paintScreen(undefined); this.root.visible = false;
  }
  private make(geometry: BoxGeometry | CylinderGeometry | SphereGeometry | TorusGeometry | PlaneGeometry, color: string, basic = false): Mesh {
    const key = `${basic}/${color}`; let material = this.materials.get(key);
    if (!material) { material = basic ? new MeshBasicNodeMaterial({ color, toneMapped: false }) : new MeshStandardNodeMaterial({ color, roughness: .78, metalness: color === this.trim.accent ? .35 : .05 }); this.materials.set(key, material); this.resources.add(material); }
    this.resources.add(geometry); const mesh = new Mesh(geometry, material); mesh.receiveShadow = false; mesh.castShadow = false; return mesh;
  }
  private addMirror(local: Vector3, width: number, height: number, direction: Vector3): void {
    const c = canvas(256, 96), ctx = c.getContext('2d')!; ctx.fillStyle = '#243d34'; ctx.fillRect(0, 0, 256, 96); ctx.fillStyle = '#8da18a'; ctx.font = '13px monospace'; ctx.textAlign = 'center'; ctx.fillText('MIRRORS OFF', 128, 52); const [t, off] = canvasMaterial(c); this.resources.add(t); this.resources.add(off);
    const housing = this.make(new BoxGeometry(width + .027, height + .023, .026), '#23382e'); housing.position.copy(local); this.root.add(housing);
    const mesh = new Mesh(new PlaneGeometry(width, height), off); this.resources.add(mesh.geometry); mesh.position.copy(local); mesh.position.z -= .015; mesh.rotation.y = Math.PI; this.root.add(mesh);
    const camera = new PerspectiveCamera(width > .2 ? 58 : 66, width > .2 ? 256 / 96 : 128 / 96, .15, 220);
    this.mirrors.push({ mesh, pixelWidth:width>.2?256:128,camera, off, local: local.clone(), direction: direction.normalize(), updates: 0 });
  }
  update(car: RaycastCar, night: number, lights: boolean, indicator: number, time: number, _dt: number): void {
    this.readings = instrumentReadings(car, night, lights, indicator, time, this.trim.redline);
    const r = this.readings;
    for (const dial of this.gauges) { dial.update(dial.label === 'KM/H' ? r.speed : dial.label.startsWith('RPM') ? r.rpm / 1000 : r.temperature); const face = dial.root.children[0] as Mesh; (face.material as MeshBasicNodeMaterial).color.setScalar((1 - night) * .88 + night * (.10 + .90 * r.ignition)); }
    const rack = this.wheel.getObjectByName('rack')!; rack.rotation.z = -r.wheelRadians; // rear-facing camera: visual rotation follows the physical rack, not the raw key.
    if (this.trim.id === 'motorbike') { rack.rotation.z = 0; rack.rotation.y = car.roadSteer; }
    this.shifter.visible = car.engine.manual; this.shifter.rotation.x = car.engine.gear === 0 ? 0 : car.engine.gear % 2 ? -.20 : .20; this.shifter.rotation.z = car.engine.gear < 0 ? -.25 : (Math.ceil(car.engine.gear / 2) - 2) * .16;
    this.key.rotation.z = car.engine.keyAngle * -.8;
    for (const [name, material] of this.lamps) material.color.set(r.lamps[name as keyof typeof r.lamps] && r.ignition > 0 ? name === 'left' || name === 'right' || name === 'lights' ? '#d4f5a5' : '#ecab6e' : '#273e31');
    for (const material of this.materials.values()) if (material instanceof MeshStandardNodeMaterial) { material.emissive.set(this.trim.accent); material.emissiveIntensity = night * .09 * r.ignition; }
    // Keyed redraw also responds to paused deterministic physics / gear changes.
    this.paintScreen(r);
  }
  private paintScreen(r?: InstrumentReadings): void {
    const key = r ? `${r.gear}/${Math.round(r.speed)}/${Math.round(r.temperature)}/${Math.round(r.rpm / 80)}/${r.ignition.toFixed(1)}` : 'off'; if (key === this.lastScreen) return; this.lastScreen = key; this.screenGear = r?.gear ?? '—';
    const c = this.screen.getContext('2d')!; c.fillStyle = '#102c26'; c.fillRect(0, 0, 512, 256); c.globalAlpha = r ? .18 + .82 * r.ignition : .4;
    c.fillStyle = '#b8d5a6'; c.font = '19px monospace'; c.fillText(this.trim.id === 'motorbike' ? 'CROSSTOWN / 01' : 'CROSSTOWN AUDIO', 26, 38);
    c.strokeStyle = '#4c6a4c'; c.beginPath(); c.moveTo(26, 57); c.lineTo(486, 57); c.stroke();
    c.fillStyle = '#e4e7b9'; c.font = 'bold 54px monospace'; c.fillText(r?.gear ?? '—', 29, 116); c.font = '14px monospace'; c.fillText('GEAR', 29, 142);
    c.fillStyle = '#adc4a0'; c.font = '24px monospace'; c.fillText(this.digital ? `${Math.round(r?.speed ?? 0)} KM/H` : this.radioTitle.slice(0,22), 140, 102); c.font = '17px monospace'; c.fillText(this.digital ? this.radioTitle.slice(0,29) : this.radioTitle.slice(22,50)||'THE ROAD IS YOURS.', 140, 137);
    if (this.digital) { const ratio = clamp((r?.rpm ?? 0) / this.trim.redline); for (let i = 0; i < 24; i++) { c.fillStyle = i / 24 <= ratio ? i > 19 ? '#e7ad75' : '#c4df9e' : '#294636'; c.fillRect(27 + i * 19, 167, 14, 16); } }
    c.fillStyle = '#728e70'; c.font = '15px monospace'; c.fillText(this.trim.id.toUpperCase() + '  /  HARBOR CHASSIS STUDY', 26, 219); c.globalAlpha = 1; this.screenTexture.needsUpdate = true;
  }
  releaseMirrors():void {for(const m of this.mirrors){m.mesh.material=m.off;if(m.target){m.target.dispose();this.resources.delete(m.target);m.target=undefined;}if(m.live){m.live.dispose();this.resources.delete(m.live);m.live=undefined;}}}
  renderMirrors(renderer: WebGPURenderer, scene: Scene, carRoot: Object3D, enabled: boolean, frame: number): void {
    this.mirrorEnabled = enabled;
    if(!enabled||!this.root.visible){this.releaseMirrors();return;}
    for(const m of this.mirrors){if(!m.target){m.target=new RenderTarget(m.pixelWidth,96,{depthBuffer:true});m.target.texture.name='Live rear view, horizontally reflected';this.resources.add(m.target);m.live=new MeshBasicNodeMaterial({toneMapped:true,side:DoubleSide});m.live.colorNode=texture(m.target.texture,vec2(uv().x.oneMinus(),uv().y.oneMinus()));this.resources.add(m.live);}m.mesh.material=m.live!;}
    if(frame%2!==0)return;
    const oldTarget = renderer.getRenderTarget(), rootVisible = this.root.visible, carVisible = carRoot.visible;
    this.root.updateWorldMatrix(true, true);
    const poses = this.mirrors.map(m => ({ m, p: this.root.localToWorld(m.local.clone()), d: this.root.localToWorld(m.local.clone().add(m.direction)).sub(this.root.localToWorld(m.local.clone())).normalize() }));
    this.root.visible = false; carRoot.visible = false;
    try {
      for (const { m, p, d } of poses) {
        this.point.copy(p); this.direction.copy(d); m.camera.position.copy(this.point); m.camera.up.set(0, 1, 0); m.camera.lookAt(this.point.add(this.direction)); m.camera.updateMatrixWorld();
        renderer.setRenderTarget(m.target!); renderer.render(scene, m.camera); m.updates++;
      }
      this.mirrorFrames++;
    } finally { renderer.setRenderTarget(oldTarget); this.root.visible = rootVisible; carRoot.visible = carVisible; }
  }
  snapshot() { return { class: this.trim.id, label: this.trim.label, geometryParts: this.root.children.length, digital: this.digital, eye: this.eye.toArray(), readings: this.readings, gauges: this.gauges.map(d => ({ label: d.label, maximum: d.maximum, value: d.value, needle: d.angle })), rackRadians: this.wheel.getObjectByName('rack')!.rotation.z, hands: this.handRoots.length, manualShifterVisible: this.shifter.visible, mirrorsEnabled: this.mirrorEnabled,mirrorTargets:this.mirrors.filter(m=>!!m.target).length, mirrorRenderFrames: this.mirrorFrames, mirrors: this.mirrors.map(m => ({ size: [m.pixelWidth,96],allocated:!!m.target, updates: m.updates, view: m.camera.getWorldDirection(new Vector3()).toArray(), position: m.camera.position.toArray() })), radio: this.radioTitle, screenGear: this.screenGear, visible: this.root.visible }; }
  dispose(): void { this.root.traverse(o => { if (o instanceof Mesh) { this.resources.add(o.geometry); const ms: Material[] = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => this.resources.add(m)); if (o.userData.ownedTexture) this.resources.add(o.userData.ownedTexture); } }); for (const r of this.resources) r.dispose(); this.root.clear(); }
}
