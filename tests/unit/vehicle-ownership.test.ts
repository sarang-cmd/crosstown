import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Mesh, BoxGeometry, MeshStandardNodeMaterial, Texture } from 'three/webgpu';
import { CarVisual } from '../../src/vehicles/visual';
import { RaycastCar } from '../../src/vehicles/physics';
import { RooftopScene } from '../../src/world/rooftops';
import { generateRoute } from '../../src/parkour/generator';
import type { ParkourRun } from '../../src/parkour/ParkourRun';
await RAPIER.init();

function countDisposals(resource: { addEventListener: Function }) {
  const state = { count: 0 }; resource.addEventListener('dispose', () => state.count++); return state;
}
test('live glTF cars own independent materials and textures; disposal never releases the source or another car', () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const source = new Group(), texture = new Texture(), material = new MeshStandardNodeMaterial({ map: texture });
  const geometry = new BoxGeometry(1.8, .7, 4.3), body = new Mesh(geometry, material); source.add(body);
  for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) { const wheel = new Mesh(new BoxGeometry(.2, .65, .65), material); wheel.name = name; source.add(wheel); }
  const original = [texture, material, geometry].map(countDisposals);
  const a = new RaycastCar(world, { x: 0, y: 1, z: 0 }, 'a'), b = new RaycastCar(world, { x: 3, y: 1, z: 0 }, 'b');
  const va = new CarVisual(a, source), vb = new CarVisual(b, source);
  const ma = (va.wheels[0]!.spin.children[0] as Mesh).material as MeshStandardNodeMaterial;
  const mb = (vb.wheels[0]!.spin.children[0] as Mesh).material as MeshStandardNodeMaterial;
  assert.notEqual(ma, material); assert.notEqual(ma, mb); assert.notEqual(ma.map, texture); assert.notEqual(ma.map, mb.map);
  const aOwned = [ma, ma.map!].map(countDisposals), bOwned = [mb, mb.map!].map(countDisposals);
  va.dispose(); va.dispose(); assert.deepEqual(aOwned.map(s => s.count), [1, 1]); assert.deepEqual(bOwned.map(s => s.count), [0, 0]);
  vb.dispose(); assert.deepEqual(bOwned.map(s => s.count), [1, 1]); assert.deepEqual(original.map(s => s.count), [0, 0, 0]);
  a.dispose(); b.dispose(); world.free(); source.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }); material.dispose(); texture.dispose();
});

test('reward arrow follows relocated parking; rooftop disposal releases only its own root and is idempotent', () => {
  const route = { ...generateRoute(84173, false, 'quick'), hazards: [] };
  const roofs = new RooftopScene(route, true), ownTexture = new Texture(), ownMaterial = new MeshStandardNodeMaterial({ map: ownTexture }), ownGeometry = new BoxGeometry();
  roofs.root.add(new Mesh(ownGeometry, ownMaterial));
  const foreign = new Mesh(new BoxGeometry(), new MeshStandardNodeMaterial()); roofs.scene.add(foreign);
  const owned = [ownTexture, ownMaterial, ownGeometry].map(countDisposals), other = [foreign.geometry, foreign.material].map(countDisposals);
  Object.assign(route.carPosition, { x: 39, y: .815, z: 223.75 });
  const run = { route, player: { position: route.spawn }, checkpoint: -1, store: { data: { car: true } }, stage: { poses: new Map() }, collected: new Set(), finishTime: 0, state: 'running', night: false } as unknown as ParkourRun;
  roofs.update(run, 1); assert.equal(roofs.carArrow.position.x, 39); assert.equal(roofs.carArrow.position.z, 223.75); assert.equal(roofs.carArrow.visible, true);
  roofs.dispose(); roofs.dispose(); assert.deepEqual(owned.map(s => s.count), [1, 1, 1]); assert.deepEqual(other.map(s => s.count), [0, 0]); assert.equal(foreign.parent, roofs.scene);
  foreign.geometry.dispose(); (foreign.material as MeshStandardNodeMaterial).dispose();
});
