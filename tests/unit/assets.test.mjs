// Geometry normalization contract using an asymmetric synthetic source — no network required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { normalizeDocument, measure, nameKeyNodes } from '../../tools/asset-lib.mjs';
function source() {
  const doc = new Document(); const buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([-3, 1, -1, 3, 1, -1, -3, 3, 1, 3, 3, 1])).setBuffer(buffer);
  const primitive = doc.createPrimitive().setAttribute('POSITION', positions).setMode(4);
  const mesh = doc.createMesh('body').addPrimitive(primitive);
  const scene = doc.createScene('source'); doc.getRoot().setDefaultScene(scene);
  scene.addChild(doc.createNode('body').setMesh(mesh));
  return doc;
}
test('X-forward source is rotated into +Z, scaled by length and placed on the ground', () => {
  const doc = source(); const result = normalizeDocument(doc, { kind: 'car', size: 4.5, forward: '+X' });
  const stats = measure(doc);
  assert.ok(Math.abs(stats.dimensions[2] - 4.5) < 1e-6);
  assert.ok(Math.abs(stats.bounds.min[1]) < 1e-6);
  assert.ok(Math.abs(stats.bounds.min[0] + stats.bounds.max[0]) < 1e-6);
  assert.equal(result.root.getExtras().forward, '+Z');
});
test('invalid dimensions and unverified forward axes are rejected', () => {
  assert.throws(() => normalizeDocument(source(), { kind: 'car', size: -1, forward: '+X' }));
  assert.throws(() => normalizeDocument(source(), { kind: 'car', size: 4.5, forward: '+Y' }));
});
test('missing hardware nodes are reported, never fabricated', () => {
  const doc = source(); const report = nameKeyNodes(doc, 'car');
  assert.ok(report.missingKeyNodes.includes('steering_wheel'));
  assert.ok(report.missingKeyNodes.includes('wheel_fl'));
  assert.equal(doc.getRoot().listNodes().length, 1);
});
