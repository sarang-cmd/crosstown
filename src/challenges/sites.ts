// Surveyed clear County Line lots. Keep building generation and activity starts
// in agreement; these are dedicated practice yards, not adaptive population cuts.
export const DRIFT_YARD = { x: 1024, z: 1280 } as const;
export const STUNT_YARD = { x: 1536, z: 1280 } as const;
export function inActivityYard(x:number,z:number):boolean {
 // Include the maximum building half-diagonal so facades cannot hang into a yard.
 return Math.abs(x-DRIFT_YARD.x)<105 && Math.abs(z-DRIFT_YARD.z)<105
   || Math.abs(x-STUNT_YARD.x)<100 && z>STUNT_YARD.z-95 && z<STUNT_YARD.z+175;
}
