// Deterministic loop and interpolation acceptance tests, independent of the display/GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepLoop } from '../../src/core/loop';

test('fixed 60 Hz simulation is independent of render refresh rate', () => {
  for (const hz of [30, 60, 120, 144]) {
    let updates = 0;
    const alphas: number[] = [];
    const loop = new FixedStepLoop({ beforeFrame() {}, fixedUpdate(dt) { assert.equal(dt, 1 / 60); updates++; }, render(alpha) { alphas.push(alpha); } });
    for (let i = 0; i <= hz * 2; i++) loop.frame(i * 1000 / hz);
    assert.ok(Math.abs(updates - 121) <= 1, `${hz} Hz: ${updates} updates`);
    assert.ok(alphas.every(alpha => alpha >= 0 && alpha < 1.00001));
    assert.ok(Math.abs(loop.simulationTime - updates / 60) < 1e-10);
  }
});
test('long frame is capped to six catch-up steps; no spiral of death', () => {
  let steps = 0;
  const loop = new FixedStepLoop({ beforeFrame() {}, fixedUpdate() { steps++; }, render() {} });
  loop.frame(0); const before = steps; loop.frame(10000);
  assert.equal(steps - before, 6);
});
test('pause freezes physics, keeps rendering, and clock reset discards hidden-tab debt', () => {
  let steps = 0, renders = 0;
  const loop = new FixedStepLoop({ beforeFrame() {}, fixedUpdate() { steps++; }, render() { renders++; } });
  loop.frame(0); loop.setPaused(true);
  for (let time = 100; time <= 1000; time += 100) loop.frame(time);
  assert.equal(steps, 1); assert.equal(renders, 11);
  loop.resetClock(); loop.setPaused(false); loop.frame(500000);
  assert.equal(steps, 2);
});
test('fixed snapshots interpolate between previous and current state', () => {
  let previous = 0, current = 0, rendered = 0;
  const loop = new FixedStepLoop({ beforeFrame() {}, fixedUpdate() { previous = current; current++; }, render(alpha) { rendered = previous + (current - previous) * alpha; } });
  loop.frame(0); loop.frame(1000 / 120);
  assert.ok(Math.abs(rendered - 0.5) < 1e-6);
});
