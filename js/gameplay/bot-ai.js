// Bot behaviour: a finite state machine per bot.
//   idle → patrol → (sees enemy) attack → (loses sight) chase → search → idle
//   investigate: move to a heard gunshot or a team-mate's contact report
//   retreat: fall back to own spawn when badly hurt (HARD / EXPERT)
// Difficulty changes real parameters: reaction time, aim error, turn rate, field of view,
// hearing, team coordination range, burst discipline, strafing, flanking and movement speed.
import { angDiff, rand, clamp } from '../engine/math.js';

const deg = d => Math.cos(d * Math.PI / 180);
export const DIFFICULTY = {
  easy:   { react: 0.95, err: 0.085, turn: 4.5, fovCos: deg(50), sight: 45, hear: 20, coord: 0,  burst: [2, 4],  pause: [0.7, 1.3],  strafe: 0.15, retreat: false, flank: 0,   speed: 4.2, head: 0 },
  normal: { react: 0.55, err: 0.05,  turn: 7,   fovCos: deg(60), sight: 60, hear: 38, coord: 18, burst: [3, 6],  pause: [0.45, 0.9], strafe: 0.5,  retreat: false, flank: 0.3, speed: 4.7, head: 0.05 },
  hard:   { react: 0.32, err: 0.03,  turn: 10,  fovCos: deg(66), sight: 75, hear: 55, coord: 35, burst: [4, 8],  pause: [0.3, 0.6],  strafe: 0.8,  retreat: true,  flank: 0.9, speed: 5.1, head: 0.15 },
  expert: { react: 0.18, err: 0.017, turn: 14,  fovCos: deg(72), sight: 90, hear: 75, coord: 60, burst: [5, 10], pause: [0.2, 0.45], strafe: 1,    retreat: true,  flank: 1.4, speed: 5.3, head: 0.3 }
};
const randInt = r => Math.floor(rand(r[0], r[1] + 1));
const dirOut = [0, 0, 0];

export class BotBrain {
  constructor(bot, match, P, seed) {
    this.bot = bot; this.match = match; this.P = P; this.seed = seed;
    this.reset();
  }

  reset() {
    this.state = 'idle'; this.idleT = rand(0.1, 1.2);
    this.path = null; this.pi = 0; this.destX = 0; this.destZ = 0;
    this.target = null; this.visible = false; this.lostT = 0;
    this.lastX = 0; this.lastZ = 0;
    this.reactT = 0; this.trackT = 0; this.burst = randInt(this.P.burst); this.pauseT = 0;
    this.strafeT = 0; this.strafeDir = 0; this.repathT = 0;
    this.thinkT = rand(0, 0.15); this.searchT = 0; this.scanDir = Math.random() < 0.5 ? -1 : 1;
    this.stuckT = 0; this.stuckN = 0; this.sx = 0; this.sz = 0;
    this.lookT = 0; this.lookYaw = 0; this.retreated = false;
    this.wx = 0; this.wz = 0; this.wantYaw = this.bot.yaw; this.jump = false;
  }

  pathTo(x, z, vary) {
    const p = this.bot.body.pos;
    this.path = this.match.map.nav.findPath(p[0], p[2], x, z, vary ? this.P.flank : 0, this.seed + (this.repathSeed = (this.repathSeed || 0) + 1));
    this.pi = 0; this.destX = x; this.destZ = z;
    return !!this.path;
  }

  pickPatrol() {
    const map = this.match.map, b = this.bot, r = Math.random();
    let x, z;
    const enemy = map.spawns[b.team === 'att' ? 'def' : 'att'];
    if (r < 0.35) { const s = enemy[Math.floor(Math.random() * enemy.length)]; x = s.x; z = s.z; }
    else if (r < 0.65) { const s = map.sites[Math.random() < 0.5 ? 'A' : 'B']; x = s.x + rand(-3, 3); z = s.z + rand(-3, 3); }
    else if (r < 0.8) { x = map.width / 2 + rand(-8, 8); z = map.depth / 2 + rand(-8, 8); }
    else { const c = map.nav.center(map.nav.randomCell(), {}); x = c.x; z = c.z; }
    this.pathTo(x, z, true);
  }

