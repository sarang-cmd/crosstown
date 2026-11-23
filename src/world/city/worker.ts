import type { ChunkData, WorldData } from "./types";
export class CityWorker {
  readonly worker = new Worker(new URL("./city.worker.ts", import.meta.url), {
    type: "module",
    name: "crosstown-city",
  });
  private id = 0;
  private pending = new Map<
    number,
    {
      resolve(value: { chunk: ChunkData; world: WorldData }): void;
      reject(error: Error): void;started:number;kind:string;
    }
  >();
  private completed=0;private maximumRoundTripMs=0;private maximumWorkMs=0;private maximumQueuedMs=0;private highWater=0;private recent:{kind:string;roundTripMs:number;workMs:number;queuedMs:number}[]=[];
  constructor() {
    this.worker.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      const roundTripMs=performance.now()-p.started,workMs=e.data.workMs??0,queuedMs=Math.max(0,roundTripMs-workMs);this.completed++;this.maximumRoundTripMs=Math.max(this.maximumRoundTripMs,roundTripMs);this.maximumWorkMs=Math.max(this.maximumWorkMs,workMs);this.maximumQueuedMs=Math.max(this.maximumQueuedMs,queuedMs);this.recent.push({kind:p.kind,roundTripMs,workMs,queuedMs});if(this.recent.length>96)this.recent.shift();
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data);
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message));
      this.pending.clear();
    };
  }
  private request(
    data: object,
  ): Promise<{ chunk: ChunkData; world: WorldData }> {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject,started:performance.now(),kind:(data as {kind:string}).kind });this.highWater=Math.max(this.highWater,this.pending.size);
      this.worker.postMessage({ ...data, id });
    });
  }
  async world(): Promise<WorldData> {
    return (await this.request({ kind: "world" })).world;
  }
  async chunk(cx: number, cz: number, lod: number): Promise<ChunkData> {
    return (await this.request({ kind: "chunk", cx, cz, lod })).chunk;
  }
  snapshot(){return{completed:this.completed,pending:this.pending.size,highWater:this.highWater,maximumRoundTripMs:this.maximumRoundTripMs,maximumWorkMs:this.maximumWorkMs,maximumQueuedMs:this.maximumQueuedMs,recent:this.recent.slice(-12),mainThreadSynchronousWaits:0,queueLimit:4};}
  dispose(): void {
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new Error("City worker disposed"));
    this.pending.clear();
  }
}
