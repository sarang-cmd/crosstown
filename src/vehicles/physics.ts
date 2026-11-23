import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three/webgpu';
import { HARBOR, clamp, steeringLock, tireGrip, type CarDefinition, type Surface } from './cars';
import { VehicleDamage } from './damage';
import { Powertrain, neutralDrive, type DriveInput } from './engine';
import { v3, type V3 } from '../parkour/types';
export class RaycastCar {
  readonly body: RAPIER.RigidBody; readonly collider: RAPIER.Collider; readonly vehicle: RAPIER.DynamicRayCastVehicleController;
  readonly engine: Powertrain;
  input = neutralDrive(); assist = true; roadSteer = 0; wheelAngle = 0; speed = 0; slip = 0; surface: Surface = 'asphalt';
  position: V3; previous: V3; rotation = new Quaternion(); previousRotation = new Quaternion();
  contacts = 0; odometer = 0; readonly damageState = new VehicleDamage(); lean = 0; targetLean = 0; airborne = 0; lastImpact = 0; maxHeight = 0; carjacked = false;
  get damage(): number { return this.damageState.amount; }
  set damage(value: number) { this.damageState.restore(value); }
  get bike(): boolean { return this.definition.class === 'motorbike'; }
  wheels = Array.from({ length: 4 }, () => ({ suspension: 0.36, rotation: 0, steer: 0, contact: false, slip: 0, grip: 0, force: 0, surface: 'asphalt' as Surface }));
  readonly events: { type: string; intensity: number; surface?: Surface; material?: string }[] = [];
  private forward = new Vector3(); private right = new Vector3(); private velocity = new Vector3(); private localVelocity = new Vector3();
  private beforeVelocity = v3(); private previousContacts = 0;
  constructor(readonly world: RAPIER.World, spawn: V3, readonly id = 'parked', readonly definition: CarDefinition = HARBOR, yaw = 0) {
    this.position = { ...spawn }; this.previous = { ...spawn }; this.engine = new Powertrain(definition);
    const c = definition; if (this.bike) this.wheels.length = 2;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setLinearDamping(0.025).setAngularDamping(0.65).setCcdEnabled(true).setAdditionalMassProperties(c.mass, v3(0, -0.13, 0), this.bike ? v3(c.mass * .5, c.mass * .65, c.mass * .28) : v3(c.mass * 1.1, c.mass * 1.55, c.mass * 0.55), { x: 0, y: 0, z: 0, w: 1 }));
    // Characters keep their tuned -24 m/s² gravity; vehicles use Earth gravity in the same world.
    this.body.setGravityScale(9.81 / Math.max(0.1, Math.abs(world.gravity.y)), true);
    this.body.userData = { vehicle: id, surface: 'metal' };
    this.collider = world.createCollider(RAPIER.ColliderDesc.cuboid(c.halfWidth, this.bike ? .23 : .33, c.halfLength).setTranslation(0, this.bike ? .18 : .22, 0).setMass(0).setFriction(0.65).setRestitution(0.08), this.body);
    // A second small hull gives the real cabin a roof without a tall, top-heavy COM.
    world.createCollider(RAPIER.ColliderDesc.cuboid(c.halfWidth * .79, this.bike ? .12 : .31, this.bike ? .36 : .91).setTranslation(0, this.bike ? .56 : .8, -.13).setMass(0).setFriction(0.5), this.body);
    // A takeover/stream-in may be created already resting on the road. Rapier
    // otherwise defers additional mass + inertia until world.step(); a wheel
    // controller used first would see a zero-mass chassis and can inject NaNs.
    // Recompute, never perform a hidden extra world step in this constructor.
    this.body.recomputeMassPropertiesFromColliders();
    this.vehicle = world.createVehicleController(this.body); this.vehicle.indexUpAxis = 1; this.vehicle.setIndexForwardAxis = 2;
    for (const z of [c.wheelbase / 2, -c.wheelbase / 2]) for (const x of this.bike ? [0] : [c.track / 2, -c.track / 2]) {
      const i = this.vehicle.numWheels();
      this.vehicle.addWheel(v3(x, 0.06, z), v3(0, -1, 0), v3(-1, 0, 0), c.suspension.rest, c.wheelRadius);
      this.vehicle.setWheelSuspensionStiffness(i, c.suspension.stiffness); this.vehicle.setWheelSuspensionCompression(i, c.suspension.compression); this.vehicle.setWheelSuspensionRelaxation(i, c.suspension.rebound); this.vehicle.setWheelMaxSuspensionTravel(i, c.suspension.travel); this.vehicle.setWheelMaxSuspensionForce(i, c.suspension.maxForce); this.vehicle.setWheelFrictionSlip(i, c.tires.grip); this.vehicle.setWheelSideFrictionStiffness(i, c.tires.sideStiffness);
    }
    this.sync(true); world.propagateModifiedBodyPositionsToColliders();
  }
  setInput(input: DriveInput): void { this.input = { throttle: clamp(input.throttle), brake: clamp(input.brake), steering: clamp(input.steering, -1, 1), handbrake: !!input.handbrake, clutch: !!input.clutch, directSteer: !!input.directSteer }; }
  preStep(dt: number): void {
    const c = this.definition, count = this.wheels.length, front = this.bike ? 1 : 2, input = this.engine.occupied && this.damageState.drivable ? this.input : { ...neutralDrive(), handbrake: true };
    this.previous = { ...this.position }; this.previousRotation.copy(this.rotation); this.beforeVelocity = { ...this.body.linvel() }; this.lastImpact = 0;
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation); this.right.set(-1, 0, 0).applyQuaternion(this.rotation);
    this.velocity.copy(this.body.linvel()); this.speed = this.velocity.dot(this.forward);
    const lateral = this.velocity.dot(this.right), slipAngle = Math.atan2(lateral, Math.max(2, Math.abs(this.speed)));
    this.slip = Math.abs(slipAngle);
    const lock = input.directSteer ? c.steering.lowLock : steeringLock(c, this.speed), counter = this.assist && !input.directSteer && this.contacts > 1 ? clamp(slipAngle * c.steering.countersteer, -0.13, 0.13) : 0;
    const target = -input.steering * lock * (1 - this.damage * .04) + counter + this.damage * .012;
    this.damageState.update(dt); if (!this.damageState.drivable) { this.engine.phase = 'off'; this.engine.rpm = 0; }
    this.roadSteer += (target - this.roadSteer) * (1 - Math.exp(-dt * (input.directSteer ? 35 : c.steering.response)));
    this.wheelAngle = this.roadSteer * c.steering.ratio;
    const force = this.engine.update(dt, input, this.speed) * (1 - this.damage * .15);
    const driven = this.bike ? [1] : c.drive === 'awd' ? [0, 1, 2, 3] : c.drive === 'fwd' ? [0, 1] : [2, 3];
    const loads = driven.map(i => Math.max(0.15, (this.vehicle.wheelSuspensionForce(i) ?? 0) / (c.mass * 9.81 / count)));
    const sum = loads.reduce((a, b) => a + b, 0);
    const reverse = this.engine.gear < 0;
    for (let i = 0; i < this.wheels.length; i++) {
      const body = this.vehicle.wheelGroundObject(i)?.parent(), metadata = body?.userData as { surface?: Surface } | undefined;
      const surface = metadata?.surface && ['asphalt', 'gravel', 'grass', 'concrete'].includes(metadata.surface) ? metadata.surface : 'asphalt';
      const grip = tireGrip(c, slipAngle, surface, i >= front && input.handbrake) * (1 - this.damage * .08);
      this.wheels[i]!.surface = surface; this.wheels[i]!.grip = grip; this.wheels[i]!.slip = Math.abs(slipAngle);
      this.vehicle.setWheelFrictionSlip(i, grip); this.vehicle.setWheelSideFrictionStiffness(i, c.tires.sideStiffness * (surface === 'gravel' ? 0.72 : 1));
      this.vehicle.setWheelSteering(i, i < front ? this.roadSteer : 0);
      const index = driven.indexOf(i), bias = index < 0 ? 0 : (1 - c.differentialBias) / driven.length + c.differentialBias * loads[index]! / sum;
      const braking = reverse ? input.throttle : input.brake;
      // Rapier's raycast tire chooses engine-force OR brake friction, not both.
      // Engine drag on every AWD wheel used to bypass the service brakes entirely.
      this.vehicle.setWheelEngineForce(i, braking > .001 || i >= front && input.handbrake ? 0 : force * bias);
      this.vehicle.setWheelBrake(i, (braking * c.brakeForce / count + (i >= front && input.handbrake ? c.handbrakeForce / (count - front) : 0) + (!this.engine.occupied ? 200 : 0)) * dt);
    }
    this.surface = this.wheels.find(w => w.contact)?.surface ?? 'asphalt';
    this.body.resetForces(true); this.body.resetTorques(true);
    const flatSpeed = Math.hypot(this.velocity.x, this.velocity.z), resistance = c.aero.drag * flatSpeed * flatSpeed + (this.contacts ? c.mass * 9.81 * c.aero.rolling : 0);
    if (flatSpeed > 0.1) this.body.addForce(v3(-this.velocity.x / flatSpeed * resistance, -c.aero.downforce * flatSpeed * flatSpeed, -this.velocity.z / flatSpeed * resistance), true);
    if (this.assist && this.contacts > 1 && Math.abs(this.speed) > 4 && Math.abs(input.steering) < 0.15) {
      const yaw = this.body.angvel().y; this.body.addTorque(v3(0, -yaw * c.mass * c.steering.assist, 0), true);
    }
    if (this.bike) {
      // Two in-line contact patches, not four hidden car wheels. Speed/curvature lean
      // is a damped roll torque; the rigid body still jumps, collides and can fall.
      const q = this.rotation, roll = Math.atan2(2 * (q.w*q.z+q.x*q.y),1-2*(q.z*q.z+q.x*q.x));
      this.targetLean = this.contacts > 0 ? clamp(-Math.atan(this.speed*this.speed*Math.tan(this.roadSteer)/c.wheelbase/9.81),-.65,.65) : 0;
      this.lean = roll;
      if (this.contacts > 0 && this.damageState.drivable) { const omega = this.body.angvel(), rollRate = omega.x*this.forward.x+omega.y*this.forward.y+omega.z*this.forward.z; const torque=(this.targetLean-roll)*c.mass*11-rollRate*c.mass*2.1; this.body.addTorque(v3(this.forward.x*torque,this.forward.y*torque,this.forward.z*torque),true); }
    }
    this.vehicle.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider => collider.parent()?.handle !== this.body.handle);
    for (const phase of this.engine.drainEvents()) this.events.push({ type: phase, intensity: 1 });
  }
  postStep(dt: number): void {
    this.sync(); const velocity = this.body.linvel(); this.velocity.copy(velocity); this.forward.set(0, 0, 1).applyQuaternion(this.rotation); this.speed = this.velocity.dot(this.forward); this.odometer += Math.abs(this.speed) * dt;
    this.contacts = 0;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i]!; w.suspension = this.vehicle.wheelSuspensionLength(i) ?? this.definition.suspension.rest; w.rotation = this.vehicle.wheelRotation(i) ?? 0; w.steer = this.vehicle.wheelSteering(i) ?? 0; w.contact = this.vehicle.wheelIsInContact(i); w.force = this.vehicle.wheelSuspensionForce(i) ?? 0; if (w.contact) this.contacts++;
    }
    if (this.contacts === 0) { this.airborne += dt; this.maxHeight = Math.max(this.maxHeight, this.position.y); }
    if (this.contacts > 0 && this.previousContacts === 0 && this.beforeVelocity.y < -1.8) this.events.push({ type: 'suspension', intensity: clamp(-this.beforeVelocity.y / 10), surface: this.surface });
    const impulseSpeed = Math.hypot(velocity.x - this.beforeVelocity.x, velocity.z - this.beforeVelocity.z);
    // A parked/NPC car can be struck from rest: use either side of the impulse,
    // not just pre-contact speed, or only the striking vehicle takes damage.
    if (impulseSpeed > 2.5 && Math.max(Math.hypot(this.beforeVelocity.x, this.beforeVelocity.z), Math.hypot(velocity.x, velocity.z)) > 2) { let material = 'concrete'; this.world.contactPairsWith(this.collider, other => { const meta = other.parent()?.userData as { material?: string; surface?: string } | undefined; material = meta?.material ?? meta?.surface ?? material; }); this.lastImpact = impulseSpeed;
      const impact = new Vector3(this.beforeVelocity.x-velocity.x,0,this.beforeVelocity.z-velocity.z).applyQuaternion(this.rotation.clone().invert()).normalize();
      this.damageState.hit(impulseSpeed,v3(impact.x*this.definition.halfWidth,.12,impact.z*this.definition.halfLength)); this.events.push({ type: impulseSpeed > 10 ? 'glass' : 'collision', intensity: clamp(impulseSpeed / 15), surface: this.surface, material }); }
    this.previousContacts = this.contacts;
  }
  private sync(immediate = false): void {
    this.position = { ...this.body.translation() }; this.rotation.copy(this.body.rotation());
    if (immediate) { this.previous = { ...this.position }; this.previousRotation.copy(this.rotation); }
  }
  teleport(position: V3, yaw = 0): void {
    this.body.setTranslation(position, true); this.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true); this.body.setLinvel(v3(), true); this.body.setAngvel(v3(), true); this.body.resetForces(true); this.body.resetTorques(true); this.sync(true); this.world.propagateModifiedBodyPositionsToColliders(); this.roadSteer = this.wheelAngle = this.speed = this.slip = this.lastImpact = 0; this.contacts = this.previousContacts = 0; this.beforeVelocity = v3(); this.input = neutralDrive();
  }
  recover(): void {
    const yaw = Math.atan2(this.forward.x, this.forward.z), p = this.position;
    const hit = this.world.castRay(new RAPIER.Ray(v3(p.x, p.y + 4, p.z), v3(0, -1, 0)), 100, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, this.collider, this.body);
    this.teleport(v3(p.x, hit ? p.y + 4 - hit.timeOfImpact + 0.9 : p.y + 1, p.z), yaw); this.events.push({ type: 'recover', intensity: 0.5 });
  }
  exitPosition(): V3 | undefined {
    for (const local of [v3(2.1, 0, 0.15), v3(-2.1, 0, 0.15), v3(0, 0, -3.2)]) {
      this.localVelocity.copy(local).applyQuaternion(this.rotation).add(this.body.translation());
      const p = this.localVelocity, hit = this.world.castRay(new RAPIER.Ray(v3(p.x, p.y + 2, p.z), v3(0, -1, 0)), 8, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
      if (!hit) continue;
      const y = p.y + 2 - hit.timeOfImpact + 0.08;
      // A wall top is not a safe door exit: no teleporting onto a barrier or dropping into a pit.
      if (y > this.position.y + .45 || y < this.position.y - 1.75) continue;
      if (!this.world.intersectionWithShape(v3(p.x, y + 0.9, p.z), { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(0.55, 0.3), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body)) return v3(p.x, y, p.z);
    }
    return undefined;
  }
  snapshot() { return { id: this.id, definition: this.definition.id, position: { ...this.position }, rotation: this.rotation.toArray(), velocity: { ...this.body.linvel() }, speed: this.speed, kmh: Math.abs(this.speed) * 3.6, roadSteer: this.roadSteer, steeringWheelRadians: this.wheelAngle, steeringRatio: this.definition.steering.ratio, assist: this.assist, slip: this.slip, surface: this.surface, contacts: this.contacts, odometer: this.odometer, damage: this.damage, damageState: this.damageState.snapshot(), bike: this.bike, lean: this.lean, targetLean: this.targetLean, physicsWheels: this.wheels.length, airborneSeconds: this.airborne, maxHeight: this.maxHeight, carjacked: this.carjacked, input: { ...this.input }, engine: this.engine.snapshot(), wheels: this.wheels.map(w => ({ ...w })) }; }
  dispose(): void { this.world.removeVehicleController(this.vehicle); this.world.removeRigidBody(this.body); }
}
