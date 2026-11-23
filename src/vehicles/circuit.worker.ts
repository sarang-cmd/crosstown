/// <reference lib="webworker" />
import { generateCircuit } from './circuit-data';
self.onmessage = () => { try { const data = generateCircuit(), m = data.mesh; self.postMessage({ data }, { transfer: [m.positions.buffer, m.normals.buffer, m.colors.buffer, m.indices.buffer] }); } catch (error) { self.postMessage({ error: String(error) }); } };
