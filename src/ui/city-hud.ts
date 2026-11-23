import type { CityLayout, DistrictId } from "../world/city/types";
import { districtAt, DISTRICTS, routeToWaypoint } from "../world/city/layout";
import type { CityEnvironment } from "../world/city/environment";
import type { V3 } from "../parkour/types";
export type ExploreMode = "parkour" | "street" | "fly" | "drive";
export class CityHUD {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private label: HTMLElement;
  private status: HTMLElement;
  private position = { x: 0, y: 0, z: 0 };
  private mode: ExploreMode = "parkour";
  private target?: V3;
  private route: V3[] = [];
  private routeStart = { x: Infinity, z: Infinity };
  setWaypoint(p: V3): void {
    this.target = { ...p };
    this.route = routeToWaypoint(this.layout, this.position, p);
    this.routeStart = { ...this.position };
    this.waypoint(p);
    this.draw();
  }
  constructor(
    readonly layout: CityLayout,
    readonly environment: CityEnvironment,
    readonly change: (mode: ExploreMode) => void,
    readonly session: () => void,
    readonly waypoint: (p: V3) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "city-ui";
    this.root.innerHTML = `<nav class="city-tools" aria-label="City modes"><button data-mode="parkour" title="Return to your rooftop run">↗ <span>Rooftops</span></button><button data-mode="street" title="B · Walk at street level">↳ <span>Walk</span><kbd>B</kbd></button><button data-mode="fly" title="V · Free flying camera">⌁ <span>Fly</span><kbd>V</kbd></button><i></i><button id="city-map-toggle" title="M · City map">⊞ <span>Map</span><kbd>M</kbd></button><button id="city-session" title="P · Run length and camera">⚙ <span>Your run</span><kbd>P</kbd></button></nav><div class="city-clock"><b id="city-time">—</b><span id="city-weather">—</span></div><section class="explore-info" hidden><div>THE CITY IS OPEN</div><h2 id="explore-district">Downtown</h2><p id="explore-status">Your run is saved right where you left it.</p></section><section class="city-map-panel" role="dialog" aria-label="Crosstown city map" hidden><header><div><small>16 KM² · SEVEN NEIGHBOURHOODS</small><h2>Find your side of town.</h2></div><button id="city-map-close" aria-label="Close city map">×</button></header><div class="city-map-body"><canvas width="900" height="900" aria-label="Connected city roads, districts, services and six rooftop markers"></canvas><aside><span>AROUND TOWN</span>${DISTRICTS.map((d) => `<button data-district="${d.id}"><i style="background:${d.color}"></i>${d.name}<small>${d.description}</small></button>`).join("")}<p>↗ Rooftop start · + Hospital<br>◇ Service · ◆ Landmark</p><p>Click the map to set a waypoint.<br>Fly mode: W A S D · Space up · X down · Shift fast.</p></aside></div><footer><span id="map-waypoint">No waypoint set</span><span>M to close · B to walk · V to fly</span></footer></section>`;
    document.querySelector("#interface")!.append(this.root);
    this.canvas = this.root.querySelector("canvas")!;
    this.label = this.root.querySelector("#explore-district")!;
    this.status = this.root.querySelector("#explore-status")!;
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach(
        (b) => (b.onclick = () => this.change(b.dataset.mode as ExploreMode)),
      );
    this.root
      .querySelector("#city-map-toggle")!
      .addEventListener("click", () => this.toggleMap());
    this.root
      .querySelector("#city-map-close")!
      .addEventListener("click", () => this.toggleMap(false));
    this.root
      .querySelector("#city-session")!
      .addEventListener("click", session);
    this.root.querySelectorAll<HTMLButtonElement>("[data-district]").forEach(
      (b) =>
        (b.onclick = () => {
          const d = DISTRICTS.find((d) => d.id === b.dataset.district)!;
          this.root.querySelector("#map-waypoint")!.textContent =
            `Waypoint · ${d.name}`;
          this.setWaypoint(d.center);
          this.draw();
        }),
    );
    this.canvas.onclick = (e) => {
      const rect = this.canvas.getBoundingClientRect(),
        x = ((e.clientX - rect.left) / rect.width) * 4400 - 2200,
        z = ((e.clientY - rect.top) / rect.height) * 4400 - 2200;
      this.setWaypoint({ x, y: 0, z });
      this.root.querySelector("#map-waypoint")!.textContent =
        `Waypoint · ${Math.round(x)}, ${Math.round(z)}`;
    };
    this.setMode("parkour");
  }
  setMode(mode: ExploreMode): void {
    this.mode = mode;
    const state = document.querySelector('.live-state'); if (state) state.innerHTML = `<i></i> ${mode === 'drive' ? 'LIVE DRIVE' : mode === 'street' ? 'STREET LEVEL' : mode === 'fly' ? 'FREE FLIGHT' : 'LIVE RUN'}`;
    document.body.dataset.cityMode = mode;
    document.body.classList.toggle("exploring", mode !== "parkour");
    this.root.querySelector<HTMLElement>(".explore-info")!.hidden =
      mode === "parkour";
    this.root
      .querySelectorAll<HTMLElement>("[data-mode]")
      .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    this.status.textContent =
      mode === "fly"
        ? "WASD fly · Space up · X down · Shift fast · drag to look"
        : "WASD walk · Shift sprint · Space jump · Rooftops returns to your run";
  }
  update(p: V3): void {
    this.position = p;
    if (
      this.target &&
      Math.hypot(p.x - this.routeStart.x, p.z - this.routeStart.z) > 80
    ) {
      this.route = routeToWaypoint(this.layout, p, this.target);
      this.routeStart = { ...p };
    }
    const district = DISTRICTS.find((d) => d.id === districtAt(p.x, p.z))!;
    this.label.textContent = district.name;
    const h = this.environment.hour;
    this.root.querySelector("#city-time")!.textContent =
      `${Math.floor(h).toString().padStart(2, "0")}:${Math.floor((h % 1) * 60)
        .toString()
        .padStart(2, "0")}`;
    this.root.querySelector("#city-weather")!.textContent =
      this.environment.weather.toUpperCase();
    if (this.mapOpen) this.draw();
  }
  get navigation(): {route: V3[]; target?: V3} { return {route:this.route, target:this.target}; }
  get mapOpen(): boolean {
    return !this.root.querySelector<HTMLElement>(".city-map-panel")!.hidden;
  }
  toggleMap(value = !this.mapOpen): void {
    this.root.querySelector<HTMLElement>(".city-map-panel")!.hidden = !value;
    if (value) this.draw();
  }
  private draw(): void {
    const c = this.canvas.getContext("2d")!,
      s = 900,
      scale = s / 4400,
      xy = (x: number) => (x + 2200) * scale;
    c.clearRect(0, 0, s, s);
    c.fillStyle = "#60999f";
    c.fillRect(0, 0, s, s);
    c.fillStyle = "#b7c3a4";
    c.fillRect(xy(-1660), xy(-2000), 3660 * scale, 4000 * scale);
    for (const d of DISTRICTS) {
      c.fillStyle = d.color + "55";
      c.beginPath();
      c.arc(xy(d.center.x), xy(d.center.z), 460 * scale, 0, Math.PI * 2);
      c.fill();
    }
    c.lineWidth = 2;
    for (const e of this.layout.edges) {
      c.strokeStyle = e.kind === "highway" ? "#f1d99b" : "#e3e1bf";
      c.lineWidth = e.kind === "highway" ? 4 : 1.8;
      c.beginPath();
      e.points.forEach((p, i) =>
        i ? c.lineTo(xy(p.x), xy(p.z)) : c.moveTo(xy(p.x), xy(p.z)),
      );
      c.stroke();
    }
    if (this.target) {
      c.strokeStyle = "#294f3b";
      c.lineWidth = 5;
      c.lineJoin = "round";
      c.beginPath();
      this.route.forEach((p, i) =>
        i ? c.lineTo(xy(p.x), xy(p.z)) : c.moveTo(xy(p.x), xy(p.z)),
      );
      c.stroke();
      c.strokeStyle = "#e4eeac";
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = "#294f3b";
      c.beginPath();
      c.arc(xy(this.target.x), xy(this.target.z), 7, 0, Math.PI * 2);
      c.fill();
    }
    c.font = "bold 14px sans-serif";
    c.textAlign = "center";
    for (const d of DISTRICTS) {
      c.fillStyle = "#2d4e47";
      c.fillText(d.name.toUpperCase(), xy(d.center.x), xy(d.center.z) - 22);
    }
    for (const m of this.layout.markers) {
      c.fillStyle = m.type === "parkour" ? "#315942" : "#f1e6bc";
      c.font =
        m.type === "parkour" ? "bold 22px sans-serif" : "bold 15px sans-serif";
      c.fillText(
        m.type === "parkour"
          ? "↗"
          : m.type === "landmark"
            ? "◆"
            : m.type === "hospital"
              ? "+"
              : "◇",
        xy(m.position.x),
        xy(m.position.z),
      );
    }
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(xy(this.position.x), xy(this.position.z), 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#315942";
    c.lineWidth = 3;
    c.stroke();
    c.font = "12px monospace";
    c.fillStyle = "#315942";
    c.textAlign = "left";
    c.fillText(
      `${this.mode.toUpperCase()} · ${districtAt(this.position.x, this.position.z) as DistrictId}`,
      20,
      875,
    );
  }
  dispose(): void {
    this.root.remove();
  }
}
