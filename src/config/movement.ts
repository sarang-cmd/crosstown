// Actual SI movement constants used by the Rapier character and the route's ballistic feasibility proof.
export const MOVEMENT = {
  radius: 0.3, height: 1.75, slideHeight: 0.9,
  runSpeed: 6.5, sprintSpeed: 8.4, acceleration: 42, airAcceleration: 16,
  gravity: 24, jumpSpeed: 9.2, doubleJumpSpeed: 8.7,
  coyoteTime: 0.14, jumpBuffer: 0.15,
  jumpSafety: 0.82, snapDistance: 0.24, stepHeight: 0.34,
  wallRunTime: 1.15, wallRunSpeed: 8.5, wallGravity: 2.6,
  fallRespawnDistance: 10, fallPenalty: 5, externalDrag: 3.2, windFactor: 2,
} as const;
export function jumpFlightTime(height = 0, jumpSpeed: number = MOVEMENT.jumpSpeed): number {
  const discriminant = jumpSpeed * jumpSpeed - 2 * MOVEMENT.gravity * height;
  return discriminant < 0 ? 0 : (jumpSpeed + Math.sqrt(discriminant)) / MOVEMENT.gravity;
}
export function maximumJumpDistance(height = 0, sprint = false): number {
  return (sprint ? MOVEMENT.sprintSpeed : MOVEMENT.runSpeed) * jumpFlightTime(height) * MOVEMENT.jumpSafety;
}
export const maximumJumpHeight = MOVEMENT.jumpSpeed ** 2 / (2 * MOVEMENT.gravity) * MOVEMENT.jumpSafety;

// Closed-form worst-case gust drift for the exact exponentially damped external-velocity motor.
export function windDrift(strength: number, flight: number): number {
  const drag = MOVEMENT.externalDrag;
  return strength * MOVEMENT.windFactor / drag * (flight - (1 - Math.exp(-drag * flight)) / drag);
}