  // Steer along the current path. Returns false when there is nothing left to follow.
  follow(speed) {
    const p = this.bot.body.pos;
    while (this.path && this.pi < this.path.length) {
      const w = this.path[this.pi], dx = w.x - p[0], dz = w.z - p[2], d = Math.hypot(dx, dz);
      if (d < 0.5) { this.pi++; continue; }
      this.wx = dx / d * speed; this.wz = dz / d * speed;
      this.wantYaw = Math.atan2(-dx, -dz);
      return true;
    }
    return false;
  }

  // Vision: range, field of view and an unobstructed line of sight are all required.
  perceive() {
    const b = this.bot, p = b.body.pos, P = this.P, m = this.match, ey = b.eyeY();
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    let best = null, bd = 1e9;
    for (const e of m.actors) {
      if (e.team === b.team || !e.alive) continue;
      const ep = e.body.pos, dx = ep[0] - p[0], dz = ep[2] - p[2], d = Math.hypot(dx, dz);
      if (d > P.sight) continue;
      if (d > 3.5 && (dx * fx + dz * fz) / d < P.fovCos) continue;
      if (!m.los(p[0], ey, p[2], ep[0], ep[1] + e.body.h * 0.8, ep[2])) continue;
      const score = d * (e === this.target ? 0.6 : 1);
      if (score < bd) { bd = score; best = e; }
    }
    if (best) {
      if (best !== this.target) {
        this.target = best; this.reactT = P.react * rand(0.8, 1.3); this.trackT = 0;
        this.burst = randInt(P.burst); this.pauseT = 0;
      }
      this.visible = true; this.lostT = 0;
      this.lastX = best.body.pos[0]; this.lastZ = best.body.pos[2];
      if (this.state !== 'attack' && this.state !== 'retreat') { this.state = 'attack'; m.alert(b, best); }
    } else this.visible = false;
  }

  // A gunshot or a team-mate's report: go and look.
  hear(x, z) {
    if (this.state !== 'idle' && this.state !== 'patrol' && this.state !== 'search') return;
    if (this.pathTo(x + rand(-3, 3), z + rand(-3, 3), true)) this.state = 'investigate';
  }

  onDamaged(att) {
    if (!att || att === this.bot || this.state === 'attack' || this.state === 'retreat') return;
    const p = this.bot.body.pos, ap = att.body.pos;
    this.lookYaw = Math.atan2(-(ap[0] - p[0]), -(ap[2] - p[2])); this.lookT = 1.2;
    if (this.pathTo(ap[0], ap[2], false)) this.state = 'chase';
  }

  attack(dt) {
    const b = this.bot, p = b.body.pos, P = this.P, t = this.target, inv = b.inv;
    if (!t || !t.alive) { this.target = null; this.state = 'idle'; this.idleT = rand(0.2, 0.6); return; }
    if (!this.visible) {
      this.lostT += dt;
      if (this.lostT > 0.6) { this.state = this.pathTo(this.lastX, this.lastZ, false) ? 'chase' : 'idle'; return; }
    }
    if (P.retreat && b.health < 30 && !this.retreated) {
      this.retreated = true;
      const own = this.match.map.spawns[b.team], s = own[Math.floor(Math.random() * own.length)];
      if (this.pathTo(s.x, s.z, false)) { this.state = 'retreat'; return; }
    }
    const tp = t.body.pos, dx = tp[0] - p[0], dz = tp[2] - p[2], d = Math.hypot(dx, dz) || 1;
    const aimYaw = Math.atan2(-dx, -dz);
    this.trackT += dt; this.reactT -= dt;
    if (inv.slot.mag <= 0) inv.startReload();

    // positioning: close the distance if too far for the weapon, otherwise strafe / back off
    const ideal = inv.def.ideal;
    if (d > ideal * 1.7 || !this.visible) {
      this.repathT -= dt;
      if (this.repathT <= 0 || !this.path) { this.pathTo(tp[0], tp[2], false); this.repathT = 1; }
      this.follow(P.speed);
    } else {
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = rand(0.5, 1.4);
        this.strafeDir = Math.random() < P.strafe ? (Math.random() < 0.5 ? -1 : 1) : 0;
      }
      const rx = -dz / d, rz = dx / d, back = d < ideal * 0.45 ? -0.6 : 0;
      this.wx = (rx * this.strafeDir * 0.7 + dx / d * back) * P.speed;
      this.wz = (rz * this.strafeDir * 0.7 + dz / d * back) * P.speed;
    }
    this.wantYaw = aimYaw;

