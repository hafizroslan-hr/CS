// Dynamic geometry batch, rebuilt every frame: oriented boxes and camera-facing quads.
// Vertex layout (10 floats): position(3) normal(3) colour(4)
const STRIDE = 10;
// corner index bits: 1 = +x, 2 = +y, 4 = +z; faces wound counter-clockwise seen from outside
const FACES = [
  [6, 7, 3, 2, 1, 1], [0, 1, 5, 4, 1, -1],     // +Y, -Y   [..corners, axis, sign]
  [5, 1, 3, 7, 0, 1], [0, 4, 6, 2, 0, -1],     // +X, -X
  [4, 5, 7, 6, 2, 1], [1, 0, 2, 3, 2, -1]      // +Z, -Z
];
const corners = new Float32Array(24);
const SEG = 8;                                   // sides of round primitives
const COS = [], SIN = [];
for (let i = 0; i <= SEG; i++) { COS.push(Math.cos(i / SEG * Math.PI * 2)); SIN.push(Math.sin(i / SEG * Math.PI * 2)); }
const CAP = [[0, 1, 2, 3], [0, 3, 4, 7], [7, 4, 5, 6]];   // octagon split into three quads
const ringA = new Float32Array((SEG + 1) * 6), ringB = new Float32Array((SEG + 1) * 6);

export class Batch {
  constructor(gl, maxQuads = 6000) {
    this.gl = gl; this.max = maxQuads * 4;
    this.data = new Float32Array(this.max * STRIDE);
    this.n = 0;   // vertex count
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE * 4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE * 4, 24);
    const idx = new Uint16Array(maxQuads * 6);
    for (let q = 0; q < maxQuads; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    this.ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }
  reset() { this.n = 0; }

  vert(x, y, z, nx, ny, nz, r, g, b, a) {
    const d = this.data, o = this.n * STRIDE;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = nx; d[o + 4] = ny; d[o + 5] = nz;
    d[o + 6] = r; d[o + 7] = g; d[o + 8] = b; d[o + 9] = a;
    this.n++;
  }

  // Box of size (sx,sy,sz) centred at (cx,cy,cz) in the space of matrix m.
  box(m, cx, cy, cz, sx, sy, sz, col, unlit = false) {
    if (this.n + 24 > this.max) return;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    for (let i = 0; i < 8; i++) {
      const x = cx + (i & 1 ? hx : -hx), y = cy + (i & 2 ? hy : -hy), z = cz + (i & 4 ? hz : -hz);
      corners[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
      corners[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      corners[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    for (const f of FACES) {
      const ax = f[4] * 4, s = unlit ? 0 : f[5];
      const nx = m[ax] * s, ny = m[ax + 1] * s, nz = m[ax + 2] * s;
      for (let k = 0; k < 4; k++) {
        const c = f[k] * 3;
        this.vert(corners[c], corners[c + 1], corners[c + 2], nx, ny, nz, col[0], col[1], col[2], 1);
      }
    }
  }

  // transform a local point + normal by m into ring[i] (x,y,z,nx,ny,nz)
  _pt(ring, i, m, x, y, z, nx, ny, nz) {
    const o = i * 6, l = Math.hypot(nx, ny, nz) || 1;
    ring[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
    ring[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    ring[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    ring[o + 3] = (m[0] * nx + m[4] * ny + m[8] * nz) / l;
    ring[o + 4] = (m[1] * nx + m[5] * ny + m[9] * nz) / l;
    ring[o + 5] = (m[2] * nx + m[6] * ny + m[10] * nz) / l;
  }
  _rv(ring, i, col) { const o = i * 6; this.vert(ring[o], ring[o + 1], ring[o + 2], ring[o + 3], ring[o + 4], ring[o + 5], col[0], col[1], col[2], 1); }
  _band(lo, hi, col) {            // quads between two rings, smooth normals
    for (let i = 0; i < SEG; i++) { this._rv(lo, i + 1, col); this._rv(lo, i, col); this._rv(hi, i, col); this._rv(hi, i + 1, col); }
  }
  _cap(ring, m, sign, col) {      // flat octagon cap facing local +Y (sign 1) or -Y (sign -1)
    const nx = m[4] * sign, ny = m[5] * sign, nz = m[6] * sign;
    for (const q of CAP) for (let k = 0; k < 4; k++) {
      const o = q[sign > 0 ? 3 - k : k] * 6;
      this.vert(ring[o], ring[o + 1], ring[o + 2], nx, ny, nz, col[0], col[1], col[2], 1);
    }
  }

  // Tapered elliptical cylinder along local Y from y0 (radii ax0, az0) to y1 (radii ax1, az1).
  cyl(m, cx, y0, y1, cz, ax0, az0, ax1, az1, col, capTop = false, capBot = false) {
    if (this.n + (SEG + 6) * 4 > this.max) return;
    for (let i = 0; i <= SEG; i++) {
      const c = COS[i], s = SIN[i];
      this._pt(ringA, i, m, cx + c * ax0, y0, cz + s * az0, c * az0, 0, s * ax0);
      this._pt(ringB, i, m, cx + c * ax1, y1, cz + s * az1, c * az1, 0, s * ax1);
    }
    this._band(ringA, ringB, col);
    if (capTop) this._cap(ringB, m, 1, col);
    if (capBot) this._cap(ringA, m, -1, col);
  }

  // Ellipsoid. phi0 > -PI/2 cuts the bottom off (helmets, caps).
  ball(m, cx, cy, cz, rx, ry, rz, col, phi0 = -Math.PI / 2, rings = 5) {
    if (this.n + rings * SEG * 4 > this.max) return;
    let lo = ringA, hi = ringB;
    for (let j = 0; j <= rings; j++) {
      const phi = phi0 + (Math.PI / 2 - phi0) * j / rings, cp = Math.cos(phi), sp = Math.sin(phi);
      for (let i = 0; i <= SEG; i++) {
        const c = COS[i] * cp, s = SIN[i] * cp;
        this._pt(hi, i, m, cx + c * rx, cy + sp * ry, cz + s * rz, c / rx, sp / ry, s / rz);
      }
      if (j > 0) this._band(lo, hi, col);
      const t = lo; lo = hi; hi = t;
    }
  }

  // Flat disc on the ground (blob shadows), four quads fanned from the centre.
  disc(x, y, z, r, cr, cg, cb, a) {
    if (this.n + 16 > this.max) return;
    for (let i = 0; i < SEG; i += 2) {
      this.vert(x, y, z, 0, 0, 0, cr, cg, cb, a);
      for (let k = 0; k < 3; k++) this.vert(x + COS[i + k] * r, y, z + SIN[i + k] * r, 0, 0, 0, cr, cg, cb, a);
    }
  }

  // Unlit quad spanned by two half-axis vectors around a centre.
  quad(x, y, z, ax, ay, az, bx, by, bz, r, g, b, a) {
    if (this.n + 4 > this.max) return;
    this.vert(x - ax - bx, y - ay - by, z - az - bz, 0, 0, 0, r, g, b, a);
    this.vert(x + ax - bx, y + ay - by, z + az - bz, 0, 0, 0, r, g, b, a);
    this.vert(x + ax + bx, y + ay + by, z + az + bz, 0, 0, 0, r, g, b, a);
    this.vert(x - ax + bx, y - ay + by, z - az + bz, 0, 0, 0, r, g, b, a);
  }

  draw() {
    if (!this.n) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * STRIDE);
    gl.drawElements(gl.TRIANGLES, this.n / 4 * 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}
