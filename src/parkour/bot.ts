// Acceptance-test pilot. It supplies the same ordinary input as a player: no teleporting, flying, checkpoints or timer shortcuts.
import { emptyInput, type PlayerInput } from '../player/controller';
import { horizontal } from './types';
import type { ParkourRun } from './ParkourRun';
export class RouteBot {
  index = 1;
  completed = false;
  private previousFalls = 0;
  constructor(readonly run: ParkourRun) {}
  input(): PlayerInput {
    const r = this.run, input = emptyInput();
    if (r.state !== 'running') { this.completed = r.state === 'finished'; return input; }
    if (r.falls !== this.previousFalls) { this.previousFalls = r.falls; this.index = r.route.checkpoints[r.checkpoint]!.navIndex + 1; }
    let n = r.route.nav[Math.min(this.index, r.route.nav.length - 1)]!;
    const p = r.player.position;
    if (horizontal(p, n.position) < (n.action === 'jump' ? 0.48 : 1.1)) {
      if (n.action === 'jump') input.jump = true;
      if (n.action === 'interact') input.interact = true;
      if (this.index < r.route.nav.length - 1) n = r.route.nav[++this.index]!;
    }
    const x = n.position.x - p.x, z = n.position.z - p.z, length = Math.hypot(x, z) || 1;
    input.x = x / length; input.z = z / length; input.sprint = n.sprint ?? false;
    return input;
  }
}
