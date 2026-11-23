// Shared, animation-safe glTF normalization and verification utilities for the offline asset pipeline.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

export async function createIO() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
}
export function dimensions(bounds) { return bounds.max.map((value, i) => value - bounds.min[i]); }
export function measure(document) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!scene) throw new Error('Model has no scene.');
  const bounds = getBounds(scene);
  if (![...bounds.min, ...bounds.max].every(Number.isFinite)) throw new Error('Model has invalid or empty bounds.');
  let triangles = 0;
  scene.traverse(node => {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0;
      if (primitive.getMode() === 4) triangles += count / 3;
      else if (primitive.getMode() === 5 || primitive.getMode() === 6) triangles += Math.max(0, count - 2);
    }
  });
  return { bounds, dimensions: dimensions(bounds), triangles: Math.round(triangles), nodes: document.getRoot().listNodes().length, textures: document.getRoot().listTextures().length, animations: document.getRoot().listAnimations().map(animation => animation.getName()) };
}
export function normalizeDocument(document, { kind, size, forward = '+Z' }) {
  if (!Number.isFinite(size) || size <= 0 || size > 10000) throw new Error('Target size must be a positive number in metres.');
  const angle = ({ '+Z': 0, '-Z': Math.PI, '+X': -Math.PI / 2, '-X': Math.PI / 2 })[forward];
  if (angle === undefined) throw new Error('Forward axis must be +Z, -Z, +X or -X. Sources must be Y-up.');
  const scenes = document.getRoot().listScenes();
  if (scenes.length !== 1) throw new Error('Normalize one scene per asset; split multi-scene sources first.');
  const scene = scenes[0];
  const before = measure(document);
  // A wrapper, rather than modifying mesh vertices or animated transforms, preserves skins and clips.
  const root = document.createNode('asset_root').setRotation([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]);
  for (const node of [...scene.listChildren()]) { scene.removeChild(node); root.addChild(node); }
  scene.addChild(root);
  const rotated = getBounds(scene);
  const axis = kind === 'car' ? 2 : 1;
  const sourceSize = dimensions(rotated)[axis];
  if (sourceSize <= 1e-6) throw new Error('Degenerate model dimension. Check its forward axis.');
  const factor = size / sourceSize;
  root.setScale([factor, factor, factor]);
  const scaled = getBounds(scene);
  root.setTranslation([-(scaled.min[0] + scaled.max[0]) / 2, -scaled.min[1], -(scaled.min[2] + scaled.max[2]) / 2]);
  root.setExtras({ normalized: true, units: 'metres', forward: '+Z', up: '+Y', pivot: 'ground-centre', targetDimension: kind === 'car' ? 'length' : 'height', targetSize: size, sourceForward: forward, uniformScale: factor });
  return { before, factor, root };
}
export function nameKeyNodes(document, kind, overrides = {}) {
  const scene = document.getRoot().listScenes()[0];
  const renamed = [];
  const used = new Set();
  for (const node of document.getRoot().listNodes()) {
    const original = node.getName();
    const name = `${original} ${node.getMesh()?.getName() ?? ''}`.toLowerCase();
    let canonical = overrides[original];
    if (!canonical && /steer/.test(name)) canonical = 'steering_wheel';
    if (!canonical && /wheel|tire|tyre/.test(name)) {
      const bounds = getBounds(node);
      const x = (bounds.min[0] + bounds.max[0]) / 2, z = (bounds.min[2] + bounds.max[2]) / 2;
      // Only assign an individual wheel when its name or distinct geometry supports it.
      const explicitLeft = /left|(?:^|[_ .-])(?:fl|rl|lf|lr)(?:$|[_ .-])/.test(name);
      const explicitRight = /right|(?:^|[_ .-])(?:fr|rr|rf|rrear)(?:$|[_ .-])/.test(name);
      const explicitFront = /front|(?:^|[_ .-])(?:fl|fr|lf|rf)(?:$|[_ .-])/.test(name);
      const explicitRear = /rear|back|(?:^|[_ .-])(?:rl|rr|lr)(?:$|[_ .-])/.test(name);
      if (explicitLeft || explicitRight || Math.abs(x) > 0.05) canonical = `wheel_${explicitFront ? 'f' : explicitRear ? 'r' : z >= 0 ? 'f' : 'r'}${explicitLeft ? 'l' : explicitRight ? 'r' : x < 0 ? 'l' : 'r'}`;
      else canonical = 'wheels_combined';
    }
    if (!canonical && /mirror/.test(name)) canonical = /left/.test(name) ? 'mirror_left' : /right/.test(name) ? 'mirror_right' : 'mirror';
    if (!canonical && /door/.test(name)) canonical = /left/.test(name) ? 'door_left' : /right/.test(name) ? 'door_right' : 'door';
    if (!canonical && /headlight|head.light|front.light/.test(name)) canonical = 'light_front';
    if (!canonical && /taillight|tail.light|brake.light/.test(name)) canonical = 'light_rear';
    if (!canonical && /window|windscreen|windshield/.test(name)) canonical = 'glass';
    if (canonical) {
      const base = canonical; let n = 2;
      while (used.has(canonical)) canonical = `${base}_${n++}`;
      used.add(canonical);
      node.setExtras({ ...node.getExtras(), originalName: original }).setName(canonical);
      renamed.push({ original, canonical });
    }
  }
  // Never invent absent doors, mirrors or wheel nodes: report them for a later rigging pass.
  const expected = kind === 'car' ? ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr', 'steering_wheel', 'door_left', 'door_right', 'light_front', 'light_rear', 'mirror_left', 'mirror_right'] : [];
  return { renamed, missingKeyNodes: expected.filter(name => !used.has(name)), scene: scene.getName() };
}
export function verifyNormalized(document, report) {
  const stats = measure(document);
  const size = stats.dimensions[report.kind === 'car' ? 2 : 1];
  const tolerance = Math.max(0.01, report.targetSize * 0.005);
  if (Math.abs(size - report.targetSize) > tolerance) throw new Error(`${report.id}: size is ${size}, expected ${report.targetSize}`);
  if (Math.abs(stats.bounds.min[1]) > 0.012) throw new Error(`${report.id}: pivot is not at ground level`);
  if (Math.abs(stats.bounds.max[0] + stats.bounds.min[0]) > 0.015 || Math.abs(stats.bounds.max[2] + stats.bounds.min[2]) > 0.015) throw new Error(`${report.id}: pivot is not centred`);
  if (report.kind === 'car' && stats.triangles > 60000) throw new Error(`${report.id}: car exceeds the 60k triangle budget`);
  if (report.kind === 'character' && report.before.animations.length && !stats.animations.length) throw new Error(`${report.id}: animations were lost`);
  if (!document.getRoot().listNodes().some(node => node.getExtras().normalized && node.getExtras().forward === '+Z')) throw new Error(`${report.id}: normalization metadata missing`);
  return stats;
}
export { MeshoptEncoder, MeshoptSimplifier };
