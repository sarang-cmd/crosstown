import type { RunLength } from "../config/session";
// Reusable city-facing lifecycle. Three.js/UI/audio are listeners, never prerequisites of the simulation.
import { MOVEMENT } from "../config/movement";
import {
  PlayerController,
  emptyInput,
  type PlayerInput,
  type Motion,
} from "../player/controller";
import { ParkourStore, type GhostFrame, type RunResult } from "../save/parkour";
import { generateRoute } from "./generator";
import { RooftopPhysics } from "./physics";
import { hazardPosition } from "./hazards";
import {
  distance,
  horizontal,
  v3,
  type PowerType,
  type RouteData,
  type V3,
} from "./types";
export const MOTIONS: Motion[] = [
  "idle",
  "run",
  "sprint",
  "jump",
  "double",
  "slide",
  "climb",
  "fall",
  "land",
  "roll",
  "wallrun",
  "vault",
  "zipline",
  "swing",
];
export interface RunEvent {
  type: string;
  [key: string]: unknown;
}
export interface RunOptions {
  routeFactory?: (
    seed: number,
    training: boolean,
    length?: RunLength,
    origin?: V3,
  ) => RouteData | Promise<RouteData>;
  store?: ParkourStore;
  marker?: string;
  training?: boolean;
  length?: RunLength;
  origin?: V3;
}
export class ParkourRun {
  route!: RouteData;
  stage!: RooftopPhysics;
  player!: PlayerController;
  readonly store: ParkourStore;
  marker: string;
  origin?: V3;
  readonly training: boolean;
  length: RunLength;
  state: "loading" | "running" | "finished" | "disposed" = "loading";
  seed = 0;
  night = false;
  checkpoint = 0;
  elapsed = 0;
  remaining = 0;
  penalty = 0;
  falls = 0;
  collectibles = 0;
  cash = 0;
  finishTime = 0;
  bestImproved = false;
  result: RunResult | null = null;
  powers: Record<PowerType, number> = {
    double: 0,
    slow: 0,
    speed: 0,
    magnet: 0,
  };
  collected = new Set<string>();
  pickupPositions = new Map<string, V3>();
  ghost: GhostFrame[] = [];
  recording: GhostFrame[] = [];
  ghostEnabled = true;
  input: PlayerInput = emptyInput();
  eventCounts: Record<string, number> = {};
  private listeners = new Map<string, Set<(event: RunEvent) => void>>();
  private hazardCooldown = 0;
  private ghostClock = 0;
  private serial = 0;
  constructor(private options: RunOptions = {}) {
    this.store = options.store ?? new ParkourStore();
    this.marker = options.marker ?? "opening";
    this.origin = options.origin;
    this.training = options.training ?? false;
    this.length = options.length ?? "full";
  }
  on(type: string, callback: (event: RunEvent) => void): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(callback);
    return () => this.listeners.get(type)?.delete(callback);
  }
  private emit(type: string, data: Record<string, unknown> = {}): void {
    this.eventCounts[type] = (this.eventCounts[type] ?? 0) + 1;
    const event = { ...data, type };
    this.listeners.get(type)?.forEach((f) => f(event));
    this.listeners.get("*")?.forEach((f) => f(event));
  }
  async start(seed: number): Promise<void> {
    const serial = ++this.serial;
    this.state = "loading";
    const route = await (this.options.routeFactory ?? generateRoute)(
      seed >>> 0,
      this.training,
      this.length,
      this.origin,
    );
    if (serial !== this.serial || this.state === ("disposed" as string)) return;
    this.player?.dispose();
    this.stage?.dispose();
    this.seed = seed >>> 0;
    this.route = route;
    this.stage = new RooftopPhysics(route);
    this.player = new PlayerController(
      this.stage,
      route.spawn,
      route.spawnDirection,
    );
    this.initialize();
    this.emit("route", { route });
    this.emit("start", { seed: this.seed, night: this.night });
  }
  private initialize(): void {
    this.state = "running";
    this.elapsed =
      this.penalty =
      this.falls =
      this.cash =
      this.collectibles =
      this.finishTime =
      this.checkpoint =
      this.ghostClock =
        0;
    this.remaining = Math.round(
      this.route.expectedSeconds *
        (this.night ? 1.12 : this.length === "full" ? 1.25 : 1.22) +
        (this.length === "quick" ? 35 : 55),
    );
    this.powers = { double: 0, slow: 0, speed: 0, magnet: 0 };
    this.result = null;
    this.recording = [];
    this.collected.clear();
    this.pickupPositions.clear();
    this.input = emptyInput();
    this.hazardCooldown = 1.8;
    this.ghost =
      this.store.best(this.seed, this.scoreMarker, this.night)?.ghost ?? [];
  }
  get scoreMarker(): string {
    return this.length === "full"
      ? this.marker
      : `${this.marker}:${this.length}`;
  }
  async setLength(length: RunLength): Promise<void> {
    this.length = length;
    await this.start(this.seed);
  }
  reset(): void {
    if (!this.route || this.state === "disposed") return;
    this.stage.reset();
    this.player.respawn(this.route.spawn, this.route.spawnDirection);
    this.initialize();
    this.emit("reset", { seed: this.seed });
    this.emit("start", { seed: this.seed, night: this.night });
  }
  newSeed(): Promise<void> {
    const values = new Uint32Array(1);
    let seed: number;
    try {
      crypto.getRandomValues(values);
      seed = values[0]!;
    } catch {
      seed = Date.now() >>> 0;
    }
    if (seed === this.seed) seed = (seed + 1) >>> 0;
    return this.start(seed);
  }
  setNight(value: boolean): boolean {
    if (value && !this.store.data.night) {
      this.emit("locked");
      return false;
    }
    this.night = value;
    this.reset();
    this.emit("night", { night: value });
    return true;
  }
  setInput(input: PlayerInput): void {
    this.input = { ...input };
  }
  collect(id: string): boolean {
    const pickup = this.route.pickups.find((p) => p.id === id);
    if (!pickup || this.collected.has(id)) return false;
    this.collected.add(id);
    if (pickup.type === "coin") {
      this.cash += pickup.value;
      this.collectibles++;
    } else if (pickup.type === "time") this.remaining += pickup.value;
    else this.powers[pickup.type] = 10;
    this.emit("pickup", { pickup });
    return true;
  }
  respawn(): void {
    if (this.state !== "running") return;
    this.falls++;
    this.penalty += MOVEMENT.fallPenalty;
    this.remaining -= MOVEMENT.fallPenalty;
    const cp = this.route.checkpoints[this.checkpoint]!;
    this.player.respawn(cp.position, cp.direction);
    this.hazardCooldown = 2;
    this.emit("fall", {
      checkpoint: this.checkpoint,
      penalty: MOVEMENT.fallPenalty,
    });
  }
  update(dt: number): void {
    if (
      !Number.isFinite(dt) ||
      dt <= 0 ||
      this.state === "loading" ||
      this.state === "disposed"
    )
      return;
    dt = Math.min(0.1, dt);
    if (this.state === "finished") {
      this.finishTime += dt;
      return;
    }
    this.elapsed += dt;
    this.remaining -= dt;
    for (const key of Object.keys(this.powers) as PowerType[])
      this.powers[key] = Math.max(0, this.powers[key] - dt);
    this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    this.stage.update(
      dt * (this.powers.slow > 0 ? 0.32 : this.night ? 1.15 : 1),
      this.player.position,
    );
    this.player.update(dt, this.input, this.powers);
    // A pressed edge is consumed once even if a display frame contains several fixed physics updates.
    this.input.jump = this.input.interact = false;
    this.stage.world.timestep = dt;
    this.stage.world.step();
    this.player.afterPhysics();
    for (const action of this.player.events) this.emit("movement", { action });
    const p = this.player.position;
    const cp = this.route.checkpoints[this.checkpoint + 1];
    if (
      cp &&
      horizontal(p, cp.position) < 3.5 &&
      Math.abs(p.y - cp.position.y) < 2.1
    ) {
      this.checkpoint++;
      this.emit("checkpoint", { checkpoint: cp });
    }
    for (const pickup of this.route.pickups) {
      if (this.collected.has(pickup.id)) continue;
      let point = this.pickupPositions.get(pickup.id) ?? pickup.position;
      const d = distance(p, point);
      if (
        this.powers.magnet > 0 &&
        d < 9 &&
        d > 0.6 &&
        pickup.type === "coin"
      ) {
        const t = Math.min(1, dt * 7);
        point = v3(
          point.x + (p.x - point.x) * t,
          point.y + (p.y - point.y) * t,
          point.z + (p.z - point.z) * t,
        );
        this.pickupPositions.set(pickup.id, point);
      }
      if (distance(p, point) < 1.65) this.collect(pickup.id);
    }
    for (const h of this.route.hazards) {
      if (horizontal(p, h.center) > 16 || Math.abs(p.y - h.center.y) > 4)
        continue;
      const point = hazardPosition(h, this.stage.time),
        d = horizontal(p, point),
        side = v3(h.direction.z, 0, -h.direction.x);
      if (h.type === "wind") {
        const gust = Math.max(0, Math.sin(this.stage.time * h.speed + h.phase));
        if (d < h.radius && gust > 0.15) {
          const force =
            (this.player.grounded ? 0.2 : 1) *
            gust *
            h.strength *
            dt *
            MOVEMENT.windFactor;
          this.player.external.x += side.x * force;
          this.player.external.z += side.z * force;
          this.emit("wind", { id: h.id, force });
        }
        continue;
      }
      const along =
        (p.x - point.x) * h.direction.x + (p.z - point.z) * h.direction.z;
      const across = (p.x - point.x) * side.x + (p.z - point.z) * side.z;
      const contact =
        h.type === "laser"
          ? Math.abs(along) < 0.38 &&
            Math.abs(across) < 3 &&
            p.y < point.y &&
            p.y + this.player.height > point.y + 0.05
          : d < (h.type === "rolling" ? 1.12 : 0.95) &&
            Math.abs(p.y + 0.9 - point.y) < 1.2;
      if (contact && this.hazardCooldown <= 0) {
        const delta = v3(p.x - point.x || side.x, 0, p.z - point.z || side.z),
          length = Math.hypot(delta.x, delta.z) || 1;
        this.player.knock(
          v3(delta.x / length, 0, delta.z / length),
          h.strength * (this.night ? 1.15 : 1),
        );
        this.hazardCooldown = 1.3;
        this.emit("hazard", { hazard: h.type, id: h.id });
      }
    }
    if (
      p.y <
        this.route.checkpoints[this.checkpoint]!.position.y -
          MOVEMENT.fallRespawnDistance ||
      p.y < -2
    )
      this.respawn();
    this.ghostClock += dt;
    if (this.ghostClock >= 0.1 && this.recording.length < 15000) {
      this.ghostClock -= 0.1;
      this.recording.push([
        Math.round(this.elapsed * 10) / 10,
        Math.round(p.x * 100) / 100,
        Math.round(p.y * 100) / 100,
        Math.round(p.z * 100) / 100,
        Math.round(this.player.yaw * 100) / 100,
        MOTIONS.indexOf(this.player.motion),
      ]);
    }
    if (this.remaining <= 0) {
      this.emit("timeout", { seed: this.seed });
      this.reset();
      return;
    }
    if (
      this.checkpoint === this.route.checkpoints.length - 1 &&
      horizontal(p, this.route.goal) < 3.5 &&
      Math.abs(p.y - this.route.goal.y) < 2.5
    )
      this.finish();
  }
  private finish(): void {
    this.state = "finished";
    this.finishTime = 0;
    const seconds = this.elapsed + this.penalty;
    const ratio = seconds / Math.max(1, this.route.expectedSeconds);
    const rank =
      ratio <= 0.88 && this.falls === 0
        ? "S"
        : ratio <= 1.12 && this.falls < 3
          ? "A"
          : ratio <= 1.45
            ? "B"
            : "C";
    this.result = {
      seed: this.seed,
      marker: this.scoreMarker,
      night: this.night,
      seconds: Math.round(seconds * 100) / 100,
      falls: this.falls,
      collectibles: this.collectibles,
      cash: this.cash,
      rank,
      date: new Date().toISOString(),
    };
    this.bestImproved = this.store.finish(this.result, this.recording);
    this.emit("finish", { result: this.result, best: this.bestImproved });
  }
  ghostAt(time = this.elapsed): GhostFrame | null {
    if (!this.ghostEnabled || this.ghost.length < 2) return null;
    let index = Math.min(
      this.ghost.length - 2,
      Math.max(0, Math.floor(time * 10) - 1),
    );
    while (index > 0 && this.ghost[index]![0] > time) index--;
    while (index < this.ghost.length - 2 && this.ghost[index + 1]![0] < time)
      index++;
    const a = this.ghost[index]!,
      b = this.ghost[index + 1]!;
    if (time > b[0] + 0.3) return null;
    const t = Math.max(
      0,
      Math.min(1, (time - a[0]) / Math.max(0.001, b[0] - a[0])),
    );
    const angle = Math.atan2(Math.sin(b[4] - a[4]), Math.cos(b[4] - a[4]));
    return [
      time,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t,
      a[4] + angle * t,
      a[5],
    ];
  }
  dispose(): void {
    if (this.state === "disposed") return;
    ++this.serial;
    this.player?.dispose();
    this.stage?.dispose();
    this.state = "disposed";
    this.emit("dispose");
    this.listeners.clear();
  }
}
