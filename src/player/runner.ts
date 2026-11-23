import { AnimationMixer, Group, Mesh, MeshStandardNodeMaterial, CapsuleGeometry, SphereGeometry, LoopOnce, LoopRepeat, type AnimationAction, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MOTIONS, type ParkourRun } from '../parkour/ParkourRun';
import type { Motion } from './controller';
const CLIPS: Record<Motion, string> = { idle: 'Idle', run: 'Run', sprint: 'Sprint', jump: 'ParkourJump', double: 'DoubleJump', slide: 'Slide', climb: 'Climb', fall: 'Fall', land: 'Land', roll: 'Roll', wallrun: 'WallRun', vault: 'Vault', zipline: 'Zipline', swing: 'Swing' };
export class AnimatedRunner {
  readonly root = new Group();
  readonly ghostRoot = new Group();
  loaded = false;
  fallback = false;
  clips: string[] = [];
  private mixer?: AnimationMixer;
  private ghostMixer?: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private ghostActions = new Map<string, AnimationAction>();
  private action?: AnimationAction;
  private ghostAction?: AnimationAction;
  private motion: Motion = 'idle';
  private ghostMotion: Motion = 'idle';
  private fallbackLimbs: Group[] = [];
  async load(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/parkour-runner.glb');
      this.root.add(gltf.scene); this.clips = gltf.animations.map(a => a.name);
      gltf.scene.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      this.mixer = new AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
      const ghost = clone(gltf.scene), ghostMaterial = new MeshStandardNodeMaterial({ color: '#9ff7de', emissive: '#6bdfcc', emissiveIntensity: 0.8, transparent: true, opacity: 0.27, depthWrite: false, roughness: 0.8 });
      ghost.traverse(object => { if (object instanceof Mesh) { object.material = ghostMaterial; object.castShadow = false; } });
      this.ghostRoot.add(ghost); this.ghostMixer = new AnimationMixer(ghost);
      for (const clip of gltf.animations) this.ghostActions.set(clip.name, this.ghostMixer.clipAction(clip));
      this.loaded = true; this.play('run'); this.mixer.update(0.17);
    } catch (error) {
      console.warn('Using articulated code-built runner because the glTF could not load:', error);
      this.makeFallback(); this.fallback = true;
    }
    this.ghostRoot.visible = false;
  }
  private makeFallback(): void {
    const suit = new MeshStandardNodeMaterial({ color: '#f7f4df', roughness: 0.85 }), trim = new MeshStandardNodeMaterial({ color: '#ef744b', roughness: 0.65 });
    const torso = new Mesh(new CapsuleGeometry(0.21, 0.34, 4, 10), suit); torso.position.y = 1.12; this.root.add(torso);
    const head = new Mesh(new SphereGeometry(0.19, 12, 8), trim); head.position.y = 1.57; this.root.add(head);
    for (let i = 0; i < 4; i++) { const limb = new Group(); limb.position.set((i % 2 ? -1 : 1) * (i < 2 ? 0.12 : 0.29), i < 2 ? 0.87 : 1.32, 0); const mesh = new Mesh(new CapsuleGeometry(i < 2 ? 0.085 : 0.065, i < 2 ? 0.55 : 0.43, 3, 8), i < 2 ? trim : suit); mesh.position.y = i < 2 ? -0.3 : -0.24; limb.add(mesh); this.root.add(limb); this.fallbackLimbs.push(limb); }
  }
  private play(motion: Motion, ghost = false): void {
    const map = ghost ? this.ghostActions : this.actions, previous = ghost ? this.ghostAction : this.action;
    const next = map.get(CLIPS[motion]); if (!next || next === previous) return;
    const once = ['jump', 'double', 'land', 'roll', 'vault'].includes(motion);
    next.reset().setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity); next.clampWhenFinished = once;
    next.enabled = true; next.setEffectiveWeight(1); next.setEffectiveTimeScale(1); next.play();
    if (previous) previous.crossFadeTo(next, 0.09, true);
    if (ghost) this.ghostAction = next; else this.action = next;
  }
  update(run: Pick<ParkourRun, 'player' | 'state' | 'elapsed' | 'ghostAt'>, alpha: number, dt: number): void {
    const p = run.player;
    this.root.position.set(p.previous.x + (p.position.x - p.previous.x) * alpha, p.previous.y + (p.position.y - p.previous.y) * alpha, p.previous.z + (p.position.z - p.previous.z) * alpha);
    const turn = Math.atan2(Math.sin(p.yaw - this.root.rotation.y), Math.cos(p.yaw - this.root.rotation.y));
    this.root.rotation.y += turn * (dt <= 0 || this.root.position.distanceToSquared(p.position) > 100 ? 1 : 1 - Math.exp(-12 * Math.min(dt, 0.05)));
    if (p.motion !== this.motion) { this.motion = p.motion; this.play(this.motion); }
    if (run.state === 'running') this.mixer?.update(Math.min(dt, 0.1));
    if (this.fallback) for (let i = 0; i < this.fallbackLimbs.length; i++) this.fallbackLimbs[i]!.rotation.x = Math.sin(run.elapsed * 13 + (i % 2) * Math.PI) * (p.speed > 0.2 ? 0.65 : 0);
    const g = run.ghostAt(); this.ghostRoot.visible = !!g && run.state === 'running';
    if (g) { this.ghostRoot.position.set(g[1], g[2], g[3]); this.ghostRoot.rotation.y = g[4]; const motion = MOTIONS[g[5]] ?? 'run'; if (motion !== this.ghostMotion) { this.ghostMotion = motion; this.play(motion, true); } this.ghostMixer?.update(Math.min(dt, 0.1)); }
  }
  dispose(): void {
    for (const mixer of [this.mixer, this.ghostMixer]) { mixer?.stopAllAction(); if (mixer) mixer.uncacheRoot(mixer.getRoot()); }
    const seen = new Set<object>();
    for (const group of [this.root, this.ghostRoot]) group.traverse((o: Object3D) => { if (o instanceof Mesh) { if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!seen.has(m)) { seen.add(m); m.dispose(); } } });
  }
}
