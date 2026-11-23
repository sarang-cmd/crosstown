import { generateWorld, generateChunk, transferBuffers } from "./generator";
import type { CityLayout } from "./types";
let layout: CityLayout;
self.onmessage = (
  event: MessageEvent<{
    id: number;
    kind: "world" | "chunk";
    cx?: number;
    cz?: number;
    lod?: number;
  }>,
) => {
  const { id, kind, cx, cz, lod } = event.data,start=performance.now();
  try {
    if (kind === "world") {
      const world = generateWorld();
      layout = world.layout;
      self.postMessage({ id, world,workMs:performance.now()-start }, { transfer: transferBuffers(world) });
    } else {
      const chunk = generateChunk(cx!, cz!, lod, layout);
      self.postMessage({ id, chunk,workMs:performance.now()-start }, { transfer: transferBuffers(chunk) });
    }
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
