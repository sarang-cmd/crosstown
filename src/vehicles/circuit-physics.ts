import RAPIER from '@dimforge/rapier3d-compat';
import type { CircuitData } from './circuit-data';
// Shared by the worker-generated scene installer and the actual-Rapier handling tests.
export function installCircuit(world: RAPIER.World, data: CircuitData): RAPIER.RigidBody[] {
  const bodies: RAPIER.RigidBody[] = [];
  for (const p of data.colliders) {
    const sy = Math.sin(p.yaw / 2), cy = Math.cos(p.yaw / 2), sx = Math.sin(p.pitch / 2), cx = Math.cos(p.pitch / 2);
    const rotation = { x: cy * sx, y: sy * cx, z: -sy * sx, w: cy * cx };
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.position.x, p.position.y, p.position.z).setRotation(rotation));
    body.userData = { surface: p.surface, material: p.surface === 'gravel' || p.surface === 'grass' ? p.surface : 'concrete', handlingFixture: true };
    world.createCollider(RAPIER.ColliderDesc.cuboid(p.half.x, p.half.y, p.half.z).setFriction(p.surface === 'gravel' ? .5 : .95), body); bodies.push(body);
  }
  world.propagateModifiedBodyPositionsToColliders(); return bodies;
}
