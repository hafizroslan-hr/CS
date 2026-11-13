// Minimal column-major 4x4 matrix helpers (Float32Array(16)).
export function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}

export function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// ---- in-place affine helpers (post-multiply): m = m * T ------------------------------
export function identity(m) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; }
export function translate(m, x, y, z) {
  m[12] += m[0] * x + m[4] * y + m[8] * z;
  m[13] += m[1] * x + m[5] * y + m[9] * z;
  m[14] += m[2] * x + m[6] * y + m[10] * z;
  return m;
}
function rot(m, a, i, j, sign) {   // rotate columns i,j
  const c = Math.cos(a), s = Math.sin(a) * sign;
  for (let k = 0; k < 3; k++) {
    const p = m[i * 4 + k], q = m[j * 4 + k];
    m[i * 4 + k] = p * c + q * s;
    m[j * 4 + k] = -p * s + q * c;
  }
  return m;
}
export const rotX = (m, a) => rot(m, a, 1, 2, 1);    // positive pitches -Z (forward) upward
export const rotY = (m, a) => rot(m, a, 0, 2, -1);   // positive turns -Z toward -X (left), same as yaw
export const rotZ = (m, a) => rot(m, a, 0, 1, 1);
export const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const rand = (a, b) => a + Math.random() * (b - a);