    if (this.visible && this.reactT <= 0 && Math.abs(angDiff(b.yaw, aimYaw)) < 0.22 && inv.ready() && inv.slot.mag > 0) {
      if (this.pauseT > 0) this.pauseT -= dt;
      else {
        // aim at chest (sometimes head on higher difficulties), then add error that
        // shrinks while tracking and grows with the target's speed
        const ey = b.eyeY(), ty = tp[1] + t.body.h * (Math.random() < P.head ? 0.9 : 0.62);
        let ax = dx, ay = ty - ey, az = dz;
        const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
        const e = P.err * (1 + 1.8 * Math.exp(-this.trackT * 1.4)) * (1 + t.speed * 0.1);
        const g1 = (Math.random() + Math.random() + Math.random() - 1.5) * 1.3 * e;
        const g2 = (Math.random() + Math.random() + Math.random() - 1.5) * 1.3 * e;
        dirOut[0] = ax + (-az) * g1; dirOut[1] = ay + g2; dirOut[2] = az + ax * g1;
        const n = Math.hypot(dirOut[0], dirOut[1], dirOut[2]);
        dirOut[0] /= n; dirOut[1] /= n; dirOut[2] /= n;
        this.match.fire(b, dirOut);
        if (--this.burst <= 0) { this.pauseT = rand(P.pause[0], P.pause[1]); this.burst = randInt(P.burst); }
      }
    }
  }

  update(dt, world) {
    const b = this.bot, p = b.body.pos, P = this.P;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = rand(0.1, 0.18); this.perceive(); }
    this.wx = this.wz = 0; this.wantYaw = b.yaw;

    switch (this.state) {
      case 'idle':
        this.idleT -= dt; this.wantYaw = b.yaw + this.scanDir * 0.9 * dt * 4;
        if (b.inv.slot.mag < b.inv.def.mag * 0.5) b.inv.startReload();
        if (this.idleT <= 0) { this.pickPatrol(); this.state = this.path ? 'patrol' : 'idle'; this.idleT = 0.5; }
        break;
      case 'patrol':
        if (!this.follow(P.speed * 0.8)) { this.state = 'idle'; this.idleT = rand(0.5, 2); this.scanDir = -this.scanDir; }
        break;
      case 'investigate': case 'chase':
        if (!this.follow(P.speed)) { this.state = 'search'; this.searchT = rand(2, 3.5); }
        break;
      case 'retreat':
        if (b.inv.slot.mag < b.inv.def.mag) b.inv.startReload();
        if (!this.follow(P.speed)) { this.state = 'idle'; this.idleT = rand(1, 2); }
        break;
      case 'search':
        this.searchT -= dt; this.wantYaw = b.yaw + this.scanDir * 1.8 * dt * 4;
        if (this.searchT <= 0) { this.state = 'idle'; this.idleT = 0.2; }
        break;
      case 'attack': this.attack(dt); break;
    }
    if (this.lookT > 0 && this.state !== 'attack') { this.lookT -= dt; this.wantYaw = this.lookYaw; }

    // stuck detection: jump first, then re-plan with a varied route
    this.jump = false;
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      if ((this.wx || this.wz) && Math.hypot(p[0] - this.sx, p[2] - this.sz) < 0.3) {
        this.jump = true;
        if (++this.stuckN >= 2 && this.state !== 'attack') { this.pathTo(this.destX, this.destZ, true); this.stuckN = 0; }
      } else this.stuckN = 0;
      this.stuckT = 0; this.sx = p[0]; this.sz = p[2];
    }

    b.yaw += clamp(angDiff(this.wantYaw, b.yaw), -P.turn * dt, P.turn * dt);
    b.step(dt, world, this.wx, this.wz, this.jump, false);
  }
}
