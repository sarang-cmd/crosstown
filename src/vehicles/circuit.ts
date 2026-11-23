import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Mesh, BufferGeometry, BufferAttribute, MeshStandardNodeMaterial } from 'three/webgpu';
import type { CircuitData } from './circuit-data';
import { installCircuit } from './circuit-physics';
export class TestCircuit {
  readonly root = new Group(); data?: CircuitData; private bodies: RAPIER.RigidBody[] = []; private worker?: Worker;
  constructor(readonly world: RAPIER.World) { this.root.name = 'Dedicated handling proving ground (not an expanded city)'; }
  async build(): Promise<void> {
    if (this.data) return;
    const data = await new Promise<CircuitData>((resolve, reject) => { const worker = this.worker = new Worker(new URL('./circuit.worker.ts', import.meta.url), { type: 'module', name: 'crosstown-handling-lab' }); worker.onmessage = e => { worker.terminate(); this.worker = undefined; if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.data); }; worker.onerror = e => { worker.terminate(); reject(new Error(e.message)); }; worker.postMessage({ build: true }); });
    this.data = data;
    const m = data.mesh, geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(m.positions, 3)); geometry.setAttribute('normal', new BufferAttribute(m.normals, 3)); geometry.setAttribute('color', new BufferAttribute(m.colors, 3)); geometry.setIndex(new BufferAttribute(m.indices, 1)); geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.94 })); mesh.receiveShadow = true; this.root.add(mesh);
    this.bodies = installCircuit(this.world, data);
    this.world.propagateModifiedBodyPositionsToColliders();
  }
  dispose(): void { this.worker?.terminate(); for (const body of this.bodies) this.world.removeRigidBody(body); this.root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); } }); this.root.clear(); }
}
