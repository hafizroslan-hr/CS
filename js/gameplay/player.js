import { input } from '../engine/input.js';
import { sweepAxis, moveHorizontal, GRAVITY, STEP_HEIGHT } from '../engine/physics.js';
import { settings } from '../storage.js';
import { clamp } from '../engine/math.js';

const STAND_H = 1.8, CROUCH_H = 1.2, EYE_STAND = 1.62, EYE_CROUCH = 1.02;
const WALK_SPEED = 5.4, CROUCH_SPEED = 2.5, JUMP_V = 6.5;
const GROUND_ACCEL = 55, AIR_ACCEL = 9;
const PITCH_LIMIT = 1.5;
const mv = { x: 0, z: 0 };

export class Player {
  constructor() {
    this.body = { pos: [0, 0, 0], hw: 0.35, h: STAND_H };
    this.vel = [0, 0, 0];
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.crouched = false;
    this.eyeH = EYE_STAND; this.viewY = 0; this.bob = 0;
  }

  spawn(sp) {
    const p = this.body.pos;
    p[0] = sp.x; p[1] = 0.01; p[2] = sp.z;
    this.vel[0] = this.vel[1] = this.vel[2] = 0;
    this.yaw = sp.yaw; this.pitch = 0;
    this.crouched = false; this.body.h = STAND_H; this.eyeH = EYE_STAND;
    this.viewY = p[1] + this.eyeH; this.bob = 0;
    input.crouchToggle = false;
  }

  applyLook() {
    this.yaw -= input.lookX;
    this.pitch = clamp(this.pitch - input.lookY * (settings.invertY ? -1 : 1), -PITCH_LIMIT, PITCH_LIMIT);
    input.lookX = input.lookY = 0;
  }

  update(dt, world) {
    const b = this.body, p = b.pos, v = this.vel;

    // crouch (stand up only when there is head room)
    if (input.crouch()) this.crouched = true;
    else if (this.crouched && !world.overlaps(p[0] - b.hw, p[1] + CROUCH_H, p[2] - b.hw, p[0] + b.hw, p[1] + STAND_H, p[2] + b.hw)) this.crouched = false;
    b.h = this.crouched ? CROUCH_H : STAND_H;

    // desired velocity in world space
    input.move(mv);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const maxS = this.crouched ? CROUCH_SPEED : WALK_SPEED;
    const tx = (c * mv.x - s * mv.z) * maxS, tz = (-s * mv.x - c * mv.z) * maxS;
    const acc = (this.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt;
    let ax = tx - v[0], az = tz - v[2];
    const al = Math.hypot(ax, az);
    if (al > acc) { ax *= acc / al; az *= acc / al; }
    if (this.onGround || mv.x || mv.z) { v[0] += ax; v[2] += az; }

    let jumped = false;
    if (this.onGround && input.jump()) { v[1] = JUMP_V; this.onGround = false; jumped = true; }

    const wasGround = this.onGround;
    const blocked = moveHorizontal(world, b, v[0] * dt, v[2] * dt, wasGround);
    if (blocked & 1) v[0] = 0;
    if (blocked & 2) v[2] = 0;

    // keep contact with the ground when walking down steps
    if (wasGround && !jumped) {
      const y0 = p[1];
      if (!sweepAxis(world, b, 1, -STEP_HEIGHT)) p[1] = y0;
    }

    v[1] -= GRAVITY * dt;
    if (sweepAxis(world, b, 1, v[1] * dt)) {
      this.onGround = v[1] < 0;
      v[1] = 0;
    } else this.onGround = false;

    // smoothed eye height (crouch transitions, stairs) and view bob
    const eyeTarget = this.crouched ? EYE_CROUCH : EYE_STAND;
    this.eyeH += (eyeTarget - this.eyeH) * Math.min(1, dt * 12);
    const target = p[1] + this.eyeH;
    if (Math.abs(target - this.viewY) > 1.2 || !this.onGround) this.viewY = target;
    else this.viewY += (target - this.viewY) * Math.min(1, dt * 16);
    const speed = Math.hypot(v[0], v[2]);
    if (this.onGround && speed > 0.5) this.bob += dt * speed * 1.9;
    this.speed = speed;
  }

  applyToCamera(cam) {
    const p = this.body.pos;
    const amp = this.onGround ? Math.min(this.speed / WALK_SPEED, 1) * 0.035 : 0;
    cam.pos[0] = p[0]; cam.pos[1] = this.viewY + Math.sin(this.bob * 2) * amp; cam.pos[2] = p[2];
    cam.yaw = this.yaw; cam.pitch = this.pitch;
  }
}
