import { Vector3, type Camera } from 'three/webgpu';
import { HUD, type HUDCallbacks } from './index';
import { keyLabel } from '../config/actions';
import type { InputManager } from '../core/input';
import type { Settings } from '../save';
import type { QualityScaler } from '../core/quality';
import type { ParkourRun } from '../parkour/ParkourRun';
import type { ParkourAudio } from '../audio/parkour-audio';
export const formatTime = (seconds: number): string => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
const POWER = { double: ['2×', 'DOUBLE JUMP'], slow: ['◷', 'SLOW MOTION'], speed: ['↗', 'SPEED BOOST'], magnet: ['∩', 'MAGNET'] };
export class ParkourHUD {
  readonly settingsHUD: HUD;
  private root: HTMLElement;
  private map: HTMLCanvasElement;
  private point = new Vector3();
  private refs = new Map<string, HTMLElement>();
  constructor(host: HTMLElement, readonly input: InputManager, readonly settings: Settings, callbacks: HUDCallbacks, audio: ParkourAudio) {
    this.settingsHUD = new HUD(host, input, settings, callbacks); this.root = host;
    document.body.classList.add('parkour-game');
    host.querySelector('.build-label')!.innerHTML = 'TAKE THE LONG WAY <span>/</span> 14';
    host.querySelector('.live-state')!.innerHTML = '<i></i> LIVE RUN';
    host.querySelector('.settings-header p')!.textContent = 'Your momentum will be right here.';
    host.querySelector('.foundation-info p')!.textContent = 'A 4 km coastal city · worker streaming · Rapier parkour / twelve vehicles · six class cabins · living streets · a 24-minute day. The original engine sandbox remains available at ?sandbox; the eight-checkpoint movement route at ?training.';
    host.querySelector('.foundation-info h3')!.innerHTML = 'This run <span>04</span>';
    host.querySelector('.foundation-info #reset-save')!.textContent = 'Reset saved settings & parkour progress ↗';
    host.querySelector('.settings-footer > span')!.textContent = 'CROSSTOWN — CITY IN MOTION / 01—14';
    host.querySelector('.setting-note:has(+ .raw-axes)')?.replaceChildren(document.createTextNode('Left stick to move, right stick to look, A jump, LB sprint, B slide, X traverse, Y reset. In the car: RT / LT pedals, left stick steering, A handbrake, X enter / exit, L3 camera, R3 ignition, LB / RB shift. Wheel mapping is live.'));
    host.querySelector('#reduced-motion')?.closest('label')?.querySelector('small')?.replaceChildren(document.createTextNode('Gentle camera; camera blur, heat haze and flare disabled.'));
    const sound = document.createElement('section'); sound.className = 'settings-section'; sound.innerHTML = `<h3>Sound <span>05</span></h3><p class="setting-note">Licensed real engine recordings + original Web Audio synthesis. Music is the rooftop finish swell; Y opens the separate in-car radio. Audio unlocks on your first movement key or click; gameplay never waits for sound.</p>${(['master', 'engine', 'effects', 'radio', 'music'] as const).map(bus => `<label class="sound-slider">${bus}<input type="range" min="0" max="1" step="0.01" value="${audio.volumes[bus]}" data-audio="${bus}" aria-label="${bus} volume"></label>`).join('')}`;
    host.querySelector('.settings-column:last-child')!.append(sound);
    sound.querySelectorAll<HTMLInputElement>('[data-audio]').forEach(el => el.addEventListener('input', () => audio.volume(el.dataset.audio as keyof typeof audio.volumes, Number(el.value))));
    const run = document.createElement('div'); run.className = 'run-ui'; run.innerHTML = `
      <section class="run-location"><div class="run-eyebrow"><i></i><span id="run-district">DOWNTOWN</span><span id="run-day">DAY RUN</span></div><h1>THE ROOFTOPS<span>↗</span></h1><div class="run-seed">SEED <b id="run-seed">—</b><span>·</span><span id="run-length">—</span></div></section>
      <section class="run-score" aria-label="Run progress"><div class="timer-block"><span>TIME LEFT</span><strong id="run-timer">—</strong><small id="run-elapsed">00:00 elapsed</small></div><div class="checkpoint-block"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" class="progress-track"/><circle cx="32" cy="32" r="27" class="progress-ring" id="cp-ring"/></svg><span><b id="run-cp">01</b><small id="run-cp-total">/ 28</small></span></div><div class="checkpoint-label">CHECKPOINT<div id="run-cp-name">Sunthread</div></div></section>
      <div class="power-list" id="power-list">${Object.entries(POWER).map(([key, value]) => `<div class="power-pill" id="power-${key}" hidden><b>${value[0]}</b><span>${value[1]}<i><em id="power-bar-${key}"></em></i></span><small id="power-seconds-${key}">10s</small></div>`).join('')}</div>
      <div class="checkpoint-callout" id="cp-callout"><span>↗</span><div><strong id="cp-distance">— m</strong><small id="cp-label">NEXT CHECKPOINT</small></div></div>
      <aside class="run-minimap"><canvas id="run-map" width="300" height="300" aria-label="Live rooftop route map"></canvas><div class="map-north">N</div><div class="map-coordinate" id="map-coordinate">SUNTHREAD</div></aside>
      <div class="run-bottom"><div class="run-traverse" id="run-traverse" hidden><kbd>E</kbd><span>Traverse</span></div><nav class="run-controls" aria-label="Parkour controls"><span><kbd>W A S D</kbd> Move</span><span><kbd id="hint-jump">Space</kbd> Jump</span><span><kbd id="hint-sprint">Shift</kbd> Sprint</span><span><kbd id="hint-slide">X</kbd> Slide</span><span><kbd id="hint-interact">E</kbd> Traverse</span><span><kbd id="hint-reset">R</kbd> Reset</span><span><kbd>N</kbd> New seed</span></nav><div class="run-subhint">DRAG TO LOOK <i>·</i> <kbd>C</kbd> RECENTER <i>·</i> <kbd>H</kbd> CONTROLS <i>·</i> <span id="ghost-hint">G GHOST</span></div></div>
      <aside class="run-telemetry"><span class="quality-led"></span><b id="run-fps">— FPS</b><span id="run-quality">AUTO · HIGH</span><span id="run-backend">WebGPU</span><small id="run-stats">0 draws</small></aside>
      <div class="run-cash"><span>◇</span><b id="run-cash">0</b><small>CASH</small></div>
      <section class="run-result" id="run-result" aria-live="polite" hidden><div class="result-kicker">ABOVE & BEYOND <span id="result-best">PERSONAL BEST</span></div><div class="result-title"><div><h2>Made the skyline.</h2><p>The city is yours from here.</p></div><strong id="result-rank">A</strong></div><div class="result-numbers"><div><small>TIME</small><b id="result-time">—</b></div><div><small>FALLS</small><b id="result-falls">0</b></div><div><small>COLLECTED</small><b id="result-coins">0</b></div></div><div class="result-unlock"><b>↗ FREE SEDAN UNLOCKED</b><span>In your garage and on the street below. Follow the light.</span><span><kbd>L</kbd> Harder night route unlocked <i>·</i> <kbd>G</kbd> Best-run ghost</span></div><div class="result-actions"><button id="result-drive">Find your car ↗</button><button id="result-retry">Run it back <kbd>R</kbd></button><button id="result-new">New skyline <kbd>N</kbd></button></div></section>`;
    host.append(run); this.map = host.querySelector('#run-map')!;
    host.querySelector('#result-drive')!.addEventListener('click', () => window.dispatchEvent(new CustomEvent('crosstown-find-car', { detail: 'reward' })));
    host.querySelector('#result-retry')!.addEventListener('click', callbacks.reset);
    host.querySelector('#result-new')!.addEventListener('click', () => window.dispatchEvent(new CustomEvent('parkour-new-seed')));
  }
  private el(id: string): HTMLElement { let e = this.refs.get(id); if (!e) { e = this.root.querySelector<HTMLElement>(`#${id}`)!; this.refs.set(id, e); } return e; }
  private text(id: string, value: string): void { const e = this.el(id); if (e.textContent !== value) e.textContent = value; }
  setBackend(backend: string): void { this.settingsHUD.setBackend(backend); this.text('run-backend', backend); }
  setPause(paused: boolean): void { this.settingsHUD.setPause(paused); document.body.classList.toggle('run-paused', paused); }
  notify(text: string): void { this.settingsHUD.notify(text); }
  controls(show: boolean): void { this.root.classList.toggle('controls-expanded', show); }
  update(run: ParkourRun, quality: QualityScaler, camera: Camera, width: number, height: number, saveAvailable: boolean, paused: boolean, draws: number): void {
    this.settingsHUD.update(quality, { settled: run.player.grounded, currentPosition: run.player.position }, true, saveAvailable, paused);
    this.text('run-seed', run.seed.toString().padStart(6, '0')); this.text('run-day', run.night ? 'NIGHT RUN' : 'DAY RUN');
    this.text('run-length', `${(run.route.distance / 1000).toFixed(1)} KM ${run.training ? 'MOVEMENT ROUTE' : 'ROOFTOP CIRCUIT'}`);
    this.text('run-timer', formatTime(run.remaining)); this.el('run-timer').classList.toggle('low-time', run.remaining < 60);
    this.text('run-elapsed', `${formatTime(run.elapsed + run.penalty)} elapsed${run.penalty ? ` · +${run.penalty}s` : ''}`);
    this.text('run-cp', (run.checkpoint + 1).toString().padStart(2, '0')); this.text('run-cp-total', `/ ${run.route.checkpoints.length}`);
    this.text('run-cp-name', run.route.checkpoints[run.checkpoint]!.name); this.text('map-coordinate', run.night ? 'BLUE HOUR' : run.route.checkpoints[run.checkpoint]!.name.toUpperCase());
    this.el('cp-ring').style.strokeDashoffset = String(170 * (1 - (run.checkpoint + 1) / run.route.checkpoints.length));
    this.text('run-cash', String(run.cash)); this.text('run-fps', `${quality.fps || '—'} FPS`); this.text('run-quality', `${quality.mode === 'auto' ? 'AUTO · ' : ''}${quality.current.name.toUpperCase()}`); this.text('run-stats', `${draws} DRAWS · ${run.player.motion.toUpperCase()}`);
    this.root.querySelector('#settings-worker')!.textContent = `${run.stage.active.size} nearby physics bodies / worker route ready`;
    for (const [id, seconds] of Object.entries(run.powers)) { this.el(`power-${id}`).hidden = seconds <= 0; this.el(`power-bar-${id}`).style.width = `${seconds * 10}%`; this.text(`power-seconds-${id}`, `${Math.ceil(seconds)}s`); }
    for (const [id, action] of [['jump', 'impulse'], ['sprint', 'sprint'], ['slide', 'slide'], ['interact', 'interact'], ['reset', 'reset']] as const) this.text(`hint-${id}`, keyLabel(this.settings.bindings[action][0]!));
    const interaction = run.player.nearestInteraction(); this.el('run-traverse').hidden = !interaction; if (interaction) this.el('run-traverse').lastElementChild!.textContent = interaction.label;
    this.text('ghost-hint', run.ghost.length ? `G GHOST ${run.ghostEnabled ? 'ON' : 'OFF'}` : run.store.data.night ? 'L NIGHT ROUTE' : 'FOLLOW THE LIME LINE');
    const cp = run.route.checkpoints[run.checkpoint + 1], target = cp?.position ?? run.route.goal;
    this.point.set(target.x, target.y + 2.7, target.z).project(camera);
    const marker = this.el('cp-callout'); const visible = this.point.z > -1 && this.point.z < 1 && run.state === 'running'; marker.hidden = !visible;
    if (visible) { const x = Math.max(40, Math.min(width - 90, (this.point.x * 0.5 + 0.5) * width)), y = Math.max(width < 540 ? 178 : 230, Math.min(height - 180, (-this.point.y * 0.5 + 0.5) * height)); marker.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`; this.text('cp-distance', `${Math.round(run.player.distanceTo(target))} m`); this.text('cp-label', cp ? 'NEXT CHECKPOINT' : 'THE FINISH'); }
    this.el('run-result').hidden = run.state !== 'finished' || run.finishTime < 3.2;
    if (run.result) { this.text('result-rank', run.result.rank); this.text('result-time', formatTime(run.result.seconds)); this.text('result-falls', String(run.falls)); this.text('result-coins', String(run.collectibles)); this.text('result-best', run.bestImproved ? 'PERSONAL BEST' : 'RUN COMPLETE'); }
    this.drawMap(run);
  }
  private drawMap(run: ParkourRun): void {
    const c = this.map.getContext('2d')!, size = 300, roofs = run.route.roofs;
    const minX = Math.min(...roofs.map(r => r.center.x)) - 37, maxX = Math.max(...roofs.map(r => r.center.x)) + 37, minZ = Math.min(...roofs.map(r => r.center.z)) - 37, maxZ = Math.max(...roofs.map(r => r.center.z)) + 37;
    const scale = 258 / Math.max(maxX - minX, maxZ - minZ), x = (v: number) => 21 + (v - minX) * scale, y = (v: number) => 21 + (v - minZ) * scale;
    c.clearRect(0, 0, size, size); c.fillStyle = '#b9c7b81c';
    for (const r of roofs) c.fillRect(x(r.center.x - r.width / 2), y(r.center.z - r.depth / 2), r.width * scale - 0.8, r.depth * scale - 0.8);
    c.strokeStyle = '#dff29c52'; c.lineWidth = 1.7; c.beginPath(); roofs.forEach((r, i) => { if (i) c.lineTo(x(r.center.x), y(r.center.z)); else c.moveTo(x(r.center.x), y(r.center.z)); }); c.stroke();
    const cp = run.route.checkpoints[run.checkpoint + 1]; if (cp) { c.fillStyle = '#dfff9a'; c.beginPath(); c.arc(x(cp.position.x), y(cp.position.z), 4.5, 0, Math.PI * 2); c.fill(); }
    const p = run.player.position; c.save(); c.translate(x(p.x), y(p.z)); c.rotate(-run.player.yaw); c.fillStyle = '#fff3db'; c.beginPath(); c.moveTo(0, 7); c.lineTo(-5, -5); c.lineTo(5, -5); c.closePath(); c.fill(); c.restore();
  }
}
