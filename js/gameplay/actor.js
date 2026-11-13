// Shared body, movement and vitals for the player and bots.
import { sweepAxis, moveHorizontal, GRAVITY, STEP_HEIGHT } from '../engine/physics.js';
import { Inventory } from './weapons.js';

export const STAND_H = 1.8, CROUCH_H = 1.2, EYE_STAND = 1.62, EYE_CROUCH = 1.02;
export const JUMP_V = 6.5;
const GROUND_ACCEL = 55, AIR_ACCEL = 9;

export class Actor {
  constructor(name, isPlayer) {
    this.name = name; this.isPlayer = isPlayer; this.team = 'att';
    this.body = { pos: [0, 0, 0], hw: 0.35, h: STAND_H };
    this.vel = [0, 0, 0];
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.crouched = false;
    this.eyeH = EYE_STAND;
    this.health = 100; this.armor = 0; this.alive = true;
    this.kills = 0; this.deaths = 0;
    this.respawnT = 0; this.fall = 0;      // death animation 0..1
    this.walkPhase = 0; this.speed = 0; this.stepSound = false;
    this.flashT = 0;                       // muzzle flash timer (third person)
    this.inv = new Inventory(!isPlayer);
  }

  place(sp) {
    const p = this.body.pos;
    p[0] = sp.x; p[1] = 0.01; p[2] = sp.z;
    this.vel[0] = this.vel[1] = this.vel[2] = 0;
    this.yaw = sp.yaw; this.pitch = 0;
    this.crouched = false; this.body.h = STAND_H; this.eyeH = EYE_STAND;
    this.health = 100; this.alive = true; this.fall = 0; this.onGround = false;
  }

  eyeY() { return this.body.pos[1] + this.eyeH; }

  // One physics step. (wx, wz) is the desired horizontal velocity in world space.
  step(dt, world, wx, wz, wantJump, wantCrouch) {
    const b = this.body, p = b.pos, v = this.vel;
    if (wantCrouch) this.crouched = true;
    else if (this.crouched && !world.overlaps(p[0] - b.hw, p[1] + CROUCH_H, p[2] - b.hw, p[0] + b.hw, p[1] + STAND_H, p[2] + b.hw)) this.crouched = false;
    b.h = this.crouched ? CROUCH_H : STAND_H;

    const acc = (this.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt;
    let ax = wx - v[0], az = wz - v[2];
    const al = Math.hypot(ax, az);
    if (al > acc) { ax *= acc / al; az *= acc / al; }
    if (this.onGround || wx || wz) { v[0] += ax; v[2] += az; }

    let jumped = false;
    if (this.onGround && wantJump) { v[1] = JUMP_V; this.onGround = false; jumped = true; }

    const wasGround = this.onGround;
    const blocked = moveHorizontal(world, b, v[0] * dt, v[2] * dt, wasGround);
    if (blocked & 1) v[0] = 0;
    if (blocked & 2) v[2] = 0;
    this.blocked = blocked;

    if (wasGround && !jumped) {           // stay glued to the ground on downward steps
      const y0 = p[1];
      if (!sweepAxis(world, b, 1, -STEP_HEIGHT)) p[1] = y0;
    }
    v[1] -= GRAVITY * dt;
    const vy = v[1];
    if (sweepAxis(world, b, 1, v[1] * dt)) { this.onGround = v[1] < 0; v[1] = 0; }
    else this.onGround = false;
    this.landed = this.onGround && !wasGround && vy < -5;

    this.eyeH += ((this.crouched ? EYE_CROUCH : EYE_STAND) - this.eyeH) * Math.min(1, dt * 12);
    this.speed = Math.hypot(v[0], v[2]);
    if (this.onGround && this.speed > 0.6) {
      const before = Math.floor(this.walkPhase / Math.PI);
      this.walkPhase += dt * this.speed * 1.9;
      if (Math.floor(this.walkPhase / Math.PI) !== before && this.speed > 3) this.stepSound = true;
    }
  }
}
