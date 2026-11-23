import type { RunLength } from "../config/session";
import type { RouteData, V3 } from "../parkour/types";
export class RouteWorker {
  readonly worker = new Worker(new URL("./route.worker.ts", import.meta.url), {
    type: "module",
    name: "crosstown-rooftops",
  });
  ready = false;
  private serial = 0;
  private pending = new Map<
    number,
    { resolve(route: RouteData): void; reject(error: Error): void }
  >();
  constructor() {
    this.worker.onmessage = (event) => {
      const { id, route, error } = event.data;
      const request = this.pending.get(id);
      if (!request) return;
      this.pending.delete(id);
      if (error) request.reject(new Error(error));
      else {
        this.ready = true;
        request.resolve(route);
      }
    };
    this.worker.onerror = (event) => {
      for (const p of this.pending.values()) p.reject(new Error(event.message));
      this.pending.clear();
    };
  }
  generate = (
    seed: number,
    training = false,
    length: RunLength = "full",
    origin?: V3,
  ): Promise<RouteData> =>
    new Promise((resolve, reject) => {
      const id = ++this.serial;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, seed, training, length, origin });
    });
  dispose(): void {
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new Error("World worker disposed"));
    this.pending.clear();
  }
}
