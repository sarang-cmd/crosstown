// Original, CC0-authored parkour extensions to Quaternius' verified CC0 skinned glTF. Reproducible, no downloaded motions.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { measure } from './asset-lib.mjs';
import { writeCredits } from './credits.mjs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Quaternion, Euler } from 'three';
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read('public/models/test-character.glb'), root = doc.getRoot(), buffer = root.listBuffers()[0];
const scene = root.listScenes()[0], asset = scene.listChildren()[0];
const pivot = doc.createNode('ParkourMotionPivot').setTranslation([0, 0.8, 0]);
const baseT = asset.getTranslation(); asset.setTranslation([baseT[0], baseT[1] - 0.8, baseT[2]]); scene.removeChild(asset); scene.addChild(pivot); pivot.addChild(asset);
const sources = new Map(root.listAnimations().map(a => [a.getName(), a]));
function sample(sampler, t, out) {
  const input = sampler.getInput(), output = sampler.getOutput(), size = output.getElementSize();
  let i = 0; while (i < input.getCount() - 2 && input.getScalar(i + 1) < t) i++;
  const a = output.getElement(i, []), b = output.getElement(Math.min(i + 1, output.getCount() - 1), []);
  const f = Math.max(0, Math.min(1, (t - input.getScalar(i)) / Math.max(1e-7, input.getScalar(Math.min(i + 1, input.getCount() - 1)) - input.getScalar(i))));
  if (size === 4) { const q = new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b), f); q.toArray(out); }
  else for (let j = 0; j < size; j++) out[j] = a[j] + (b[j] - a[j]) * f;
  return out;
}
const definitions = [
  ['Run', 'Running', 0.8, 0, 1], ['Sprint', 'Running', 0.59, 0, 1], ['ParkourJump', 'Jump', 0.73, 0, 1],
  ['DoubleJump', 'Jump', 0.7, 0.12, 0.85], ['Slide', 'Sitting', 0.85, 0.46, 0.57],
  ['Climb', 'Walking', 0.8, 0, 1], ['Fall', 'Jump', 0.65, 0.5, 0.55], ['Land', 'Jump', 0.2, 0.76, 1],
  ['Roll', 'Sitting', 0.55, 0.5, 0.58], ['WallRun', 'Running', 0.65, 0, 1], ['Vault', 'Jump', 0.42, 0.15, 0.9],
  ['Zipline', 'Walking', 0.8, 0.42, 0.46], ['Swing', 'Walking', 0.9, 0.4, 0.48],
];
for (const [name, sourceName, duration, start, end] of definitions) {
  const source = sources.get(sourceName), animation = doc.createAnimation(name), frames = 17;
  const times = doc.createAccessor(`${name}-time`, buffer).setType('SCALAR').setArray(Float32Array.from({ length: frames }, (_, i) => i / (frames - 1) * duration));
  for (const channel of source.listChannels()) {
    if (channel.getTargetPath() === 'weights') continue;
    const original = channel.getSampler(), output = original.getOutput(), sourceDuration = original.getInput().getMax([])[0], size = output.getElementSize(), values = [];
    for (let i = 0; i < frames; i++) {
      const u = i / (frames - 1), value = sample(original, (start + u * (end - start)) * sourceDuration, []);
      if (channel.getTargetPath() === 'rotation' && ['Climb', 'Zipline', 'Swing'].includes(name) && /UpperArm\.[LR]/.test(channel.getTargetNode().getName())) {
        const sign = channel.getTargetNode().getName().endsWith('L') ? 1 : -1;
        const q = new Quaternion().fromArray(value).multiply(new Quaternion().setFromEuler(new Euler(-1.1 + (name === 'Climb' ? Math.sin(u * Math.PI * 2 + sign) * 0.35 : 0), 0, sign * 0.1))); q.toArray(value);
      }
      values.push(...value.slice(0, size));
    }
    const accessor = doc.createAccessor(`${name}-${channel.getTargetNode().getName()}`, buffer).setType(output.getType()).setArray(new Float32Array(values));
    const sampler = doc.createAnimationSampler().setInput(times).setOutput(accessor).setInterpolation('LINEAR');
    animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(channel.getTargetNode()).setTargetPath(channel.getTargetPath()).setSampler(sampler));
  }
  const rotations = [];
  for (let i = 0; i < frames; i++) {
    const u = i / (frames - 1), flip = name === 'Roll' || name === 'DoubleJump';
    const x = flip ? u * Math.PI * 2 : name === 'Slide' ? -0.12 : 0;
    const z = name === 'WallRun' ? -0.2 * Math.sin(u * Math.PI) : 0;
    rotations.push(...new Quaternion().setFromEuler(new Euler(x, 0, z)).toArray());
  }
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(doc.createAccessor(`${name}-pivot`, buffer).setType('VEC4').setArray(new Float32Array(rotations)));
  animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(pivot).setTargetPath('rotation').setSampler(sampler));
}
await doc.transform(dedup(), prune(), reorder({ encoder: MeshoptEncoder, cleanup: false }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write('public/models/parkour-runner.glb', doc);
const base = JSON.parse(await fs.readFile('docs/assets/test-character.json', 'utf8'));
const bytes = await fs.readFile('public/models/parkour-runner.glb');
const report = { ...base, id: 'parkour-runner', title: 'Crosstown runner — RobotExpressive parkour extension',
  before: base.after, after: measure(await io.read('public/models/parkour-runner.glb')),
  outputSha256: createHash('sha256').update(bytes).digest('hex'), outputBytes: bytes.length,
  modifications: [...base.modifications, '13 embedded original parkour clips: retimed skeletal animation, hanging/climbing arm poses and pivot-based forward rolls; new animation work released CC0-1.0 by the Crosstown project'],
  requiredAnimations: definitions.map(d => d[0]),
  addedMotionAuthor: 'Crosstown project, original pose/retiming/rotation work, CC0-1.0',
};
await fs.writeFile('docs/assets/parkour-runner.json', JSON.stringify(report, null, 2) + '\n');
await fs.writeFile('docs/assets/parkour-runner.license.txt', (await fs.readFile('docs/assets/test-character.license.txt', 'utf8')) + '\nAdditional embedded parkour animation keyframes authored for the Crosstown project and dedicated to the public domain under CC0-1.0.\n');
await writeCredits(process.cwd());
console.log({ id: report.id, bytes: report.outputBytes, animations: report.after.animations });
