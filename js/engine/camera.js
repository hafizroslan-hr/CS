import { perspective, multiply } from './math.js';

// First-person camera. yaw 0 looks toward -Z (north); positive yaw turns left.
export class Camera {
  constructor() {
    this.pos = [0, 0, 0];
    this.yaw = 0; this.pitch = 0;
    this.fovY = 58 * Math.PI / 180;
    this.near = 0.08; this.far = 400;
    this.aspect = 1;
    this.right = [1, 0, 0]; this.up = [0, 1, 0]; this.fwd = [0, 0, -1];
    this.view = new Float32Array(16);
    this.proj = new Float32Array(16);
    this.viewProj = new Float32Array(16);
  }

  update(aspect) {
    this.aspect = aspect;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const sp = Math.sin(this.pitch), cp = Math.cos(this.pitch);
    const f = this.fwd, r = this.right, u = this.up, p = this.pos;
    f[0] = -sy * cp; f[1] = sp; f[2] = -cy * cp;
    r[0] = cy; r[1] = 0; r[2] = -sy;
    u[0] = r[1] * f[2] - r[2] * f[1];
    u[1] = r[2] * f[0] - r[0] * f[2];
    u[2] = r[0] * f[1] - r[1] * f[0];
    const v = this.view;
    v[0] = r[0]; v[1] = u[0]; v[2] = -f[0]; v[3] = 0;
    v[4] = r[1]; v[5] = u[1]; v[6] = -f[1]; v[7] = 0;
    v[8] = r[2]; v[9] = u[2]; v[10] = -f[2]; v[11] = 0;
    v[12] = -(r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
    v[13] = -(u[0] * p[0] + u[1] * p[1] + u[2] * p[2]);
    v[14] = f[0] * p[0] + f[1] * p[1] + f[2] * p[2];
    v[15] = 1;
    perspective(this.proj, this.fovY, aspect, this.near, this.far);
    multiply(this.viewProj, this.proj, v);
  }

  lookAt(tx, ty, tz) {
    const dx = tx - this.pos[0], dy = ty - this.pos[1], dz = tz - this.pos[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.asin(dy / len);
  }
}
