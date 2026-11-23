// Deterministic ignition/transmission state. Browser rendering and audio are listeners, never the clock.
import { HARBOR, clamp, torqueAt, type CarDefinition } from './cars';
export type EnginePhase = 'off' | 'door-open' | 'door-close' | 'key' | 'ignition' | 'cranking' | 'catch' | 'running' | 'stalled' | 'shutdown';
export interface DriveInput { throttle: number; brake: number; steering: number; handbrake: boolean; clutch: boolean; directSteer?: boolean }
export const neutralDrive = (): DriveInput => ({ throttle: 0, brake: 0, steering: 0, handbrake: false, clutch: false });
export class Powertrain {
  allowReverse = true;
  phase: EnginePhase = 'off'; occupied = false; manual = false; gear = 1; rpm = 0; temperature = 19; cold = true;
  phaseTime = 0; fastIdle = 0; shiftTime = 0; load = 0; door = 0; keyAngle = 0; sweep = 0; stallTime = 0;
  readonly history: { phase: EnginePhase; time: number }[] = [{ phase: 'off', time: 0 }];
  readonly events: string[] = [];
  time = 0; private startingWithDoor = false;
  constructor(readonly definition: CarDefinition = HARBOR) {}
  get running(): boolean { return this.phase === 'running' || this.phase === 'catch'; }
  private transition(phase: EnginePhase): void {
    this.phase = phase; this.phaseTime = 0; this.events.push(phase); this.history.push({ phase, time: this.time });
    if (this.history.length > 64) this.history.shift();
  }
  enter(): boolean { if (this.occupied) return false; this.occupied = true; this.cold = this.temperature < 38; this.startingWithDoor = true; this.transition('door-open'); return true; }
  exit(): void { this.occupied = false; this.events.push('exit-door'); this.door = 1; }
  toggleIgnition(): void {
    if (!this.occupied) return;
    if (this.running || ['key', 'ignition', 'cranking', 'catch'].includes(this.phase)) this.transition('shutdown');
    else { this.cold = this.temperature < 38; this.startingWithDoor = false; this.transition('key'); }
  }
  shift(delta: number): boolean {
    if (!this.manual || this.shiftTime > 0) return false;
    this.gear = Math.round(clamp(this.gear + delta, -1, this.definition.ratios.length - 1)); this.shiftTime = 0.23; this.events.push('shift'); return true;
  }
  toggleManual(): void { this.manual = !this.manual; if (!this.manual && this.gear === 0) this.gear = 1; this.events.push('transmission'); }
  update(dt: number, input: DriveInput, speed: number, drivenWheelRpm?: number): number {
    const c = this.definition; dt = clamp(dt, 0, 0.05); this.time += dt; this.phaseTime += dt; this.shiftTime = Math.max(0, this.shiftTime - dt);
    this.load += (clamp(input.throttle) - this.load) * (1 - Math.exp(-dt * 9));
    if (!this.occupied) this.door = Math.max(0, this.door - dt * 1.7);
    switch (this.phase) {
      case 'door-open': this.door = Math.min(1, this.phaseTime / 0.45); if (this.phaseTime >= 0.6) this.transition('door-close'); break;
      case 'door-close': this.door = Math.max(0, 1 - this.phaseTime / 0.4); if (this.phaseTime >= 0.45) this.transition('key'); break;
      case 'key': this.keyAngle = clamp(this.phaseTime / 0.22) * 0.5; if (this.phaseTime >= 0.25) this.transition('ignition'); break;
      case 'ignition': this.sweep = Math.sin(clamp(this.phaseTime / 0.8) * Math.PI); if (this.phaseTime >= 0.8) this.transition('cranking'); break;
      case 'cranking':
        this.rpm = 180 + Math.sin(this.phaseTime * 27) * 65; this.keyAngle = 1; this.sweep = 0;
        if (this.phaseTime >= (this.cold ? 1.65 : 0.62)) {
          if (this.manual && this.gear !== 0 && !input.clutch) { this.rpm = 0; this.transition('stalled'); }
          else { this.fastIdle = this.cold ? 20 : 0; this.rpm = this.cold ? 1550 : 1150; this.transition('catch'); }
        } break;
      case 'catch': this.keyAngle = 0.5; if (this.phaseTime >= 0.65) this.transition('running'); break;
      case 'shutdown': this.rpm *= Math.exp(-dt * 5); this.keyAngle = Math.max(0, this.keyAngle - dt); if (this.phaseTime > 0.8) { this.rpm = 0; this.transition('off'); } break;
      case 'stalled': this.rpm = 0; break;
      case 'off': this.rpm = 0; this.keyAngle = 0; break;
    }
    if (!this.running) { this.temperature = Math.max(15, this.temperature - dt * 0.04); return 0; }
    this.temperature += (89 + input.throttle * 4 - this.temperature) * dt * 0.012;
    this.fastIdle = Math.max(0, this.fastIdle - dt);
    if (!this.manual) {
      if (Math.abs(speed) < 0.8) { if (this.allowReverse && input.brake > 0.15 && input.throttle < 0.1) this.gear = -1; else if (input.throttle > 0.1) this.gear = 1; }
      if (this.gear > 0 && this.shiftTime <= 0) {
        if (this.rpm > c.redline * 0.88 && this.gear < c.ratios.length - 1) { this.gear++; this.shiftTime = 0.27; this.events.push('shift'); }
        else if (this.rpm < 1550 && this.gear > 1) { this.gear--; this.shiftTime = 0.22; this.events.push('shift'); }
      }
    }
    const ratio = this.gear < 0 ? -c.reverseRatio : c.ratios[this.gear] ?? 0;
    const coupled = this.gear !== 0 && !input.clutch && this.shiftTime <= 0;
    const rollingRpm = Math.abs(drivenWheelRpm ?? speed / (2 * Math.PI * c.wheelRadius) * 60) * Math.abs(ratio) * c.finalDrive;
    const idle = c.idleRpm + (this.fastIdle > 0 ? 380 : 0);
    const pedal = this.gear < 0 ? input.brake : input.throttle;
    const freeRpm = idle + pedal * (c.redline - idle) * 0.96;
    const target = (coupled || (!this.manual && this.shiftTime > 0)) ? Math.max(this.manual ? rollingRpm : idle, rollingRpm + pedal * (this.manual ? 0 : 1000 / Math.max(1, this.gear))) : freeRpm;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt * (coupled ? 9 : 4.4)));
    this.rpm = clamp(this.rpm, 0, c.redline + 150);
    if (this.manual && coupled && this.rpm < c.stallRpm) this.stallTime += dt; else this.stallTime = 0;
    if (this.stallTime > 0.45) { this.transition('stalled'); this.rpm = 0; this.stallTime = 0; return 0; }
    if (!coupled || this.phase === 'catch') return 0;
    const limiter = this.rpm > c.redline ? 0.08 : 1;
    const top = clamp((c.topSpeed + 2 - Math.abs(speed)) / 5);
    const drive = torqueAt(c, Math.max(idle, this.rpm)) * pedal * ratio * c.finalDrive * c.efficiency * limiter * top / c.wheelRadius;
    const drag = c.engineBrakeTorque * (1 - pedal) * Math.abs(ratio) * c.finalDrive / c.wheelRadius * Math.sign(speed) * clamp(Math.abs(speed) / 2);
    return drive - drag;
  }
  drainEvents(): string[] { return this.events.splice(0); }
  snapshot() { return { phase: this.phase, occupied: this.occupied, manual: this.manual, gear: this.gear, rpm: this.rpm, temperature: this.temperature, cold: this.cold, fastIdleSeconds: this.fastIdle, door: this.door, keyAngle: this.keyAngle, gaugeSweep: this.sweep, history: [...this.history], startingWithDoor: this.startingWithDoor }; }
}
