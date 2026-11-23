import { SaveStore } from './index';
export type GhostFrame = [number, number, number, number, number, number];
export interface RunResult { seed: number; marker: string; night: boolean; seconds: number; falls: number; collectibles: number; cash: number; rank: 'C' | 'B' | 'A' | 'S'; date: string }
export interface BestRun { result: RunResult; ghost: GhostFrame[] }
export interface ParkourProgress { car: boolean; night: boolean; cash: number; best: Record<string, BestRun>; markerBest: Record<string, number> }
const initial = (): ParkourProgress => ({ car: false, night: false, cash: 0, best: {}, markerBest: {} });
export class ParkourStore {
  readonly storage: SaveStore;
  data: ParkourProgress;
  constructor(storage = new SaveStore('crosstown:parkour:v1')) {
    this.storage = storage; this.data = initial();
    const raw = storage.read<Partial<ParkourProgress> | null>(null);
    if (!raw || typeof raw !== 'object') return;
    this.data.car = raw.car === true; this.data.night = raw.night === true;
    this.data.cash = Number.isFinite(raw.cash) ? Math.max(0, Math.min(1e9, raw.cash!)) : 0;
    if (raw.best && typeof raw.best === 'object') for (const [key, record] of Object.entries(raw.best).slice(-100)) {
      const r = record?.result;
      if (!/^[a-z0-9-]+(?::(?:quick|standard|full))?:(day|night):\d+$/.test(key) || !r || !Number.isFinite(r.seconds) || r.seconds <= 0 || r.seconds > 7200 || !['C', 'B', 'A', 'S'].includes(r.rank)) continue;
      const ghost = Array.isArray(record.ghost) ? record.ghost.slice(0, 15000).filter(f => Array.isArray(f) && f.length === 6 && f.every(n => typeof n === 'number' && Number.isFinite(n))) : [];
      this.data.best[key] = { result: r, ghost };
    }
    if (raw.markerBest && typeof raw.markerBest === 'object') for (const [key, time] of Object.entries(raw.markerBest)) if (/^[a-z0-9-]+(?::(?:quick|standard|full))?:(day|night)$/.test(key) && typeof time === 'number' && Number.isFinite(time) && time > 0) this.data.markerBest[key] = time;
  }
  key(seed: number, marker = 'opening', night = false): string { return `${marker}:${night ? 'night' : 'day'}:${seed >>> 0}`; }
  best(seed: number, marker = 'opening', night = false): BestRun | undefined { return this.data.best[this.key(seed, marker, night)]; }
  finish(result: RunResult, ghost: GhostFrame[]): boolean {
    const key = this.key(result.seed, result.marker, result.night), prior = this.data.best[key];
    this.data.car = this.data.night = true; this.data.cash += result.cash;
    const best = !prior || result.seconds < prior.result.seconds;
    if (best) this.data.best[key] = { result, ghost: ghost.slice(0, 15000) };
    const marker = `${result.marker}:${result.night ? 'night' : 'day'}`;
    this.data.markerBest[marker] = Math.min(this.data.markerBest[marker] ?? Infinity, result.seconds);
    // Keep a hundred tiny time records; only the eight most recent improvements retain their large ghost track.
    const keys = Object.keys(this.data.best);
    for (const old of keys.slice(0, -8)) this.data.best[old]!.ghost = [];
    for (const old of keys.slice(0, -100)) delete this.data.best[old];
    if (!this.storage.write(this.data)) {
      // Quota may reject ghost data; time records and unlocks get a second, much smaller safe save.
      const compact = structuredClone(this.data); for (const run of Object.values(compact.best)) run.ghost = [];
      this.storage.write(compact);
    }
    return best;
  }
  clear(): void { this.storage.clear(); this.data = initial(); }
}
