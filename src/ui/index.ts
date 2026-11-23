// A non-blocking foundation HUD and an Escape-only pause/settings surface; no title or start screen.
import { ACTIONS, keyLabel, type Action } from '../config/actions';
import { APP } from '../config/app';
import { QUALITY_TIERS, type QualityMode } from '../config/quality';
import type { InputManager } from '../core/input';
import type { QualityScaler } from '../core/quality';
// Telemetry accepts a minimal motor snapshot so the original sandbox and the parkour player share settings.
import type { Settings } from '../save';
import type { Camera, Vector3 } from 'three/webgpu';

const icons = {
  logo: '<svg viewBox="0 0 36 36" fill="none"><path d="M6 28 28 6M7 7h21v21" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 19v9h9M17 7H7v10" stroke="currentColor" stroke-width="1.4" opacity=".45"/></svg>',
  pause: '<svg viewBox="0 0 20 20"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  expand: '<svg viewBox="0 0 20 20" fill="none"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset: '<svg viewBox="0 0 20 20" fill="none"><path d="M4 8a6 6 0 1 1 .4 5M4 3v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" fill="none"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none"><path d="M7.5 7h9c2 0 2.7 1.4 3.2 3.1l1 5c.7 3-1.4 4.3-3.5 2l-1.8-1.8H8.6L6.8 17c-2.1 2.3-4.2 1-3.5-2l1-5C4.8 8.4 5.5 7 7.5 7Z" stroke="currentColor" stroke-width="1.4"/><path d="M8 10v4m-2-2h4m6-1h.01m2 2h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  mouse: '<svg viewBox="0 0 20 20" fill="none"><rect x="5" y="2" width="10" height="16" rx="5" stroke="currentColor" stroke-width="1.4"/><path d="M10 5v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
};
export interface HUDCallbacks {
  pause(): void; reset(): void; impulse(): void; camera(): void;
  settingsChanged(): void; quality(mode: QualityMode): void; resetSave(): void;
}
export class HUD {
  private root: HTMLElement;
  private dialog: HTMLElement;
  private refs = new Map<string, HTMLElement>();
  private projectPoint?: Vector3;
  constructor(
    host: HTMLElement,
    private input: InputManager,
    private settings: Settings,
    callbacks: HUDCallbacks,
  ) {
    host.innerHTML = `
      <div class="hud" id="hud">
        <header class="topbar">
          <button class="brand" id="brand-camera" aria-label="Crosstown — reset camera">${icons.logo}<span>crosstown<span class="brand-period">.</span></span></button>
          <span class="header-divider"></span><span class="build-label">WORLD ENGINE <span>/</span> 01</span>
          <div class="header-end"><span class="live-state"><i></i> LIVE SANDBOX</span><button class="icon-button" id="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen">${icons.expand}</button><button class="pause-button" id="pause-open" aria-label="Pause and open settings">${icons.pause}<span>Pause</span><kbd>Esc</kbd></button></div>
        </header>
        <section class="scene-heading" aria-label="Scene information"><div class="eyebrow"><span class="step-number">01</span> THE FOUNDATION</div><h1>Room to build.</h1><p>A little light. A little physics. Endless possibility.</p><div class="scene-meta"><span class="tiny-cross">+</span> TEST ENVIRONMENT <span class="meta-dot">·</span> 1 M GRID</div></section>
        <aside class="performance glass diagnostics" aria-label="Live performance">
          <div class="panel-heading"><span>PERFORMANCE</span><span class="signal-bars"><i></i><i></i><i></i><i></i></span></div>
          <div class="fps-row"><strong id="fps">—</strong><span>FPS<br><em>REAL TIME</em></span><span class="target-tag">60 TARGET</span></div>
          <div class="chart"><svg viewBox="0 0 220 51" preserveAspectRatio="none" aria-label="Frame-time history"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#39836c" stop-opacity=".17"/><stop offset="100%" stop-color="#39836c" stop-opacity="0"/></linearGradient></defs><path d="M0 30H220" class="chart-target"/><path id="chart-area" fill="url(#chart-fill)"/><path id="chart-line" fill="none" stroke="#438b73" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><span>FRAME TIME</span><b id="frame-ms">— ms</b></div>
          <dl class="telemetry"><div><dt>Renderer</dt><dd><span class="backend-badge" id="backend">Initializing</span></dd></div><div><dt>Physics</dt><dd>Rapier <span class="muted">/ 60 Hz</span></dd></div><div><dt>Gravity</dt><dd>9.81 <span class="muted">m/s²</span></dd></div></dl>
          <div class="panel-footer"><span class="status-dot"></span><span id="simulation-status">Simulation running</span><span class="footer-code">SI UNITS</span></div>
        </aside>
        <div id="render-marker" class="world-marker diagnostics"><div class="marker-line"></div><div class="marker-content"><span class="marker-id mint">01</span><div><strong>Render specimen</strong><span>CONTINUOUS ROTATION</span></div></div></div>
        <div id="body-marker" class="world-marker diagnostics"><div class="marker-line"></div><div class="marker-content"><span class="marker-id apricot">02</span><div><strong>Rigid body</strong><span id="body-state">DYNAMIC · FALLING</span></div></div></div>
        <aside class="input-panel glass diagnostics" aria-label="Input diagnostics"><div class="panel-heading"><span>INPUT MONITOR</span><span class="input-live">LISTENING <i></i></span></div><div class="input-row"><div class="key-cluster"><kbd data-action="forward">W</kbd><div><kbd data-action="left">A</kbd><kbd data-action="backward">S</kbd><kbd data-action="right">D</kbd></div></div><div class="input-values"><span>X <b id="axis-x">+0.00</b></span><span>Y <b id="axis-y">+0.00</b></span></div><span class="input-mouse">${icons.mouse}</span></div><div class="debug-line" id="input-debug" role="status">Ready. Press a key to test.</div><div class="controller-line">${icons.gamepad}<div><strong id="controller-name">Keyboard & mouse</strong><span id="controller-status">Gamepad & wheel ready to connect</span></div><span class="connection-dot" id="controller-dot"></span></div></aside>
        <aside class="environment-status diagnostics"><div><span class="status-dot" id="worker-dot"></span><span id="worker-state">Worker initializing</span></div><div><span class="status-dot" id="save-dot"></span><span id="save-state">Local save ready</span></div></aside>
        <div class="quality-quick diagnostics"><span>RENDER QUALITY</span><button id="quality-cycle" title="Cycle quality: Auto, Low, Balanced, High, Ultra"><i></i><b id="quality-label">Auto · High</b><span class="quality-chevron">⌃⌄</span></button></div>
        <nav class="scene-tools" aria-label="Test scene actions"><button class="drop-button" id="reset-body">${icons.reset}<span>Drop again</span><kbd data-hint="reset">R</kbd></button><button class="impulse-button" id="apply-impulse"><span class="impulse-icon">↑</span><span>Apply impulse</span><kbd data-hint="impulse">Space</kbd></button><span class="tool-divider"></span><button class="camera-button" id="reset-camera" title="Reset camera">${icons.reset}<span>Reset view</span><kbd data-hint="camera">C</kbd></button></nav>
        <footer class="bottom-bar"><span class="build-info"><span class="tiny-square"></span> FOUNDATION BUILD <b>${APP.build}</b></span><div class="control-hints"><span>${icons.mouse} Drag to orbit</span><i>·</i><span>Scroll to zoom</span><i>·</i><span><kbd data-hint="diagnostics">H</kbd> Hide HUD</span></div><a class="credits-link" href="/CREDITS.md" target="_blank" rel="noopener">Made with open source ${icons.arrow}</a></footer>
      </div>
      <div class="pause-overlay" id="pause-overlay" hidden><section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><header class="settings-header"><div><div class="eyebrow"><i class="status-dot amber"></i> SIMULATION PAUSED</div><h2 id="pause-title">Take a breather.</h2><p>Your foundation. Your settings.</p></div><button id="resume" class="resume-button">Back to the scene <span>↗</span><kbd>Esc</kbd></button></header><div class="settings-scroll"><div class="settings-column">
        <section class="settings-section"><h3>Display <span>01</span></h3><label class="field-label">Render quality</label><div class="quality-options" id="quality-options">${['Auto', ...QUALITY_TIERS.map(tier => tier.name)].map((name, i) => `<button data-quality="${i === 0 ? 'auto' : i - 1}">${name}</button>`).join('')}</div><p class="setting-note" id="quality-note">Automatic quality adapts to measured frame time.</p><label class="switch-row"><span>Reduced motion<small>Stop the specimen rotation; use immediate camera motion.</small></span><input type="checkbox" id="reduced-motion" role="switch"></label><label class="switch-row"><span>Show diagnostics<small>Performance, object labels and input monitor.</small></span><input type="checkbox" id="diagnostics-toggle" role="switch"></label><a id="backend-test" class="text-link" href="?webgl">Test the WebGL 2 fallback ↗</a></section>
        <section class="settings-section"><h3>Keyboard <span>02</span></h3><p class="setting-note">Select a binding, then press a new key. Escape cancels.</p><div class="bindings" id="bindings">${(Object.keys(ACTIONS) as Action[]).map(action => `<div class="binding-row"><span>${ACTIONS[action].label}</span><button data-bind="${action}" ${action === 'pause' ? 'disabled title="Escape is always available"' : ''}>${keyLabel(this.settings.bindings[action][0]!)}</button></div>`).join('')}</div></section>
      </div><div class="settings-column"><section class="settings-section"><h3>Controller & wheel <span>03</span></h3><div class="device-info">${icons.gamepad}<div><strong id="settings-device">No controller connected</strong><span>Gamepad API · analog input · optional rumble</span></div></div><label class="switch-row"><span>Use racing-wheel mapping<small>Enable for wheels the browser reports as a gamepad.</small></span><input type="checkbox" id="force-wheel" role="switch"></label><div class="wheel-axes">${(['steerAxis', 'throttleAxis', 'brakeAxis'] as const).map((axis, i) => `<label>${['Steering', 'Throttle', 'Brake'][i]} axis<select data-wheel-axis="${axis}" aria-label="${['Steering', 'Throttle', 'Brake'][i]} axis">${Array.from({ length: 16 }, (_, n) => `<option value="${n}" ${this.settings.wheel[axis] === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`).join('')}</div><div class="pedal-row"><label>Pedal range<select id="pedal-mode"><option value="signed">+1 rest → −1 pressed</option><option value="positive">0 rest → +1 pressed</option></select></label><label class="invert-label"><input type="checkbox" id="invert-steer"> Invert steering</label></div><p class="setting-note">900° steering lock. Standard controllers use left stick to pan, right stick to orbit, A to impulse and Y to drop.</p><div class="raw-axes" id="raw-axes">RAW AXES · No signal</div></section>
        <section class="settings-section foundation-info"><h3>Under the hood <span>04</span></h3><dl><div><dt>Renderer</dt><dd id="settings-renderer">—</dd></div><div><dt>Simulation</dt><dd>Fixed 60 Hz + interpolation</dd></div><div><dt>World worker</dt><dd id="settings-worker">—</dd></div><div><dt>Foundation</dt><dd>Vite · TypeScript · Three.js r180</dd></div></dl><p>This is Step 01: an empty, working engine foundation. The city, characters, cars, audio and gameplay come in later steps.</p><button class="reset-save" id="reset-save">Reset saved settings ${icons.arrow}</button><span class="reset-save-note">Requires confirmation. This only clears this project.</span></section>
      </div></div><footer class="settings-footer"><span>CROSSTOWN ENGINE / FOUNDATION ${APP.version}</span><a href="/CREDITS.md" target="_blank" rel="noopener">Asset credits & licences ↗</a></footer></section></div>
      <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>`;
    this.root = host.querySelector('#hud')!;
    this.dialog = host.querySelector('#pause-overlay')!;
    host.querySelectorAll<HTMLElement>('[id]').forEach(element => this.refs.set(element.id, element));
    this.el('brand-camera').onclick = callbacks.camera;
    this.el('pause-open').onclick = callbacks.pause;
    this.el('resume').onclick = callbacks.pause;
    this.el('reset-body').onclick = callbacks.reset;
    this.el('apply-impulse').onclick = callbacks.impulse;
    this.el('reset-camera').onclick = callbacks.camera;
    this.el('fullscreen').onclick = () => {
      const promise = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
      promise?.catch(() => this.notify('Fullscreen is unavailable in this preview.'));
      if (!promise) this.notify('Fullscreen is unavailable in this browser.');
    };
    this.el('quality-cycle').onclick = () => {
      const modes: QualityMode[] = ['auto', 0, 1, 2, 3];
      callbacks.quality(modes[(modes.indexOf(settings.quality) + 1) % modes.length]!);
      this.refreshSettings();
    };
    this.el('quality-options').querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.onclick = () => { callbacks.quality(button.dataset.quality === 'auto' ? 'auto' : Number(button.dataset.quality) as QualityMode); this.refreshSettings(); };
    });
    this.el('bindings').querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button => {
      button.onclick = () => {
        const action = button.dataset.bind as Action;
        this.input.rebind(action, () => { this.refreshSettings(); callbacks.settingsChanged(); this.updateBindingHints(); });
        this.refreshSettings();
      };
    });
    for (const [id, property] of [['reduced-motion', 'reducedMotion'], ['diagnostics-toggle', 'diagnostics']] as const) {
      (this.el(id) as HTMLInputElement).onchange = event => { settings[property] = (event.target as HTMLInputElement).checked; callbacks.settingsChanged(); this.setDiagnostics(settings.diagnostics); };
    }
    for (const [id, property] of [['force-wheel', 'forceWheel'], ['invert-steer', 'invertSteer']] as const) {
      (this.el(id) as HTMLInputElement).onchange = event => { settings.wheel[property] = (event.target as HTMLInputElement).checked; callbacks.settingsChanged(); };
    }
    this.dialog.querySelectorAll<HTMLSelectElement>('[data-wheel-axis]').forEach(select => {
      select.onchange = () => { settings.wheel[select.dataset.wheelAxis as 'steerAxis' | 'throttleAxis' | 'brakeAxis'] = Number(select.value); callbacks.settingsChanged(); };
    });
    (this.el('pedal-mode') as HTMLSelectElement).onchange = event => { settings.wheel.pedalMode = (event.target as HTMLSelectElement).value as 'signed' | 'positive'; callbacks.settingsChanged(); };
    this.el('reset-save').onclick = callbacks.resetSave;
    this.dialog.addEventListener('click', event => { if (event.target === this.dialog) callbacks.pause(); });
    this.dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(this.dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a, input, select'));
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    if (new URLSearchParams(location.search).has('webgl')) {
      const link = this.el('backend-test') as HTMLAnchorElement;
      const url = new URL(location.href); url.searchParams.delete('webgl');
      link.href = url.pathname + url.search;
      link.textContent = 'Return to automatic WebGPU selection ↗';
    }
    this.refreshSettings();
    this.setDiagnostics(settings.diagnostics);
  }
  private el(id: string): HTMLElement { return this.refs.get(id)!; }
  private text(id: string, value: string): void { const el = this.el(id); if (el.textContent !== value) el.textContent = value; }
  private refreshSettings(): void {
    this.el('quality-options').querySelectorAll<HTMLElement>('button').forEach(button => button.classList.toggle('active', button.dataset.quality === String(this.settings.quality)));
    (this.el('reduced-motion') as HTMLInputElement).checked = this.settings.reducedMotion;
    (this.el('diagnostics-toggle') as HTMLInputElement).checked = this.settings.diagnostics;
    (this.el('force-wheel') as HTMLInputElement).checked = this.settings.wheel.forceWheel;
    (this.el('invert-steer') as HTMLInputElement).checked = this.settings.wheel.invertSteer;
    (this.el('pedal-mode') as HTMLSelectElement).value = this.settings.wheel.pedalMode;
    this.el('bindings').querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button => {
      const action = button.dataset.bind as Action;
      button.textContent = this.input.waitingAction === action ? 'Press a key…' : keyLabel(this.settings.bindings[action][0]!);
      button.classList.toggle('waiting', this.input.waitingAction === action);
    });
  }
  private updateBindingHints(): void {
    this.root.querySelectorAll<HTMLElement>('[data-hint]').forEach(el => el.textContent = keyLabel(this.settings.bindings[el.dataset.hint as Action][0]!));
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach(el => el.textContent = keyLabel(this.settings.bindings[el.dataset.action as Action][0]!));
  }
  setBackend(backend: string): void { this.text('backend', backend); this.text('settings-renderer', `${backend} / TSL materials`); this.updateBindingHints(); }
  setPause(paused: boolean): void {
    this.dialog.hidden = !paused;
    this.text('simulation-status', paused ? 'Simulation paused' : 'Simulation running');
    this.root.classList.toggle('is-paused', paused);
    if (paused) { this.refreshSettings(); this.el('resume').focus(); }
    else { this.input.cancelRebind(); this.input.clear(); this.input.canvas.focus({ preventScroll: true }); }
  }
  setDiagnostics(visible: boolean): void { this.root.classList.toggle('hide-diagnostics', !visible); }
  update(quality: QualityScaler, physics: { settled: boolean; currentPosition: { y: number } }, workerReady: boolean, saveReady: boolean, paused: boolean): void {
    this.text('fps', quality.fps ? String(quality.fps) : '—');
    this.text('frame-ms', `${quality.frameMs.toFixed(1)} ms`);
    const label = `${quality.mode === 'auto' ? 'Auto · ' : ''}${quality.current.name}`;
    this.text('quality-label', label);
    this.text('quality-note', quality.mode === 'auto' ? `Automatic · currently ${quality.current.name}. Adapts resolution and shadows with hysteresis.` : `${quality.current.name} · ${Math.round(quality.current.resolutionScale * 100)}% scale · ${quality.current.shadows ? quality.current.shadowMapSize + ' px shadows' : 'shadows off'}.`);
    const points = quality.history.map((ms, i) => `${(i / (quality.history.length - 1) * 220).toFixed(1)},${(45 - Math.min(ms, 45) / 45 * 38).toFixed(1)}`);
    this.el('chart-line').setAttribute('d', `M${points.join(' L')}`);
    this.el('chart-area').setAttribute('d', `M0,51 L${points.join(' L')} L220,51 Z`);
    this.text('body-state', paused ? 'DYNAMIC · PAUSED' : physics.settled ? 'DYNAMIC · AT REST' : `DYNAMIC · ${physics.currentPosition.y.toFixed(2)} M`);
    this.text('input-debug', this.input.lastEvent);
    const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
    this.text('axis-x', signed(this.input.frame.moveX)); this.text('axis-y', signed(this.input.frame.moveY));
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach(el => el.classList.toggle('pressed', this.settings.bindings[el.dataset.action as Action].some(key => this.input.keys.has(key))));
    const connected = this.input.deviceKind !== 'none';
    this.text('controller-name', connected ? this.input.deviceKind === 'wheel' ? 'Racing wheel connected' : 'Gamepad connected' : 'Keyboard & mouse');
    this.text('controller-status', connected ? this.input.deviceName : 'Gamepad & wheel ready to connect');
    this.el('controller-dot').classList.toggle('connected', connected);
    this.text('settings-device', this.input.deviceName);
    this.text('raw-axes', this.input.axes.length ? `AXES ${this.input.axes.map((v, i) => `${i}:${signed(v)}`).join('  ')}${this.input.deviceKind === 'wheel' ? ` | STEER ${(this.input.frame.steering * 450).toFixed(0)}°` : ''}` : 'RAW AXES · No signal');
    this.text('worker-state', workerReady ? 'World worker ready' : 'Worker unavailable');
    this.el('worker-dot').classList.toggle('warning', !workerReady);
    this.text('settings-worker', workerReady ? 'Ready / no chunks requested' : 'Unavailable');
    this.text('save-state', saveReady ? 'Settings saved locally' : 'Session-only settings');
    this.el('save-dot').classList.toggle('warning', !saveReady);
  }
  markers(renderPosition: Vector3, bodyPosition: Vector3, camera: Camera, width: number, height: number): void {
    this.projectPoint ??= renderPosition.clone();
    for (const [id, position] of [['render-marker', renderPosition], ['body-marker', bodyPosition]] as const) {
      const point = this.projectPoint.copy(position).project(camera);
      const element = this.el(id);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      element.style.visibility = point.z < 1 && point.z > -1 && x > 100 && x < width - 100 && y > 102 && y < height - 150 ? 'visible' : 'hidden';
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  private toastTimer = 0;
  notify(message: string): void {
    this.text('toast', message); this.el('toast').hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.el('toast').hidden = true; }, 2500);
  }
}
