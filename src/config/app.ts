// Shared foundation constants; world content is intentionally deferred to later steps.
export const APP = {
  name: 'Crosstown',
  version: '0.14.0',
  build: '14.002',
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  maxSubsteps: 6,
  worldSeed: 84173,
  worldSize: 4000,
  chunkSize: 128,
} as const;

export const TEST_SCENE = {
  gravity: -9.81,
  bodySize: 1.2,
  dropPosition: { x: 2.65, y: 6.5, z: 0.35 },
  renderCubePosition: { x: -2.3, y: 1.85, z: 0 },
} as const;
