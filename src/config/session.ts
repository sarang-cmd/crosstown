// Player preferences added by explicit request. The original full course remains an option.
import { SaveStore } from "../save";
export type RunLength = "quick" | "standard" | "full";
export const RUN_LENGTHS = {
  quick: { label: "Quick run", minutes: "2–3 min", roofs: 16, checkpoints: 8 },
  standard: {
    label: "A longer lap",
    minutes: "5–6 min",
    roofs: 32,
    checkpoints: 16,
  },
  full: {
    label: "The whole route",
    minutes: "10–12 min",
    roofs: 64,
    checkpoints: 28,
  },
} as const;
export interface SessionPreferences {
  length: RunLength;
  sensitivity: number;
  cameraSmoothing: number;
  invertX: boolean;
  configured: boolean;
}
export const isRunLength = (v: unknown): v is RunLength =>
  v === "quick" || v === "standard" || v === "full";
export class SessionStore {
  readonly storage = new SaveStore("crosstown:preferences:v1");
  value: SessionPreferences;
  constructor() {
    const raw = this.storage.read<Partial<SessionPreferences>>({});
    this.value = {
      length: isRunLength(raw?.length) ? raw.length : "quick",
      sensitivity: finite(raw?.sensitivity, 0.3, 2, 0.75),
      cameraSmoothing: finite(raw?.cameraSmoothing, 2, 14, 7),
      invertX: raw?.invertX === true,
      configured: raw?.configured === true,
    };
  }
  save(): void {
    this.storage.write(this.value);
  }
}
function finite(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(lo, Math.min(hi, v))
    : fallback;
}
