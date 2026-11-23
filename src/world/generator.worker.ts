// Worker boundary for future fixed-seed chunk generation. Step 01 only boots and validates the protocol.
import { APP } from '../config/app';
export interface InitRequest { type: 'init'; seed: number }
export interface ReadyResponse { type: 'ready'; seed: number; chunkSize: number; worldSize: number }
self.addEventListener('message', (event: MessageEvent<InitRequest>) => {
  if (event.data.type !== 'init' || !Number.isInteger(event.data.seed)) return;
  const reply: ReadyResponse = { type: 'ready', seed: event.data.seed, chunkSize: APP.chunkSize, worldSize: APP.worldSize };
  self.postMessage(reply);
});
