// Pure, serializable damage state. Amount 0 = intact; 1 = irreparable.
import { clamp } from './cars';
import type { V3 } from '../parkour/types';
export type DamageStage = 'intact' | 'dented' | 'broken-glass' | 'smoking' | 'burning' | 'wreck';
export interface Dent { point: V3; depth: number; radius: number }
export class VehicleDamage {
  amount = 0; burnSeconds = 0; wreck = false; revision = 0; dents: Dent[] = [];
  get stage(): DamageStage { return this.wreck ? 'wreck' : this.amount >= 1 ? 'burning' : this.amount >= .68 ? 'smoking' : this.amount >= .38 ? 'broken-glass' : this.amount >= .10 ? 'dented' : 'intact'; }
  get glassBroken(): boolean { return this.amount >= .38; }
  get frontBroken(): boolean { return this.amount >= .48; }
  get rearBroken(): boolean { return this.amount >= .78; }
  get drivable(): boolean { return this.amount < 1 && !this.wreck; }
  hit(speedChange: number, point: V3 = { x: .8, y: .12, z: 1.8 }): number {
    if (speedChange < 2.5 || this.wreck) return 0;
    const amount = clamp((speedChange - 1.5) / 62, .025, .68);
    this.amount = clamp(this.amount + amount); this.revision++;
    this.dents.push({ point: { ...point }, depth: Math.min(.35, speedChange * .010), radius: .75 + Math.min(.7, speedChange * .022) });
    if (this.dents.length > 12) this.dents.shift(); return amount;
  }
  update(dt: number): void { if (this.amount >= 1 && !this.wreck) { this.burnSeconds += Math.max(0,dt); if (this.burnSeconds >= 7) { this.wreck = true; this.revision++; } } }
  restore(amount = 0): void { this.amount = clamp(amount); this.burnSeconds = 0; this.wreck = false; this.dents = this.amount > .1 ? [{point:{x:.8,y:.12,z:1.8},depth:this.amount*.28,radius:1.2}] : []; this.revision++; }
  snapshot() { return { amount:this.amount,health:Math.round((1-this.amount)*100),stage:this.stage,frontLightsBroken:this.frontBroken,rearLightsBroken:this.rearBroken,windowsBroken:this.glassBroken,fireSeconds:this.burnSeconds,wreck:this.wreck,dents:this.dents.map(d=>({...d,point:{...d.point}})),powerMultiplier:1-this.amount*.15,gripMultiplier:1-this.amount*.08 }; }
}
