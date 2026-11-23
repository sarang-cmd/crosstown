// Hybrid recorded + firing-order engine synthesis. One shared browser AudioContext, no audio dependency.
import { Vector3, type Camera } from 'three/webgpu';
import type { ParkourAudio } from './parkour-audio';
import { ENGINE_TIMBRES, loopWeights, nearestEmitters, firingHz } from './engine-mix';
import { clamp, type EngineType } from '../vehicles/cars';
import type { RaycastCar } from '../vehicles/physics';
interface LoopRecord { file: string; anchorRpm: number; band: string; load: string }
interface LoopLayer { source: AudioBufferSourceNode; gain: GainNode; anchor: number }
export interface SoundEmitter { id: string; car: RaycastCar; engine: EngineType; profile: string; position: { x: number; y: number; z: number }; priority?: number }
const folders: Record<EngineType, string> = { i4: 'cabin-compact', v6: 'harbor', v8: 'cabin-muscle', flat6: 'cabin-supercar', diesel: 'cabin-suv', single: 'cabin-motorbike', twin: 'kestrel', v10: 'zenith' };
export const profileFor = (type: EngineType): string => folders[type];
function target(param: AudioParam, value: number, c: BaseAudioContext, duration = .045): void { param.setTargetAtTime(Number.isFinite(value) ? value : 0, c.currentTime, duration); }
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), a = b.getChannelData(0); let seed = 7287;
  for (let i = 0; i < a.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; a[i] = seed / 2147483648 - 1; } return b;
}
class EngineVoice {
  readonly panner: PannerNode; readonly volume: GainNode; readonly filter: BiquadFilterNode; readonly synth: GainNode;
  readonly clatter: OscillatorNode; readonly clatterGain: GainNode;
  readonly pulse: OscillatorNode; readonly sub: OscillatorNode; readonly turbo: OscillatorNode; readonly whine: OscillatorNode;
  readonly turboGain: GainNode; readonly whineGain: GainNode; readonly subGain: GainNode;
  readonly intake: AudioBufferSourceNode; readonly intakeGain: GainNode; readonly intakeFilter: BiquadFilterNode;
  readonly tireGain: GainNode; readonly tireFilter: BiquadFilterNode; readonly windGain: GainNode;
  state: 'loading' | 'samples' | 'synth-fallback' = 'loading'; reason = ''; layers: LoopLayer[] = []; anchors: number[] = []; rms = 0; weights: number[] = []; pitches: number[] = [];
  private destroyed = false; private previousLoad = 0; private popClock = 0; private creakClock = 0;
  private sources: (OscillatorNode | AudioBufferSourceNode)[] = []; private nodes: AudioNode[] = []; private abort = new AbortController();
  constructor(readonly host: VehicleAudio, readonly emitter: SoundEmitter) {
    const c = host.context!, timbre = ENGINE_TIMBRES[emitter.engine];
    this.volume = c.createGain(); this.volume.gain.value = 0;
    this.panner = c.createPanner(); this.panner.panningModel = 'equalpower'; this.panner.distanceModel = 'inverse'; this.panner.refDistance = 5; this.panner.maxDistance = 180; this.panner.rolloffFactor = 1.3;
    this.volume.connect(this.panner).connect(host.audio.engineBus!);
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 1200; this.filter.Q.value = .75; this.filter.connect(this.volume);
    this.synth = c.createGain(); this.synth.gain.value = .15; this.synth.connect(this.filter);
    const real = new Float32Array(24), imag = new Float32Array(24); for (let k = 1; k < imag.length; k++) { imag[k] = 1 / (k ** (1.05 + timbre.roughness)) * (k % 2 ? 1 : .35 + timbre.roughness); real[k] = timbre.roughness * Math.sin(k * 1.39) / k; }
    this.pulse = c.createOscillator(); this.pulse.setPeriodicWave(c.createPeriodicWave(real, imag)); this.pulse.connect(this.synth);
    this.sub = c.createOscillator(); this.sub.type = emitter.engine === 'diesel' ? 'sawtooth' : 'triangle'; this.subGain = c.createGain(); this.subGain.gain.value = .06 * timbre.sub; this.sub.connect(this.subGain).connect(this.filter);
    this.turbo = c.createOscillator(); this.turbo.type = 'sine'; this.turboGain = c.createGain(); this.turboGain.gain.value = 0; this.turbo.connect(this.turboGain).connect(this.filter);
    this.whine = c.createOscillator(); this.whine.type = 'sine'; this.whineGain = c.createGain(); this.whineGain.gain.value = 0; this.whine.connect(this.whineGain).connect(this.filter);
    this.intake = c.createBufferSource(); this.intake.buffer = host.noise!; this.intake.loop = true; this.intakeGain = c.createGain(); this.intakeGain.gain.value = .01; this.intakeFilter = c.createBiquadFilter(); this.intakeFilter.type = 'bandpass'; this.intakeFilter.Q.value = .8; this.intake.connect(this.intakeFilter).connect(this.intakeGain).connect(this.filter);
    this.clatter = c.createOscillator(); this.clatter.type = 'sine'; this.clatterGain = c.createGain(); this.clatterGain.gain.value = emitter.engine === 'diesel' ? .014 : 0; this.clatter.connect(this.clatterGain).connect(this.intakeGain.gain);
    const tire = c.createBufferSource(); tire.buffer = host.noise!; tire.loop = true; this.tireFilter = c.createBiquadFilter(); this.tireFilter.type = 'bandpass'; this.tireFilter.Q.value = 2.4; this.tireGain = c.createGain(); this.tireGain.gain.value = 0; tire.connect(this.tireFilter).connect(this.tireGain).connect(host.audio.effectsBus!);
    const wind = c.createBufferSource(); wind.buffer = host.noise!; wind.loop = true; const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 450; this.windGain = c.createGain(); this.windGain.gain.value = 0; wind.connect(wf).connect(this.windGain).connect(host.audio.effectsBus!);
    this.sources.push(this.clatter, this.pulse, this.sub, this.turbo, this.whine, this.intake, tire, wind); this.nodes.push(this.clatterGain, this.volume, this.panner, this.filter, this.synth, this.subGain, this.turboGain, this.whineGain, this.intakeFilter, this.intakeGain, this.tireGain, this.tireFilter, this.windGain, wf); this.sources.forEach(s => s.start());
    void this.load();
  }
  private async load(): Promise<void> {
    const c = this.host.context!;
    try {
      const base = `/audio/cars/${encodeURIComponent(this.emitter.profile)}/`, response = await fetch(base + 'manifest.json', { signal: this.abort.signal }); if (!response.ok) throw new Error('manifest unavailable');
      const manifest = await response.json() as { loops: LoopRecord[] };
      if (!Array.isArray(manifest.loops) || manifest.loops.length !== 8) throw new Error('eight recorded load layers required');
      const records = manifest.loops;
      for (let i = 0; i < 8; i++) if (!records[i] || !/^(idle|low|mid|high)-(on|off)\.wav$/.test(records[i]!.file) || !Number.isFinite(records[i]!.anchorRpm) || records[i]!.anchorRpm < 100) throw new Error('invalid replacement manifest');
      const buffers = await Promise.all(records.map(async r => { const res = await fetch(base + r.file, { signal: this.abort.signal }); if (!res.ok) throw new Error(`${r.file} missing (${res.status})`); const buffer = await c.decodeAudioData(await res.arrayBuffer()); if (!buffer.length || buffer.duration < .1) throw new Error('empty sample'); return buffer; }));
      if (this.destroyed) return;
      const when = c.currentTime + .03;
      this.layers = buffers.map((buffer, i) => { const source = c.createBufferSource(), gain = c.createGain(); source.buffer = buffer; source.loop = true; gain.gain.value = 0; source.connect(gain).connect(this.filter); source.start(when); this.sources.push(source); this.nodes.push(gain); return { source, gain, anchor: records[i]!.anchorRpm }; });
      this.anchors = records.filter((_, i) => i % 2 === 0).map(r => r.anchorRpm); this.state = 'samples';
    } catch (error) { if (!this.destroyed) { this.state = 'synth-fallback'; this.reason = error instanceof Error ? error.message : 'sample loading failed'; } }
  }
  update(dt: number, cabin: boolean): void {
    const c = this.host.context!, e = this.emitter.car.engine, car = this.emitter.car, timbre = ENGINE_TIMBRES[this.emitter.engine];
    const active = e.running || e.phase === 'cranking', rpm = e.rpm, load = clamp(e.gear < 0 ? car.input.brake : car.input.throttle);
    const pos = this.emitter.position;
    const listener = this.host.listenerPosition;
    target(this.panner.positionX, cabin ? listener.x : pos.x, c); target(this.panner.positionY, cabin ? listener.y - .5 : pos.y, c); target(this.panner.positionZ, cabin ? listener.z : pos.z, c);
    target(this.volume.gain, active ? (cabin ? .53 : .72) : 0, c, active ? .05 : .13);
    const tune = car.definition.sound;
    const firing = firingHz(rpm, this.emitter.engine) * tune.pitch, jitter = 1 + Math.sin(e.time * 17.37) * timbre.roughness * .012;
    target(this.pulse.frequency, firing * jitter, c); target(this.sub.frequency, Math.max(5, firing / 2), c);
    target(this.synth.gain, e.phase === 'cranking' ? .11 : (this.state === 'samples' ? .043 : .19) * (.65 + load * .5), c, .10);
    target(this.subGain.gain, timbre.sub * (this.state === 'samples' ? .035 : .065), c);
    target(this.filter.frequency, (cabin ? .72 : 1) * (timbre.brightness + load * 2900 + rpm * .15) * tune.brightness, c);
    target(this.turbo.frequency, 500 + rpm * .75, c); target(this.turboGain.gain, timbre.turbo * load * clamp(rpm / 4800) * .08, c);
    target(this.whine.frequency, 170 + rpm * .85, c); target(this.whineGain.gain, clamp(Math.abs(car.speed) / 40) * .007, c);
    target(this.intakeFilter.frequency, 200 + rpm * .25 + load * 1900, c); target(this.intakeGain.gain, .018 + load * .035 + (this.emitter.engine === 'diesel' ? .02 : 0), c); target(this.clatter.frequency, firing, c);
    if (this.layers.length) {
      this.weights = loopWeights(rpm, e.load, this.anchors); this.pitches = [];
      this.layers.forEach((l, i) => { const pitch = clamp(rpm / l.anchor * tune.pitch, .45, 2.2); this.pitches.push(pitch); target(l.source.playbackRate, pitch, c, .055); target(l.gain.gain, this.weights[i]! * .63, c, .065); });
    }
    const audible = active && cabin;
    target(this.tireFilter.frequency, car.surface === 'gravel' ? 1550 : car.surface === 'grass' ? 600 : 2600, c); target(this.tireGain.gain, audible ? clamp(car.slip * 2.5 + (car.surface === 'asphalt' ? 0 : Math.abs(car.speed) / 100)) * clamp(Math.abs(car.speed) / 12) * .11 : 0, c);
    target(this.windGain.gain, audible ? clamp(Math.abs(car.speed) / 55) ** 2 * .10 : 0, c);
    this.popClock = Math.max(0, this.popClock - dt);
    if (this.previousLoad > .58 && load < .1 && rpm > 2400 && active && this.popClock === 0) { this.host.effect(timbre.turbo > .1 ? 'blowoff' : 'exhaust-pop', .35, car.surface); this.popClock = .4; }
    this.creakClock = Math.max(0, this.creakClock - dt); if (car.contacts > 0 && Math.hypot(car.body.angvel().x, car.body.angvel().z) > .8 && this.creakClock === 0) { this.host.effect('creak', .3); this.creakClock = .6; }
    this.previousLoad = load;
  }
  dispose(): void { this.destroyed = true; this.abort.abort(); for (const s of this.sources) { try { s.stop(); } catch { /* stopped one-shot */ } s.disconnect(); } this.nodes.forEach(n => n.disconnect()); }
  snapshot() { return { id: this.emitter.id, engine: this.emitter.engine, profile: this.emitter.profile, state: this.state, reason: this.reason, loops: this.layers.length, weights: this.weights, playbackRates: this.pitches, firingHz: firingHz(this.emitter.car.engine.rpm, this.emitter.engine), spatial: this.panner instanceof PannerNode, position: [this.panner.positionX.value, this.panner.positionY.value, this.panner.positionZ.value] }; }
}
export class VehicleAudio {
  context?: AudioContext; noise?: AudioBuffer;
  readonly listenerPosition = new Vector3();
  private forward = new Vector3(); private up = new Vector3(); private voices = new Map<string, EngineVoice>(); private shots: { source: AudioScheduledSourceNode; gain: GainNode; filter?: BiquadFilterNode }[] = [];
  private previousHandbrake = false; private indicatorClock = -1; private previousRPM = 0;
  private analyser?: AnalyserNode; private analysis?: Uint8Array<ArrayBuffer>; rms = 0;
  constructor(readonly audio: ParkourAudio) {}
  update(emitters: SoundEmitter[], camera: Camera, dt: number, activeId?: string, indicator = 0): void {
    if (!this.audio.context || !this.audio.engineBus) return;
    if (!this.context) {
      this.context = this.audio.context; this.noise = noiseBuffer(this.context); this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256; this.audio.engineBus.connect(this.analyser); this.analysis = new Uint8Array(256);
    }
    const c = this.context;
    camera.getWorldPosition(this.listenerPosition); camera.getWorldDirection(this.forward); this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const l = c.listener;
    if (l.positionX) { target(l.positionX, this.listenerPosition.x, c, .03); target(l.positionY, this.listenerPosition.y, c, .03); target(l.positionZ, this.listenerPosition.z, c, .03); target(l.forwardX, this.forward.x, c, .03); target(l.forwardY, this.forward.y, c, .03); target(l.forwardZ, this.forward.z, c, .03); target(l.upX, this.up.x, c, .03); target(l.upY, this.up.y, c, .03); target(l.upZ, this.up.z, c, .03); }
    const chosen = nearestEmitters(emitters.filter(e => e.car.engine.phase !== 'off' && (e.id === activeId || this.listenerPosition.distanceTo(e.position) < 150)), this.listenerPosition);
    const ids = new Set(chosen.map(e => e.id));
    for (const [id, voice] of this.voices) if (!ids.has(id)) { voice.dispose(); this.voices.delete(id); }
    for (const emitter of chosen) {
      let v = this.voices.get(emitter.id);
      if (v && (v.emitter.engine !== emitter.engine || v.emitter.profile !== emitter.profile)) { v.dispose(); this.voices.delete(emitter.id); v = undefined; }
      if (!v) { v = new EngineVoice(this, emitter); this.voices.set(emitter.id, v); }
      Object.assign(v.emitter, emitter); v.update(dt, emitter.id === activeId);
    }
    const active = chosen.find(e => e.id === activeId)?.car;
    if (active) {
      if (active.input.handbrake && !this.previousHandbrake) this.effect('handbrake', .5);
      this.previousHandbrake = active.input.handbrake;
      const clock = Math.floor(active.engine.time * 3); if (indicator && clock !== this.indicatorClock) this.effect('indicator', .23); this.indicatorClock = clock;
      this.previousRPM = active.engine.rpm;
    }
    if (this.analyser && this.analysis) { this.analyser.getByteTimeDomainData(this.analysis); this.rms = Math.sqrt(this.analysis.reduce((sum, x) => sum + ((x - 128) / 128) ** 2, 0) / this.analysis.length); }
    // The future radio bus already has start ducking. No station backend is claimed by this step.
    const starting = !!active && !['off', 'running', 'shutdown'].includes(active.engine.phase); this.audio.duckRadio(starting ? .22 : 1);
  }
  effect(name: string, intensity = .5, surface = 'concrete'): void {
    const c = this.context ?? this.audio.context, bus = this.audio.effectsBus; if (!c || !bus || c.state !== 'running') return;
    const duration = name === 'ignition' ? .8 : ['door-open', 'door-close', 'exit-door'].includes(name) ? .24 : name === 'glass' ? .7 : name === 'shutdown' ? .55 : name === 'blowoff' ? .38 : .13;
    const noisy = ['door-open', 'door-close', 'exit-door', 'collision', 'glass', 'suspension', 'blowoff', 'cranking'].includes(name);
    const source = noisy ? c.createBufferSource() : c.createOscillator(), gain = c.createGain(), filter = c.createBiquadFilter(), time = c.currentTime;
    filter.type = name === 'glass' || name === 'blowoff' ? 'highpass' : 'lowpass'; filter.frequency.value = name === 'glass' ? 3200 : name === 'blowoff' ? 1800 : surface === 'gravel' ? 1700 : 800;
    if (source instanceof AudioBufferSourceNode) { source.buffer = this.noise ?? noiseBuffer(c); source.loop = true; source.playbackRate.value = name === 'door-open' ? .58 : 1; }
    else { source.type = name === 'exhaust-pop' || name === 'shutdown' ? 'sawtooth' : 'triangle'; const f = name === 'horn' ? 390 : name === 'key' ? 1800 : name === 'indicator' ? 900 : name === 'ignition' ? 180 : name === 'catch' ? 88 : name === 'shift' ? 230 : name === 'shutdown' ? Math.max(80, this.previousRPM / 12) : name === 'handbrake' ? 700 : 130; source.frequency.setValueAtTime(f, time); source.frequency.exponentialRampToValueAtTime(Math.max(30, f * .4), time + duration); }
    const volume = ['collision', 'glass', 'suspension', 'catch'].includes(name) ? .15 : .055;
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume * clamp(intensity, .05, 1)), time + .008); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter).connect(gain).connect(bus);
    if (this.shots.length >= 16) { const oldest = this.shots.shift()!; try { oldest.source.stop(); } catch { /* already ended */ } oldest.gain.disconnect(); oldest.filter?.disconnect(); }
    const shot = { source, gain, filter }; this.shots.push(shot); source.start(time); source.stop(time + duration + .02); source.onended = () => { source.disconnect(); gain.disconnect(); filter.disconnect(); const i = this.shots.indexOf(shot); if (i >= 0) this.shots.splice(i, 1); };
  }
  resetVoice(id: string): void { this.voices.get(id)?.dispose(); this.voices.delete(id); }
  snapshot() { return { context: this.context?.state ?? 'awaiting-browser-gesture', activeEmitters: this.voices.size, emitterLimit: 16, priority: 'controlled car, then nearest first', activeOneShots: this.shots.length, rms: this.rms, voices: [...this.voices.values()].map(v => v.snapshot()), volumes: this.audio.volumes, gains: this.audio.gains }; }
  dispose(): void { for (const voice of this.voices.values()) voice.dispose(); this.voices.clear(); for (const s of this.shots) { try { s.source.stop(); } catch { /* already ended */ } s.gain.disconnect(); s.filter?.disconnect(); } this.shots = []; this.analyser?.disconnect(); }
}
