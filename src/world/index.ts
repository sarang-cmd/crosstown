// Main-thread world worker client. No city, chunks, NPCs or terrain generation is claimed yet.
import type { InitRequest, ReadyResponse } from './generator.worker';
export class WorldWorker {
  readonly worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module', name: 'crosstown-world' });
  ready = false;
  initialize(seed: number): Promise<ReadyResponse> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('World worker did not initialize')), 8000);
      this.worker.addEventListener('message', (event: MessageEvent<ReadyResponse>) => {
        if (event.data.type !== 'ready') return;
        window.clearTimeout(timeout);
        this.ready = true;
        resolve(event.data);
      }, { once: true });
      this.worker.addEventListener('error', error => { window.clearTimeout(timeout); reject(error); }, { once: true });
      this.worker.postMessage({ type: 'init', seed } satisfies InitRequest);
    });
  }
  dispose(): void { this.worker.terminate(); }
}
