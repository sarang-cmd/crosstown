// Accumulator loop: deterministic fixed updates, bounded catch-up, interpolated render snapshots.
export interface LoopCallbacks {
  beforeFrame(dt: number): void;
  fixedUpdate(dt: number): void;
  render(alpha: number, dt: number): void;
}
export class FixedStepLoop {
  paused = false;
  ticks = 0;
  simulationTime = 0;
  private previousTime: number | undefined;
  private accumulator = 0;
  constructor(
    private callbacks: LoopCallbacks,
    readonly step = 1 / 60,
    private maxDelta = 0.1,
    private maxSubsteps = 6,
  ) {}
  frame = (timeMs: number): void => {
    const dt = this.previousTime === undefined ? this.step : Math.min(this.maxDelta, Math.max(0, (timeMs - this.previousTime) / 1000));
    this.previousTime = timeMs;
    this.callbacks.beforeFrame(dt);
    if (this.paused) { this.accumulator = 0; this.callbacks.render(1, dt); return; }
    this.accumulator += dt;
    let count = 0;
    while (this.accumulator + 1e-10 >= this.step && count < this.maxSubsteps) {
      this.callbacks.fixedUpdate(this.step);
      this.accumulator -= this.step;
      this.ticks++;
      this.simulationTime += this.step;
      count++;
    }
    if (count === this.maxSubsteps && this.accumulator >= this.step) this.accumulator %= this.step;
    this.callbacks.render(Math.max(0, this.accumulator / this.step), dt);
  };
  setPaused(value: boolean): void {
    this.paused = value;
    this.accumulator = 0;
  }
  resetClock(): void { this.previousTime = undefined; this.accumulator = 0; }
}
