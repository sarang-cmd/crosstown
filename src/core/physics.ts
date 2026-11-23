// Rapier world in metres, kg and seconds. Snapshots are captured only at the fixed 60 Hz boundary.
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three/webgpu';
import { APP, TEST_SCENE } from '../config/app';

export class PhysicsSandbox {
  readonly world: RAPIER.World;
  readonly body: RAPIER.RigidBody;
  readonly characterController: RAPIER.KinematicCharacterController;
  readonly previousPosition = new Vector3();
  readonly currentPosition = new Vector3();
  readonly previousRotation = new Quaternion();
  readonly currentRotation = new Quaternion();
  drops = 1;
  private restTicks = 0;
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: TEST_SCENE.gravity, z: 0 });
    this.world.timestep = APP.fixedStep;
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.15, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(2000, 0.15, 2000).setFriction(0.9), ground);
    const p = TEST_SCENE.dropPosition;
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setCanSleep(true).setCcdEnabled(true));
    const half = TEST_SCENE.bodySize / 2;
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(half, half, half).setDensity(1).setRestitution(0.22).setFriction(0.85), this.body);
    this.characterController = this.world.createCharacterController(0.02);
    this.characterController.setSlideEnabled(true);
    this.captureCurrent();
    this.previousPosition.copy(this.currentPosition);
    this.previousRotation.copy(this.currentRotation);
  }
  static async create(): Promise<PhysicsSandbox> {
    await RAPIER.init();
    return new PhysicsSandbox();
  }
  private captureCurrent(): void {
    this.currentPosition.copy(this.body.translation());
    this.currentRotation.copy(this.body.rotation());
  }
  step(): void {
    this.previousPosition.copy(this.currentPosition);
    this.previousRotation.copy(this.currentRotation);
    this.world.step();
    this.captureCurrent();
    const angular = this.body.angvel();
    const quiet = this.speed < 0.025 && Math.hypot(angular.x, angular.y, angular.z) < 0.025 && this.currentPosition.y < 1.15;
    this.restTicks = quiet ? this.restTicks + 1 : 0;
  }
  reset(): void {
    this.restTicks = 0;
    this.body.setTranslation(TEST_SCENE.dropPosition, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.captureCurrent();
    this.previousPosition.copy(this.currentPosition);
    this.previousRotation.copy(this.currentRotation);
    this.drops++;
  }
  impulse(): void {
    this.restTicks = 0;
    this.body.applyImpulse({ x: 0, y: this.body.mass() * 6.5, z: 0 }, true);
    this.body.applyTorqueImpulse({ x: 0.24, y: 0.1, z: 0.08 }, true);
  }
  get speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }
  // Require 200 ms of quiet fixed steps, not a single low-velocity bounce apex.
  get settled(): boolean { return this.body.isSleeping() || this.restTicks >= 12; }
  dispose(): void { this.world.removeCharacterController(this.characterController); this.world.free(); }
}
