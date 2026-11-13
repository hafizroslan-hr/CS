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
