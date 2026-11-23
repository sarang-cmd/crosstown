// All default bindings and Gamepad API wheel calibration live in this single editable file.
export const ACTIONS = {
  forward: { label: 'Move forward', keys: ['KeyW', 'ArrowUp'], buttons: [12] },
  backward: { label: 'Move backward', keys: ['KeyS', 'ArrowDown'], buttons: [13] },
  left: { label: 'Move left', keys: ['KeyA', 'ArrowLeft'], buttons: [14] },
  right: { label: 'Move right', keys: ['KeyD', 'ArrowRight'], buttons: [15] },
  impulse: { label: 'Impulse / jump', keys: ['Space'], buttons: [0] },
  sprint: { label: 'Sprint / fast movement', keys: ['ShiftLeft', 'ShiftRight'], buttons: [4] },
  reset: { label: 'Reset run / drop body', keys: ['KeyR'], buttons: [3] },
  camera: { label: 'Recenter / cycle driving camera', keys: ['KeyC'], buttons: [10] },
  diagnostics: { label: 'Toggle diagnostics', keys: ['KeyH'], buttons: [8] },
  pause: { label: 'Pause / settings', keys: ['Escape'], buttons: [9] },
  slide: { label: 'Slide / crouch', keys: ['KeyX', 'ControlLeft'], buttons: [1] },
  interact: { label: 'Traverse / interact', keys: ['KeyE', 'KeyF'], buttons: [2] },
  newSeed: { label: 'New parkour seed', keys: ['KeyN'], buttons: [] },
  night: { label: 'Night route', keys: ['KeyL'], buttons: [] },
  ghost: { label: 'Toggle best-run ghost', keys: ['KeyG'], buttons: [] },
  fly: { label: 'Fly around city', keys: ['KeyV'], buttons: [] },
  street: { label: 'Walk at street level', keys: ['KeyB'], buttons: [] },
  map: { label: 'City map', keys: ['KeyM'], buttons: [] },
  session: { label: 'Run length / camera', keys: ['KeyP'], buttons: [] },
  engine: { label: 'Car ignition on / off', keys: ['KeyI'], buttons: [11] },
  transmission: { label: 'Auto / manual transmission', keys: ['KeyT'], buttons: [] },
  shiftUp: { label: 'Shift up (manual)', keys: ['Period'], buttons: [5] },
  shiftDown: { label: 'Shift down (manual)', keys: ['Comma'], buttons: [4] },
  clutch: { label: 'Clutch (manual)', keys: ['KeyQ'], buttons: [] },
  mouseSteer: { label: 'Toggle mouse steering', keys: ['KeyU'], buttons: [] },
  headlights: { label: 'Car headlights', keys: ['KeyK'], buttons: [] },
  indicator: { label: 'Car indicator', keys: ['KeyZ'], buttons: [] },
  horn: { label: 'Car horn', keys: ['KeyO'], buttons: [] },
  weaponWheel: { label: 'Hold weapon wheel', keys: ['Tab'], buttons: [] },
  fireWeapon: { label: 'Fire selected weapon (also left click)', keys: ['KeyJ'], buttons: [] },
  holster: { label: 'Holster weapon', keys: ['Backquote'], buttons: [] },
  radio: { label: 'In-car radio wheel', keys: ['KeyY'], buttons: [] },
  policeStars: { label: 'Debug: cycle wanted stars', keys: ['F8'], buttons: [] },
  policeCones: { label: 'Debug: police sight cones', keys: ['F9'], buttons: [] },
  abandon: { label: 'Abandon driving activity', keys: ['Backspace'], buttons: [] },
} as const;
export type Action = keyof typeof ACTIONS;
export type Bindings = Record<Action, string[]>;
export const DEFAULT_BINDINGS: Bindings = Object.fromEntries(
  Object.entries(ACTIONS).map(([id, binding]) => [id, [...binding.keys]]),
) as Bindings;
export interface WheelMapping {
  forceWheel: boolean;
  steerAxis: number;
  throttleAxis: number;
  brakeAxis: number;
  invertSteer: boolean;
  pedalMode: 'signed' | 'positive';
  deadzone: number;
  steeringDegrees: number;
}
export const DEFAULT_WHEEL: WheelMapping = {
  forceWheel: false, steerAxis: 0, throttleAxis: 2, brakeAxis: 5,
  invertSteer: false, pedalMode: 'signed', deadzone: 0.04, steeringDegrees: 900,
};
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return ({ Period: '.', Comma: ',', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' } as Record<string, string>)[code] ?? code;
}
