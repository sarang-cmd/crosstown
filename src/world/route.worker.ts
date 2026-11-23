import { generateRoute } from "../parkour/generator";
import { terrainHeightAt } from "./city/layout";
import type { V3 } from "../parkour/types";
import type { RunLength } from "../config/session";
self.onmessage = (
  event: MessageEvent<{
    id: number;
    seed: number;
    training: boolean;
    length?: RunLength;
    origin?: V3;
  }>,
) => {
  const { id, seed, training, length, origin } = event.data;
  try {
    const route = generateRoute(seed, training, length, origin);
    route.carPosition.y =
      terrainHeightAt(route.carPosition.x, route.carPosition.z) + 0.18;
    self.postMessage({ id, route });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
