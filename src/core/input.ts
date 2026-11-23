// Unified keyboard, pointer, standard gamepad and non-standard Gamepad API racing-wheel input.
import { ACTIONS, type Action, type Bindings, type WheelMapping } from '../config/actions';

export function deadzone(value: number, zone = 0.15): number {
  if (!Number.isFinite(value) || Math.abs(value) <= zone) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - zone) / (1 - zone));
}
export function pedal(value: number, mode: WheelMapping['pedalMode']): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, mode === 'signed' ? (1 - value) / 2 : value));
}
export interface InputFrame {
  moveX: number; moveY: number; lookX: number; lookY: number; zoom: number;
  padLookX: number; padLookY: number; sprint: boolean;
  steering: number; throttle: number; brake: number; pointerSteer: number;
}
export class InputManager {
  readonly keys = new Set<string>();
  readonly pressedActions = new Set<Action>();
  frame: InputFrame = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, zoom: 0, padLookX: 0, padLookY: 0, sprint: false, steering: 0, throttle: 0, brake: 0, pointerSteer: 0 };
  lastEvent = 'Ready. Press a key or connect a controller.';
  deviceName = 'No controller connected';
  deviceKind: 'none' | 'gamepad' | 'wheel' = 'none';
  axes: readonly number[] = [];
  waitingAction: Action | null = null;
  private captureCallback?: (code: string | null) => void;
  private abort = new AbortController();
  private dragging = false;
  private pointerSteer = 0;
  private pointer = { x: 0, y: 0, wheel: 0 };
  private previousPointer = { x: 0, y: 0 };
  private previousButtons = new Set<number>();
  private activeButtons = new Set<number>();
  private pad: Gamepad | null = null;
  constructor(readonly canvas: HTMLCanvasElement, public bindings: Bindings, public wheel: WheelMapping) {
    const signal = this.abort.signal;
    window.addEventListener('keydown', this.onKeyDown, { signal });
    window.addEventListener('keyup', this.onKeyUp, { signal });
    window.addEventListener('blur', this.clear, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); }, { signal });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.button !== 2) return;
      this.dragging = true;
      this.previousPointer = { x: event.clientX, y: event.clientY };
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      this.lastEvent = `Pointer · ${event.pointerType} drag`;
    }, { signal });
    canvas.addEventListener('pointerup', () => { this.dragging = false; }, { signal });
    canvas.addEventListener('pointercancel', () => { this.dragging = false; }, { signal });
    canvas.addEventListener('lostpointercapture', () => { this.dragging = false; }, { signal });
    canvas.addEventListener('pointermove', event => {
      const bounds = canvas.getBoundingClientRect(); this.pointerSteer = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / Math.max(1, bounds.width) - .5) * 2.2));
      if (!this.dragging) return;
      this.pointer.x += event.clientX - this.previousPointer.x;
      this.pointer.y += event.clientY - this.previousPointer.y;
      this.previousPointer = { x: event.clientX, y: event.clientY };
    }, { signal });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.pointer.wheel += Math.sign(event.deltaY);
      this.lastEvent = `Pointer · zoom ${event.deltaY > 0 ? 'out' : 'in'}`;
    }, { passive: false, signal });
    window.addEventListener('gamepadconnected', () => { this.lastEvent = 'Gamepad API · controller connected'; }, { signal });
    window.addEventListener('gamepaddisconnected', () => { this.previousButtons.clear(); this.lastEvent = 'Gamepad API · controller disconnected'; }, { signal });
  }
  private isEditing(event: KeyboardEvent): boolean {
    return event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName));
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.waitingAction) {
      event.preventDefault();
      if (event.repeat) return;
      const action = this.waitingAction;
      if (event.code === 'Escape') { this.cancelRebind(); return; }
      const conflict = (Object.keys(this.bindings) as Action[]).find(id => id !== action && this.bindings[id].includes(event.code));
      if (conflict) { this.lastEvent = `Already assigned to ${ACTIONS[conflict].label}`; return; }
      this.bindings[action] = [event.code];
      this.waitingAction = null;
      this.captureCallback?.(event.code);
      this.captureCallback = undefined;
      this.lastEvent = `Rebound ${ACTIONS[action].label} · ${event.code}`;
      return;
    }
    if ((this.isEditing(event) && event.code !== 'Escape') || event.metaKey || (event.ctrlKey && event.code !== 'ControlLeft') || event.altKey) return;
    const actions = (Object.keys(this.bindings) as Action[]).filter(action => this.bindings[action].includes(event.code));
    if (actions.length) event.preventDefault();
    if (!event.repeat) actions.forEach(action => this.pressedActions.add(action));
    this.keys.add(event.code);
    this.lastEvent = `Keyboard · ${event.code} ${event.repeat ? 'held' : 'down'}`;
  };
  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    if (!this.waitingAction && !this.isEditing(event)) this.lastEvent = `Keyboard · ${event.code} up`;
  };
  clear = (): void => { this.keys.clear(); this.pressedActions.clear(); this.dragging = false; this.pointer = { x: 0, y: 0, wheel: 0 }; };
  private held(action: Action): boolean {
    return this.bindings[action].some(key => this.keys.has(key)) || ACTIONS[action].buttons.some(button => this.activeButtons.has(button));
  }
  poll(): InputFrame {
    let pads: (Gamepad | null)[] = [];
    try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* Permissions policy can disable Gamepad API. */ }
    this.pad = pads.find(pad => pad?.connected) ?? null;
    this.activeButtons.clear();
    this.deviceKind = 'none';
    this.deviceName = 'No controller connected';
    this.axes = [];
    let sx = 0, sy = 0, lx = 0, ly = 0, steering = 0, throttle = 0, brake = 0;
    if (this.pad) {
      const pad = this.pad;
      const isWheel = this.wheel.forceWheel || /wheel|g29|g920|g923|t150|t300|thrustmaster|fanatec|driving force/i.test(pad.id) || pad.mapping !== 'standard';
      this.deviceKind = isWheel ? 'wheel' : 'gamepad';
      this.deviceName = pad.id;
      this.axes = [...pad.axes];
      pad.buttons.forEach((button, index) => { if (button.pressed) this.activeButtons.add(index); });
      for (const action of Object.keys(ACTIONS) as Action[]) {
        if (ACTIONS[action].buttons.some(index => this.activeButtons.has(index) && !this.previousButtons.has(index))) this.pressedActions.add(action);
      }
      if (isWheel) {
        steering = deadzone(pad.axes[this.wheel.steerAxis] ?? 0, this.wheel.deadzone) * (this.wheel.invertSteer ? -1 : 1);
        throttle = pad.axes[this.wheel.throttleAxis] === undefined ? 0 : pedal(pad.axes[this.wheel.throttleAxis]!, this.wheel.pedalMode);
        brake = pad.axes[this.wheel.brakeAxis] === undefined ? 0 : pedal(pad.axes[this.wheel.brakeAxis]!, this.wheel.pedalMode);
        sx = steering; sy = brake - throttle;
      } else {
        sx = deadzone(pad.axes[0] ?? 0); sy = deadzone(pad.axes[1] ?? 0);
        lx = deadzone(pad.axes[2] ?? 0); ly = deadzone(pad.axes[3] ?? 0);
        throttle = pad.buttons[7]?.value ?? 0; brake = pad.buttons[6]?.value ?? 0; steering = sx;
      }
      if (Math.abs(sx) + Math.abs(sy) + Math.abs(lx) + Math.abs(ly) > 0.05 || this.activeButtons.size) this.lastEvent = `${isWheel ? 'Wheel' : 'Gamepad'} · axes ${pad.axes.map(v => v.toFixed(2)).join(' / ')}`;
    }
    this.previousButtons = new Set(this.activeButtons);
    this.frame = {
      moveX: Math.max(-1, Math.min(1, Number(this.held('right')) - Number(this.held('left')) + sx)),
      moveY: Math.max(-1, Math.min(1, Number(this.held('backward')) - Number(this.held('forward')) + sy)),
      lookX: this.pointer.x, lookY: this.pointer.y, zoom: this.pointer.wheel,
      padLookX: lx, padLookY: ly, sprint: this.held('sprint'), steering, throttle, brake, pointerSteer: this.pointerSteer,
    };
    this.pointer = { x: 0, y: 0, wheel: 0 };
    return this.frame;
  }
  pressed(action: Action): boolean { return this.pressedActions.has(action); }
  isHeld(action: Action): boolean { return this.held(action); }
  endFrame(): void { this.pressedActions.clear(); }
  rebind(action: Action, callback: (code: string | null) => void): void {
    this.cancelRebind();
    this.clear();
    this.waitingAction = action;
    this.captureCallback = callback;
  }
  cancelRebind(): void { this.waitingAction = null; this.captureCallback?.(null); this.captureCallback = undefined; }
  async rumble(strength = .15): Promise<void> {
    try { await this.pad?.vibrationActuator?.playEffect('dual-rumble', { duration: 90, strongMagnitude: Math.max(0, Math.min(1, strength)), weakMagnitude: Math.max(0, Math.min(.8, strength * .66)) }); } catch { /* Optional hardware capability. */ }
  }
  dispose(): void { this.abort.abort(); this.clear(); }
}
