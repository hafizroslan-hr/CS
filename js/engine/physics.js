// Kinematic body movement against a CollisionWorld.
// body: { pos:[x,y,z] (feet centre), hw: half width, h: height }
export const GRAVITY = 20;
export const STEP_HEIGHT = 0.55;
const EPS = 1e-3;
const tmp = [];

// Move along one axis and push out of anything hit. Returns true on contact.
export function sweepAxis(world, b, axis, d) {
  if (d === 0) return false;
  const p = b.pos, hw = b.hw, B = world.b;
  p[axis] += d;
  world.query(p[0] - hw, p[2] - hw, p[0] + hw, p[2] + hw, tmp);
  let hit = false;
  for (let k = 0; k < tmp.length; k++) {
    const o = tmp[k] * 6;
    if (p[0] + hw <= B[o] || p[0] - hw >= B[o + 3] ||
        p[1] + b.h <= B[o + 1] || p[1] >= B[o + 4] ||
        p[2] + hw <= B[o + 2] || p[2] - hw >= B[o + 5]) continue;
    hit = true;
    if (axis === 0) p[0] = d > 0 ? B[o] - hw - EPS : B[o + 3] + hw + EPS;
    else if (axis === 1) p[1] = d > 0 ? B[o + 1] - b.h - EPS : B[o + 4] + EPS;
    else p[2] = d > 0 ? B[o + 2] - hw - EPS : B[o + 5] + hw + EPS;
  }
  return hit;
}

// Horizontal move with automatic step-up over low ledges (stairs, kerbs).
// Returns bit flags: 1 = blocked on X, 2 = blocked on Z.
export function moveHorizontal(world, b, dx, dz, canStep) {
  const p = b.pos, ox = p[0], oy = p[1], oz = p[2];
  const hx = sweepAxis(world, b, 0, dx), hz = sweepAxis(world, b, 2, dz);
  if (!(hx || hz) || !canStep) return (hx ? 1 : 0) | (hz ? 2 : 0);
  const ax = p[0], az = p[2];
  const distA = (ax - ox) * (ax - ox) + (az - oz) * (az - oz);
  // retry from a raised position
  p[0] = ox; p[1] = oy; p[2] = oz;
  sweepAxis(world, b, 1, STEP_HEIGHT);
  const sx = sweepAxis(world, b, 0, dx), sz = sweepAxis(world, b, 2, dz);
  sweepAxis(world, b, 1, -(p[1] - oy) - EPS);
  const distB = (p[0] - ox) * (p[0] - ox) + (p[2] - oz) * (p[2] - oz);
  if (distB > distA + 1e-7) return (sx ? 1 : 0) | (sz ? 2 : 0);
  p[0] = ax; p[1] = oy; p[2] = az;
  return (hx ? 1 : 0) | (hz ? 2 : 0);
}
