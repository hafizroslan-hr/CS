// Pooled particles and bullet tracers (fixed-size pools, no per-frame allocation).
const MAX_P = 260, MAX_T = 40;

export class Effects {
  constructor() {
    this.p = Array.from({ length: MAX_P }, () => ({ life: 0 }));
    this.t = Array.from({ length: MAX_T }, () => ({ life: 0 }));
    this.pi = 0; this.ti = 0;
  }
  clear() { for (const q of this.p) q.life = 0; for (const q of this.t) q.life = 0; }

  spawn(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, grav) {
    const q = this.p[this.pi]; this.pi = (this.pi + 1) % MAX_P;
    q.x = x; q.y = y; q.z = z; q.vx = vx; q.vy = vy; q.vz = vz;
    q.life = q.max = life; q.size = size; q.grow = grow; q.r = r; q.g = g; q.b = b; q.a = a; q.grav = grav;
  }
  tracer(ax, ay, az, bx, by, bz) {
    const q = this.t[this.ti]; this.ti = (this.ti + 1) % MAX_T;
    q.ax = ax; q.ay = ay; q.az = az; q.bx = bx; q.by = by; q.bz = bz; q.life = q.max = 0.07;
  }
  // dust puff where a bullet hits the world
  impact(x, y, z) {
    for (let i = 0; i < 4; i++) this.spawn(x, y, z, (Math.random() - 0.5) * 1.6, Math.random() * 1.6, (Math.random() - 0.5) * 1.6,
      0.35 + Math.random() * 0.2, 0.07, 0.5, 0.72, 0.64, 0.5, 0.7, 2);
    this.spawn(x, y, z, 0, 0, 0, 0.06, 0.09, 0, 1, 0.9, 0.6, 1, 0);
  }
  blood(x, y, z) {
    for (let i = 0; i < 6; i++) this.spawn(x, y, z, (Math.random() - 0.5) * 2.4, Math.random() * 2, (Math.random() - 0.5) * 2.4,
      0.3 + Math.random() * 0.25, 0.06, 0.15, 0.62, 0.05, 0.04, 0.9, 9);
  }
  flash(x, y, z) { this.spawn(x, y, z, 0, 0, 0, 0.05, 0.28, 0, 1, 0.85, 0.45, 0.95, 0); }
  explosion(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, s = 2 + Math.random() * 5;
      this.spawn(x, y + 0.3, z, Math.cos(a) * s, 1 + Math.random() * 5, Math.sin(a) * s, 0.35 + Math.random() * 0.3, 0.7, 4, 1, 0.55 + Math.random() * 0.3, 0.15, 0.95, 0);
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.283, s = 1 + Math.random() * 3;
      this.spawn(x, y + 0.5, z, Math.cos(a) * s, 1 + Math.random() * 2.5, Math.sin(a) * s, 1.2 + Math.random() * 0.9, 0.9, 1.6, 0.22, 0.21, 0.2, 0.6, -0.4);
    }
    this.spawn(x, y + 0.5, z, 0, 0, 0, 0.1, 4.5, 0, 1, 0.95, 0.75, 0.9, 0);
  }

  update(dt) {
    for (const q of this.p) {
      if (q.life <= 0) continue;
      q.life -= dt; q.vy -= q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.size += q.grow * dt;
      if (q.y < 0.02 && q.grav > 0) { q.y = 0.02; q.vx = q.vz = q.vy = 0; }
    }
    for (const q of this.t) if (q.life > 0) q.life -= dt;
  }

  draw(batch, cam) {
    const r = cam.right, u = cam.up, c = cam.pos;
    for (const q of this.p) {
      if (q.life <= 0) continue;
      const h = q.size / 2, a = q.a * Math.min(1, q.life / q.max * 2);
      batch.quad(q.x, q.y, q.z, r[0] * h, r[1] * h, r[2] * h, u[0] * h, u[1] * h, u[2] * h, q.r, q.g, q.b, a);
    }
    for (const q of this.t) {
      if (q.life <= 0) continue;
      const dx = q.bx - q.ax, dy = q.by - q.ay, dz = q.bz - q.az;
      const mx = (q.ax + q.bx) / 2, my = (q.ay + q.by) / 2, mz = (q.az + q.bz) / 2;
      // side vector = dir x (toCamera): keeps the streak facing the viewer
      const tx = c[0] - mx, ty = c[1] - my, tz = c[2] - mz;
      let sx = dy * tz - dz * ty, sy = dz * tx - dx * tz, sz = dx * ty - dy * tx;
      const sl = Math.hypot(sx, sy, sz) || 1, w = 0.018 + Math.hypot(tx, ty, tz) * 0.0012;
      sx *= w / sl; sy *= w / sl; sz *= w / sl;
      batch.quad(mx, my, mz, dx / 2, dy / 2, dz / 2, sx, sy, sz, 1, 0.9, 0.6, 0.55 * q.life / q.max);
    }
  }
}
