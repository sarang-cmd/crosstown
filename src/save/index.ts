// Versioned browser saves. Even obtaining localStorage can throw in private or embedded contexts.
import { DEFAULT_BINDINGS, DEFAULT_WHEEL, type Bindings, type WheelMapping } from '../config/actions';
import { isQualityMode, type QualityMode } from '../config/quality';
import {EFFECT_LABELS,type EffectName} from '../rendering/effects-policy';

export interface Settings {
  quality: QualityMode;
  bindings: Bindings;
  wheel: WheelMapping;
  diagnostics: boolean;
  reducedMotion: boolean;
  disabledEffects: EffectName[];
}
export function defaultSettings(): Settings {
  return { quality: 'auto', bindings: structuredClone(DEFAULT_BINDINGS), wheel: { ...DEFAULT_WHEEL }, diagnostics: true, reducedMotion: false, disabledEffects: [] };
}
export class SaveStore {
  available = true;
  constructor(readonly key = 'crosstown:settings:v1') {}
  private get legacyKey(): string | undefined { return this.key === 'crosstown:settings:v1' ? 'coastline:foundation:v1' : this.key === 'crosstown:parkour:v1' ? 'coastline:parkour:v1' : undefined; }
  read<T>(fallback: T): T {
    try {
      const raw = globalThis.localStorage.getItem(this.key) ?? (this.legacyKey ? globalThis.localStorage.getItem(this.legacyKey) : null);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      if (value?.version !== 1 || value?.data === undefined) return fallback;
      return value.data as T;
    } catch { this.available = false; return fallback; }
  }
  write<T>(data: T): boolean {
    try {
      globalThis.localStorage.setItem(this.key, JSON.stringify({ version: 1, data }));
      this.available = true;
      return true;
    } catch { this.available = false; return false; }
  }
  clear(): boolean {
    try { globalThis.localStorage.removeItem(this.key); if(this.legacyKey) globalThis.localStorage.removeItem(this.legacyKey); this.available = true; return true; }
    catch { this.available = false; return false; }
  }
}
export function loadSettings(store: SaveStore): Settings {
  const defaults = defaultSettings();
  const raw = store.read<Partial<Settings> | null>(null);
  if (!raw || typeof raw !== 'object') return defaults;
  if (isQualityMode(raw.quality)) defaults.quality = raw.quality;
  if (typeof raw.diagnostics === 'boolean') defaults.diagnostics = raw.diagnostics;
  if (typeof raw.reducedMotion === 'boolean') defaults.reducedMotion = raw.reducedMotion;
  if(Array.isArray(raw.disabledEffects))defaults.disabledEffects=[...new Set(raw.disabledEffects.filter((v):v is EffectName=>typeof v==='string'&&Object.hasOwn(EFFECT_LABELS,v)))];
  if (raw.bindings && typeof raw.bindings === 'object') {
    for (const id of Object.keys(defaults.bindings) as (keyof Bindings)[]) {
      const keys = raw.bindings[id];
      // Escape stays available so a damaged binding never traps the user in the overlay.
      if (id !== 'pause' && Array.isArray(keys) && keys.length > 0 && keys.length < 5 && keys.every(k => typeof k === 'string' && /^[A-Za-z0-9]+$/.test(k))) defaults.bindings[id] = [...keys];
    }
  }
  if (raw.wheel && typeof raw.wheel === 'object') {
    for (const axis of ['steerAxis', 'throttleAxis', 'brakeAxis'] as const) {
      const value = raw.wheel[axis];
      if (Number.isInteger(value) && value >= 0 && value <= 15) defaults.wheel[axis] = value;
    }
    if (typeof raw.wheel.invertSteer === 'boolean') defaults.wheel.invertSteer = raw.wheel.invertSteer;
    if (typeof raw.wheel.forceWheel === 'boolean') defaults.wheel.forceWheel = raw.wheel.forceWheel;
    if (raw.wheel.pedalMode === 'positive') defaults.wheel.pedalMode = 'positive';
    if (typeof raw.wheel.deadzone === 'number' && Number.isFinite(raw.wheel.deadzone)) defaults.wheel.deadzone = Math.min(0.5, Math.max(0, raw.wheel.deadzone));
  }
  return defaults;
}
