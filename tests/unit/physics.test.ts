// Real Rapier WASM acceptance: a dynamic body falls, rests, resets and responds to an impulse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsSandbox } from '../../src/core/physics';

test('test body falls to the fixed ground and snapshots remain stable at rest', async () => {
  const physics = await PhysicsSandbox.create();
  assert.equal(physics.currentPosition.y, 6.5);
  physics.step(); assert.ok(physics.currentPosition.y < 6.5);
  for (let i = 0; i < 300; i++) {
    physics.step();
    if (physics.settled) assert.ok(Math.abs(physics.currentPosition.y - 0.6) < 0.005, "A bounce apex must not be reported as rest");
  }
  assert.ok(Math.abs(physics.body.translation().y - 0.6) < 0.005);
  assert.equal(physics.settled, true); assert.ok(physics.speed < 0.001);
  physics.impulse(); assert.ok(physics.speed > 6);
  physics.step(); assert.ok(physics.currentPosition.y > 0.65);
  physics.reset(); assert.equal(physics.currentPosition.y, 6.5);
  assert.equal(physics.previousPosition.y, 6.5); assert.equal(physics.speed, 0);
  assert.equal(physics.drops, 2); assert.ok(physics.characterController);
  physics.dispose();
});
