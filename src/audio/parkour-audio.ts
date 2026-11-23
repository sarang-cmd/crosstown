// Shared Web Audio context/buses. Parkour tones are original synthesis; vehicle recordings have separate credits.
import { SaveStore } from '../save';
export class ParkourAudio {
  context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private music?: GainNode;
  engineBus?: GainNode;
  radioBus?: GainNode;
  get effectsBus(): GainNode | undefined { return this.effects; }
  private readonly storage = new SaveStore('crosstown:audio:v1');
  get gains() { return { master: this.master?.gain.value, engine: this.engineBus?.gain.value, effects: this.effects?.gain.value, radio: this.radioBus?.gain.value, music: this.music?.gain.value, paused: this.paused, radioDuck: this.radioDuck }; }
  private paused = false;
  private radioDuck = 1;
  private breeze?: AudioBufferSourceNode;
  volumes = { master: 0.5, engine: 0.65, effects: 0.55, radio: 0.45, music: 0.45 };
  private abort = new AbortController();
  constructor() {
    const raw = this.storage.read<Record<string, number>>({});
    if (raw && typeof raw === 'object') for (const bus of Object.keys(this.volumes) as (keyof typeof this.volumes)[]) if (typeof raw[bus] === 'number' && Number.isFinite(raw[bus])) this.volumes[bus] = Math.max(0, Math.min(1, raw[bus]!));
    const activate = () => void this.unlock();
    window.addEventListener('pointerdown', activate, { signal: this.abort.signal });
    window.addEventListener('keydown', activate, { signal: this.abort.signal });
  }
  async unlock(): Promise<void> {
    if (this.context) { if (this.context.state === 'suspended') await this.context.resume().catch(() => undefined); return; }
    try {
      const ctx = this.context = new AudioContext(); this.master = ctx.createGain(); this.master.gain.value = this.volumes.master; const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -8; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = .005; limiter.release.value = .15; this.master.connect(limiter).connect(ctx.destination);
      this.effects = ctx.createGain(); this.effects.gain.value = this.volumes.effects; this.effects.connect(this.master);
      this.engineBus = ctx.createGain(); this.engineBus.gain.value = this.volumes.engine; this.engineBus.connect(this.master);
      this.radioBus = ctx.createGain(); this.radioBus.gain.value = this.volumes.radio; this.radioBus.connect(this.master);
      this.music = ctx.createGain(); this.music.gain.value = this.volumes.music; this.music.connect(this.master);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), samples = buffer.getChannelData(0); let value = 0;
      for (let i = 0; i < samples.length; i++) { value = (value + (Math.random() * 2 - 1) * 0.02) / 1.025; samples[i] = value; }
      const wind = this.breeze = ctx.createBufferSource(); wind.buffer = buffer; wind.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800;
      const gain = ctx.createGain(); gain.gain.value = 0.08; wind.connect(filter).connect(gain).connect(this.effects); wind.start();
      await ctx.resume();
    } catch { /* Browser autoplay/access restrictions never gate gameplay. */ }
  }
  volume(bus: keyof ParkourAudio['volumes'], value: number): void { this.volumes[bus] = Math.min(1, Math.max(0, value)); const node = bus === 'master' ? this.master : bus === 'effects' ? this.effects : bus === 'engine' ? this.engineBus : bus === 'radio' ? this.radioBus : this.music; if (node && this.context) node.gain.setTargetAtTime(this.volumes[bus] * (bus === 'radio' ? this.radioDuck : bus === 'master' && this.paused ? .05 : 1), this.context.currentTime, 0.05); this.storage.write(this.volumes); }
  private tone(frequency: number, duration: number, gain = 0.07, delay = 0, music = false, end = frequency): void {
    const c = this.context, bus = music ? this.music : this.effects; if (!c || !bus || c.state !== 'running') return;
    const time = c.currentTime + delay, oscillator = c.createOscillator(), envelope = c.createGain(); oscillator.type = music ? 'sine' : 'triangle'; oscillator.frequency.setValueAtTime(frequency, time); oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), time + duration);
    envelope.gain.setValueAtTime(0.001, time); envelope.gain.exponentialRampToValueAtTime(gain, time + 0.015); envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope).connect(bus); oscillator.start(time); oscillator.stop(time + duration + 0.01); oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  effect(action: string): void {
    if (action === 'jump' || action === 'double') this.tone(action === 'double' ? 380 : 250, 0.17, 0.055, 0, false, 580);
    if (action === 'land' || action === 'roll') this.tone(110, 0.14, 0.1, 0, false, 45);
    if (action === 'coin') this.tone(990, 0.1, 0.04, 0, false, 1400);
    if (action === 'power') { this.tone(440, 0.24); this.tone(660, 0.28, 0.06, 0.09); }
    if (action === 'checkpoint') for (let i = 0; i < 3; i++) this.tone([523.25, 659.25, 783.99][i]!, 0.3, 0.06, i * 0.08);
    if (action === 'fall' || action === 'hazard') this.tone(190, 0.35, 0.08, 0, false, 70);
  }
  finish(): void {
    for (let chord = 0; chord < 4; chord++) for (const f of [[261.63, 329.63, 392], [293.66, 369.99, 440], [329.63, 415.3, 493.88], [261.63, 392, 523.25]][chord]!) this.tone(f, 2.4, 0.065, chord * 1.05, true);
    for (let i = 0; i < 16; i++) this.tone([523.25, 659.25, 783.99, 1046.5][i % 4]!, 0.4, 0.035, i * 0.24, true);
  }
  duckRadio(amount: number): void { if (Math.abs(amount - this.radioDuck) < .01) return; this.radioDuck = Math.max(.1, Math.min(1, amount)); if (this.radioBus && this.context) this.radioBus.gain.setTargetAtTime(this.volumes.radio * this.radioDuck, this.context.currentTime, .15); }
  pause(paused: boolean): void { this.paused = paused; if (this.master && this.context) this.master.gain.setTargetAtTime(paused ? 0.05 * this.volumes.master : this.volumes.master, this.context.currentTime, 0.1); }
  dispose(): void { this.abort.abort(); this.breeze?.stop(); void this.context?.close(); }
}
