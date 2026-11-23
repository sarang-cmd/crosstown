import {
  RUN_LENGTHS,
  type RunLength,
  type SessionStore,
} from "../config/session";
import type { Settings } from "../save";
export class SessionSetup {
  readonly root: HTMLElement;
  private done?: (changed: boolean) => void;
  private initialLength: RunLength;
  constructor(
    readonly store: SessionStore,
    readonly settings: Settings,
    readonly changed: () => void,
  ) {
    this.initialLength = store.value.length;
    this.root = document.createElement("div");
    this.root.className = "session-setup";
    this.root.hidden = true;
    this.root.innerHTML = `<section class="session-card" role="dialog" aria-modal="true" aria-labelledby="session-title"><div class="setup-kicker"><span class="setup-mark">↗</span> CROSSTOWN <span>YOUR CITY. YOUR PACE.</span></div><div class="setup-intro"><div><p class="setup-eyebrow">BEFORE YOU TAKE THE ROOFS</p><h1 id="session-title">A little run.<br>Or the long way home.</h1><p>Same city. Same runner. Choose how much skyline you have time for.</p></div><span class="setup-number">01—05</span></div><fieldset class="length-field"><legend>HOW FAR ARE WE GOING?</legend><div class="length-choices">${(Object.entries(RUN_LENGTHS) as [RunLength, (typeof RUN_LENGTHS)[RunLength]][]).map(([id, r], i) => `<label class="length-choice"><input type="radio" name="run-length" value="${id}"><span class="length-index">0${i + 1}<i>↗</i></span><b>${r.label}</b><strong>${r.minutes}</strong><small>${r.checkpoints} checkpoints · ${r.roofs} rooftops</small></label>`).join("")}</div></fieldset><div class="setup-preferences"><label>Move with<select id="setup-layout"><option value="wasd">WASD + mouse</option><option value="arrows">Arrow keys + mouse</option></select><small>A / ← moves left. D / → moves right.</small></label><label>Look sensitivity<input id="setup-sensitivity" aria-label="Look sensitivity" type="range" min="0.3" max="2" step="0.05"><small>Gentle follow · no automatic camera spinning</small></label><label>Camera feel<select id="setup-smoothing"><option value="5">Soft</option><option value="7">Balanced</option><option value="12">Responsive</option></select><small>All controls can be rebound in Escape settings.</small></label><label>Graphics<select id="setup-quality"><option value="auto">Auto · adapts to your device</option><option value="0">Low · lightest GPU load</option><option value="1">Balanced</option><option value="2">High</option><option value="3">Ultra</option></select><small>City, traversal and run features stay available at every tier.</small></label></div><div class="setup-footer"><p>Your bests are saved separately for each run length.<br><span>The full route and all its features are still here.</span></p><button id="session-start">Let's go <span>↗</span></button></div></section>`;
    document.querySelector("#interface")!.append(this.root);
    this.root.querySelectorAll<HTMLInputElement>('[name="run-length"]').forEach(
      (el) =>
        (el.onchange = () => {
          this.store.value.length = el.value as RunLength;
          this.refresh();
        }),
    );
    this.root.querySelector<HTMLSelectElement>("#setup-layout")!.onchange = (
      e,
    ) => {
      const arrow = (e.target as HTMLSelectElement).value === "arrows";
      for (const [action, wasd, key] of [
        ["forward", "KeyW", "ArrowUp"],
        ["backward", "KeyS", "ArrowDown"],
        ["left", "KeyA", "ArrowLeft"],
        ["right", "KeyD", "ArrowRight"],
      ] as const)
        this.settings.bindings[action] = arrow ? [key, wasd] : [wasd, key];
      this.changed();
    };
    this.root.querySelector<HTMLInputElement>("#setup-sensitivity")!.oninput = (
      e,
    ) => {
      this.store.value.sensitivity = Number(
        (e.target as HTMLInputElement).value,
      );
      this.changed();
    };
    this.root.querySelector<HTMLSelectElement>("#setup-smoothing")!.onchange = (
      e,
    ) => {
      this.store.value.cameraSmoothing = Number(
        (e.target as HTMLSelectElement).value,
      );
      this.changed();
    };
    this.root.querySelector<HTMLSelectElement>("#setup-quality")!.onchange = (
      e,
    ) => {
      const v = (e.target as HTMLSelectElement).value;
      this.settings.quality =
        v === "auto" ? "auto" : (Number(v) as 0 | 1 | 2 | 3);
      this.changed();
    };
    this.root.querySelector<HTMLButtonElement>("#session-start")!.onclick =
      () => this.finish();
    this.root.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" ||
        (e.key === "Enter" && e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        this.finish();
      }
      if (e.key === "Tab") {
        const els = [
            ...this.root.querySelectorAll<HTMLElement>("input,select,button"),
          ],
          a = els[0]!,
          b = els.at(-1)!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    });
    this.refresh();
  }
  private refresh(): void {
    (this.root.querySelector("#setup-quality") as HTMLSelectElement).value =
      String(this.settings.quality);
    this.root
      .querySelectorAll<HTMLInputElement>('[name="run-length"]')
      .forEach((el) => {
        el.checked = el.value === this.store.value.length;
        el.closest("label")!.classList.toggle("selected", el.checked);
      });
    (this.root.querySelector("#setup-sensitivity") as HTMLInputElement).value =
      String(this.store.value.sensitivity);
    (this.root.querySelector("#setup-smoothing") as HTMLSelectElement).value =
      String(this.store.value.cameraSmoothing);
    (this.root.querySelector("#setup-layout") as HTMLSelectElement).value =
      this.settings.bindings.forward[0] === "ArrowUp" ? "arrows" : "wasd";
  }
  show(): Promise<boolean> {
    if (this.done) return Promise.resolve(false);
    this.initialLength = this.store.value.length;
    this.refresh();
    this.root.hidden = false;
    document.body.classList.add("choosing-session");
    this.root.querySelector<HTMLButtonElement>("#session-start")!.focus();
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }
  private finish(): void {
    if (!this.done) return;
    this.store.value.configured = true;
    this.store.save();
    this.changed();
    this.root.hidden = true;
    document.body.classList.remove("choosing-session");
    const done = this.done;
    this.done = undefined;
    done(this.initialLength !== this.store.value.length);
  }
  get visible(): boolean {
    return !this.root.hidden;
  }
  dispose(): void {
    this.done?.(false);
    this.root.remove();
  }
}
