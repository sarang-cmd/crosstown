// Calibrated analog input tests; connected physical hardware is not assumed in automated CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deadzone, pedal } from '../../src/core/input';
import { DEFAULT_BINDINGS, DEFAULT_WHEEL, keyLabel } from '../../src/config/actions';
test('stick dead zone rescales outside the dead band and clamps noisy axes', () => {
  assert.equal(deadzone(0.1), 0); assert.equal(deadzone(-0.1), 0);
  assert.equal(deadzone(1), 1); assert.equal(deadzone(-1), -1);
  assert.equal(deadzone(2), 1); assert.equal(deadzone(NaN), 0);
  assert.ok(Math.abs(deadzone(0.575) - 0.5) < 1e-9);
});
test('separate wheel pedals accept signed-rest and positive ranges', () => {
  assert.equal(pedal(1, 'signed'), 0); assert.equal(pedal(-1, 'signed'), 1);
  assert.equal(pedal(0, 'signed'), 0.5); assert.equal(pedal(0, 'positive'), 0);
  assert.equal(pedal(1, 'positive'), 1); assert.equal(pedal(NaN, 'signed'), 0);
  assert.equal(DEFAULT_WHEEL.steeringDegrees, 900);
});
test('bindings are centralized and have legible HUD labels', () => {
  assert.deepEqual(DEFAULT_BINDINGS.forward, ['KeyW', 'ArrowUp']);
  assert.equal(keyLabel('KeyW'), 'W'); assert.equal(keyLabel('Escape'), 'Esc');
  assert.equal(keyLabel('ArrowUp'), '↑'); assert.equal(keyLabel('Space'), 'Space');
});
