import {
  Color,
  Mesh,
  SphereGeometry, BackSide, MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  FogExp2,
  Vector3,
  type Scene,
  type DirectionalLight,
  type HemisphereLight,
} from "three/webgpu";
import {
  uniform,
  positionLocal,
  positionWorld,
  sin,
  cos,
  vec3,
  mix,
  color,
  smoothstep,
  abs,
  pow,
  max,
  normalWorld,
  cameraPosition,
} from "three/tsl";
import { SkyMesh } from "three/addons/objects/SkyMesh.js";
import { makeWaterGeometry } from './water';
import type { QualityTier } from '../../config/quality';
import { seededRandom } from "../../parkour/types";
export type Weather = "clear" | "overcast" | "rain" | "fog";
export function calendarWeather(date: string): {
  weather: Weather;
  hour: number;
  seed: number;
} {
  let seed = 2166136261;
  for (const c of date.slice(0, 10))
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = seededRandom(seed);
  return {
    weather: (["clear", "overcast", "rain", "fog"] as const)[
      Math.floor(random() * 4)
    ]!,
    hour: 8 + random() * 9,
    seed,
  };
}
export function lightAt(hour: number): {
  daylight: number;
  night: number;
  golden: number;
  elevation: number;
} {
  const elevation = Math.sin(((hour - 6) / 24) * Math.PI * 2),
    daylight = Math.max(0, Math.min(1, (elevation + 0.08) / 0.35));
  return {
    daylight,
    night: 1 - daylight,
    golden: Math.max(0, 1 - Math.abs(elevation - 0.12) / 0.3),
    elevation,
  };
}
export class CityEnvironment {
  readonly night = uniform(0);
  readonly clock = uniform(0);
  readonly sky = new SkyMesh();
  readonly water: Mesh; readonly budgetSky: Mesh;
  private skyTop = uniform(new Color('#73b4ce')); private skyHorizon = uniform(new Color('#d4d9be'));
  readonly wet = uniform(0);
  date: string;
  weather: Weather;
  hour: number;
  elapsed = 0;
  private startHour: number;
  private forcedHour: number | null = null;
  private lastUpdate = -1;
  private tint = new Color();
  constructor(
    readonly scene: Scene,
    readonly sun: DirectionalLight,
    readonly ambient: HemisphereLight,
    date = localDate(),
  ) {
    const state = calendarWeather(date);
    this.date = date;
    this.weather = state.weather;
    this.hour = this.startHour = state.hour;
    scene.backgroundNode = null;
    scene.background = new Color("#9ecbd2");
    this.sky.scale.setScalar(4500);
    this.sky.turbidity.value = 3;
    this.sky.rayleigh.value = 1.6;
    scene.add(this.sky);
    // Low/medium keep a sunlit, day/night gradient without evaluating atmospheric
    // scattering across every pixel, every frame. Physical SkyMesh remains High+.
    const skyMaterial = new MeshBasicNodeMaterial({side:BackSide,depthWrite:false,fog:false});
    skyMaterial.colorNode = mix(this.skyHorizon,this.skyTop,smoothstep(-.05,.60,positionLocal.y.div(4400)));
    this.budgetSky = new Mesh(new SphereGeometry(4400,24,12),skyMaterial); this.budgetSky.frustumCulled=false; this.budgetSky.renderOrder=-100; scene.add(this.budgetSky);
    const waterMaterial = new MeshStandardNodeMaterial({
      roughness: 0.24,
      metalness: 0.2,
      transparent: false,
    });
    const wave = sin(positionLocal.x.mul(0.045).add(this.clock.mul(1.25)))
      .mul(0.08)
      .add(cos(positionLocal.z.mul(0.065).sub(this.clock)).mul(0.055));
    waterMaterial.positionNode = positionLocal.add(vec3(0, wave, 0));
    const shore = sin(positionWorld.z.div(390)).mul(24).sub(1655);
    // Geometry already follows these water boundaries. No full-screen land
    // fragment discard; early depth rejection can work normally on both backends.
    const fresnel = pow(
      max(
        0,
        cameraPosition
          .sub(positionWorld)
          .normalize()
          .dot(normalWorld)
          .oneMinus(),
      ),
      3,
    );
    const ripples = sin(
      positionWorld.x
        .mul(0.7)
        .add(positionWorld.z.mul(0.4))
        .add(this.clock.mul(2)),
    ).mul(0.035);
    const foam = smoothstep(13, 1, abs(positionWorld.x.sub(shore))).mul(
      sin(positionWorld.z.mul(0.25).add(this.clock.mul(2)))
        .mul(0.2)
        .add(0.8),
    );
    waterMaterial.colorNode = mix(
      mix(color("#368e9e"), color("#b9d2cd"), fresnel.mul(0.65).add(ripples)),
      color("#e2e9ce"),
      foam.mul(0.8),
    );
    waterMaterial.emissiveNode = color("#305a66").mul(this.night).mul(0.15);
    const geo = makeWaterGeometry();
    this.water = new Mesh(geo, waterMaterial);
    this.water.position.y = -0.35;
    this.water.renderOrder = 1;
    scene.add(this.water);
    this.update(0, new Vector3(), false);
  }
  setDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const state = calendarWeather(date);
    this.date = date;
    this.weather = state.weather;
    this.startHour = this.hour = state.hour;
    this.elapsed = 0;
    this.lastUpdate = -1;
  }
  setHour(hour: number | null): void {
    this.forcedHour = hour === null ? null : ((hour % 24) + 24) % 24;
    this.lastUpdate = -1;
  }
  update(
    dt: number,
    anchor: { x: number; y: number; z: number },
    challengeNight: boolean,
  ): void {
    this.elapsed += dt;
    this.clock.value = this.elapsed;
    this.hour =
      this.forcedHour ??
      (challengeNight ? 22 : (this.startHour + this.elapsed / 60) % 24); // 24 minutes = 24 in-game hours.
    const l = lightAt(this.hour);
    this.night.value = l.night;
    this.sky.position.set(anchor.x, anchor.y, anchor.z); this.budgetSky.position.set(anchor.x,anchor.y,anchor.z);
    if (this.lastUpdate >= 0 && this.elapsed - this.lastUpdate < 0.15) return;
    this.lastUpdate = this.elapsed;
    const angle = ((this.hour - 6) / 24) * Math.PI * 2,
      cloudy =
        this.weather === "clear"
          ? 1
          : this.weather === "overcast"
            ? 0.65
            : 0.48;
    this.sky.sunPosition.value.set(
      Math.cos(angle) * 300000,
      Math.sin(angle) * 450000,
      -190000,
    );
    this.sky.turbidity.value = this.weather === "clear" ? 3 : 9;
    this.sky.rayleigh.value = 1.4 + l.golden * 1.8;
    // A single shadowed sun/moon proxy; emissive lamps/windows add light without hundreds of point-light passes.
    this.sun.position.set(
      anchor.x + Math.cos(angle) * 65,
      anchor.y + Math.max(35, Math.abs(l.elevation) * 95),
      anchor.z - 45,
    );
    this.sun.target.position.set(anchor.x, anchor.y, anchor.z);
    this.sun.intensity = (0.35 + l.daylight * 2.4) * cloudy;
    this.sun.color.set(
      l.night > 0.5 ? "#b7c9ed" : l.golden > 0.3 ? "#ffca91" : "#ffe6bf",
    );
    this.ambient.intensity = 0.98 + l.daylight * 0.9;
    this.ambient.color.set(l.night > 0.5 ? "#86adc6" : "#c4e4ed");
    this.tint.set(
      l.night > 0.5
        ? "#1b2d49"
        : this.weather === "fog"
          ? "#b4c9c2"
          : "#b9d1ce",
    );
    const density =
      this.weather === "fog"
        ? 0.00155
        : this.weather === "rain"
          ? 0.00075
          : 0.00018;
    if (!(this.scene.fog instanceof FogExp2))
      this.scene.fog = new FogExp2(this.tint, density);
    else {
      this.scene.fog.color.copy(this.tint);
      this.scene.fog.density = density;
    }
    this.skyTop.value.set(l.night>.5?'#0d203a':l.golden>.3?'#7c9baa':this.weather==='clear'?'#6badc9':'#96b7bc'); this.skyHorizon.value.set(l.night>.5?'#293d53':l.golden>.3?'#e6bc93':'#d0dbce');
    this.wet.value = this.weather === "rain" ? 1 : 0;
  }
  applyQuality(tier:QualityTier):void {this.sky.visible=tier.name==='High'||tier.name==='Ultra';this.budgetSky.visible=!this.sky.visible;}
  snapshot() {
    return {
      date: this.date,
      weather: this.weather,
      hour: this.hour,
      night: this.night.value,
      elapsed: this.elapsed,
      cycleRealSeconds: 1440,
      waves: true, skyMode:this.sky.visible?'physical-atmosphere':'budget-day-night-gradient',
      analyticalSkyReflection: true,
      shoreFoam: true,
    };
  }
  dispose(): void {
    this.scene.remove(this.sky, this.water,this.budgetSky); this.budgetSky.geometry.dispose();(this.budgetSky.material as MeshBasicNodeMaterial).dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.water.geometry.dispose();
    (this.water.material as MeshStandardNodeMaterial).dispose();
  }
}
function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
