// Frame-rate measurement, four quality budgets and stable hysteretic adaptation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityScaler } from '../../src/core/quality';
import { QUALITY_TIERS } from '../../src/config/quality';
const simulate = (scaler: QualityScaler, fps: number, seconds: number) => { for (let i = 0; i < fps * seconds; i++) scaler.sample(1 / fps); };

test('four tiers have ordered budgets and disable expensive effects first', () => {
  assert.equal(QUALITY_TIERS.length, 4);
  assert.deepEqual(QUALITY_TIERS.map(tier => tier.name), ['Low', 'Balanced', 'High', 'Ultra']);
  assert.equal(QUALITY_TIERS[0]!.effects.bloom, false);
  assert.equal(QUALITY_TIERS[1]!.effects.wetReflections, false);
  assert.equal(QUALITY_TIERS[2]!.effects.volumetricFog, false);
  assert.equal(QUALITY_TIERS[3]!.effects.volumetricFog, true);
  for (let i = 1; i < QUALITY_TIERS.length; i++) assert.ok(QUALITY_TIERS[i]!.viewDistance > QUALITY_TIERS[i - 1]!.viewDistance);
});
test('fps and frame-time are measured, not hardcoded to 60', () => {
  const scaler = new QualityScaler(); simulate(scaler, 30, 3);
  assert.equal(scaler.fps, 30); assert.ok(Math.abs(scaler.frameMs - 1000 / 30) < 0.001);
  assert.equal(scaler.history.length, 44);
});
test('warm-up prevents startup drop; sustained slow frames cut real effects before lowering tiers', () => {
  const scaler = new QualityScaler(); simulate(scaler, 30, 7); assert.equal(scaler.tier, 2);
  simulate(scaler, 30, 8); assert.equal(scaler.tier, 2); assert.equal(scaler.current.effects.wetReflections,false); // Step 14 sheds heavy effects first.
  simulate(scaler, 30, 15); assert.equal(scaler.tier, 0);
});
test('sustained fast frames raise quality and manual selection never auto-downgrades', () => {
  const scaler = new QualityScaler(); simulate(scaler, 120, 25); assert.equal(scaler.tier, 3);
  scaler.setMode(2); simulate(scaler, 15, 50); assert.equal(scaler.tier, 2); assert.equal(scaler.mode, 2);
});
test('invalid samples are ignored; real long frames are not falsely reported as 60fps', () => {
  const scaler = new QualityScaler(); scaler.sample(NaN); scaler.sample(-1); scaler.sample(10);
  simulate(scaler, 2, 2); assert.equal(scaler.fps, 2); assert.equal(scaler.frameMs, 500);
});
