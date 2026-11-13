import { input } from '../engine/input.js';
import { settings } from '../storage.js';
import { clamp } from '../engine/math.js';
import { Actor } from './actor.js';

const WALK_SPEED = 5.4, CROUCH_SPEED = 2.5, AIM_SPEED = 3.4;
const PITCH_LIMIT = 1.5, BASE_FOV = 58 * Math.PI / 180;
const mv = { x: 0, z: 0 };

export class Player extends Actor {
  constructor() {
    super('YOU', true);
    this.viewY = 0; this.kick = 0; this.aim = 0;     // aim: 0..1 blend into aimed view
    this.vm = { kick: 0, lower: 1, flash: 0, swing: 0 };
    this.deathT = 0;
  }

  spawn(sp) {
    this.place(sp);
    this.viewY = this.eyeY(); this.kick = 0; this.aim = 0; this.deathT = 0;
    this.vm.lower = 1; this.vm.kick = 0;
    input.crouchToggle = false; input.aimToggle = false;
  }

  applyLook() {
    const zoom = 1 + this.aim * ((this.inv.def.zoom || 1.35) - 1);
    this.yaw -= input.lookX / zoom;
    this.pitch = clamp(this.pitch - input.lookY / zoom * (settings.invertY ? -1 : 1), -PITCH_LIMIT, PITCH_LIMIT);
    input.lookX = input.lookY = 0;
  }

  update(dt, world) {
    input.move(mv);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const aiming = input.aim() && !this.inv.def.melee && this.inv.reloadT <= 0;
    const maxS = this.crouched ? CROUCH_SPEED : aiming ? AIM_SPEED : WALK_SPEED;
    this.step(dt, world, (c * mv.x - s * mv.z) * maxS, (-s * mv.x - c * mv.z) * maxS, input.jump(), input.crouch());

    const p = this.body.pos, target = p[1] + this.eyeH;
    if (Math.abs(target - this.viewY) > 1.2 || !this.onGround) this.viewY = target;
    else this.viewY += (target - this.viewY) * Math.min(1, dt * 16);
    this.aim += ((aiming ? 1 : 0) - this.aim) * Math.min(1, dt * 14);
    this.kick *= Math.exp(-dt * 9);
  }

  applyToCamera(cam) {
    const p = this.body.pos;
    const amp = this.onGround ? Math.min(this.speed / WALK_SPEED, 1) * 0.035 * (1 - this.aim * 0.7) : 0;
    cam.pos[0] = p[0]; cam.pos[2] = p[2];
    if (this.alive) {
      cam.pos[1] = this.viewY + Math.sin(this.walkPhase * 2) * amp;
      cam.yaw = this.yaw; cam.pitch = clamp(this.pitch + this.kick, -PITCH_LIMIT, PITCH_LIMIT);
    } else {
      // death camera: sink to the ground and tilt
      const k = Math.min(this.deathT / 0.6, 1);
      cam.pos[1] = p[1] + this.eyeH * (1 - k) + 0.3 * k;
      cam.yaw = this.yaw; cam.pitch = this.pitch * (1 - k) + 0.35 * k;
    }
    const zoom = 1 + this.aim * ((this.inv.def.zoom || 1.35) - 1);
    cam.fovY = 2 * Math.atan(Math.tan(BASE_FOV / 2) / zoom);
  }
}
